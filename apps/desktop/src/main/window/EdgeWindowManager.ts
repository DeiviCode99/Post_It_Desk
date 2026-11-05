import { app, BrowserWindow, screen, type Display } from 'electron';
import { appendFileSync } from 'fs';
import { join } from 'path';
import { IpcChannels, type EdgeMode } from '../../shared/contracts';
import type { SettingsStore } from '../system/SettingsStore';

/**
 * Ancho de la ventana por estado. Oculta es la pestaña del borde; abierta
 * incluye margen alrededor del panel para que se vean sus esquinas y sombra.
 */
const WIDTH: Record<EdgeMode, number> = { collapsed: 16, list: 376, sheet: 860 };
/** Si el renderer no confirma el repliegue animado a tiempo, se repliega igual. */
const COLLAPSE_FALLBACK_MS = 600;

/** Pantalla tal como se ofrece en el menú de la bandeja. */
export interface DisplayOption {
  id: number;
  label: string;
}
/** La franja oculta ocupa una fracción de la altura para no tapar barras de scroll. */
const COLLAPSED_HEIGHT_RATIO = 0.22;

/**
 * Controla la única ventana de la app: pegada al borde derecho, siempre
 * encima, sin marco ni barra de tareas. Cambia de tamaño según el estado y
 * se repliega al perder el foco salvo que el usuario la haya fijado.
 */
export class EdgeWindowManager {
  private window: BrowserWindow | null = null;
  private mode: EdgeMode = 'collapsed';
  private collapseFallback: NodeJS.Timeout | null = null;
  private passthrough = false;

  constructor(private readonly settings: SettingsStore) {}

  create(): BrowserWindow {
    this.window = new BrowserWindow({
      ...this.boundsFor('collapsed'),
      show: false,
      frame: false,
      thickFrame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      // Transparente: el panel dibuja sus propias esquinas redondeadas y sombra.
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    // 'floating' la mantiene sobre ventanas normales sin tapar menús del sistema.
    this.window.setAlwaysOnTop(true, 'floating');

    this.window.on('blur', () => {
      if (!this.isPinned()) this.requestCollapse();
    });
    this.window.once('ready-to-show', () => {
      this.window?.showInactive();
      this.applyBounds(); // Ya visible: verifica la posición real.
    });
    // Conectar, desconectar o reorganizar monitores reubica la ventana.
    screen.on('display-added', () => this.applyBounds());
    screen.on('display-removed', () => this.applyBounds());
    screen.on('display-metrics-changed', () => this.applyBounds());

    this.loadRenderer();
    return this.window;
  }

  getMode(): EdgeMode {
    return this.mode;
  }

  setMode(mode: EdgeMode): void {
    this.clearCollapseFallback();
    if (!this.window || mode === this.mode) return;
    this.mode = mode;
    if (mode === 'collapsed') this.setPassthrough(false); // La pestaña siempre recibe el mouse.
    this.applyBounds();
    this.window.webContents.send(IpcChannels.ModeChanged, mode);
  }

  /**
   * Repliegue en dos pasos: el renderer anima la salida del panel y luego
   * confirma con setMode('collapsed'). Así la ventana no se encoge a mitad
   * de la animación.
   */
  requestCollapse(): void {
    if (!this.window || this.mode === 'collapsed' || this.collapseFallback) return;
    this.window.webContents.send(IpcChannels.RequestCollapse);
    this.collapseFallback = setTimeout(() => this.setMode('collapsed'), COLLAPSE_FALLBACK_MS);
  }

  /** Las zonas transparentes dejan pasar el clic a las ventanas de abajo. */
  setPassthrough(enabled: boolean): void {
    if (!this.window || enabled === this.passthrough) return;
    this.passthrough = enabled;
    // `forward` sigue entregando el movimiento del mouse para saber cuándo vuelve al panel.
    this.window.setIgnoreMouseEvents(enabled, { forward: true });
  }

  private clearCollapseFallback(): void {
    if (this.collapseFallback) clearTimeout(this.collapseFallback);
    this.collapseFallback = null;
  }

  /** Abre el panel y le enfoca el teclado (atajo global, bandeja, notificación). */
  reveal(): void {
    if (this.mode === 'collapsed') this.setMode('list');
    this.window?.show();
    this.window?.focus();
  }

  toggle(): void {
    if (this.mode === 'collapsed') this.reveal();
    else this.requestCollapse();
  }

  openNote(noteId: string): void {
    this.reveal();
    // Primero el id y luego el cambio de estado: así el renderer nunca ve 'sheet' sin nota.
    this.window?.webContents.send(IpcChannels.OpenNote, noteId);
    this.setMode('sheet');
  }

  startNewNote(): void {
    this.reveal();
    this.window?.webContents.send(IpcChannels.NewNote);
  }

  isPinned(): boolean {
    return this.settings.get('pinned');
  }

  setPinned(pinned: boolean): void {
    this.settings.set('pinned', pinned);
  }

  /** Pantallas disponibles, en orden de izquierda a derecha. */
  listDisplays(): DisplayOption[] {
    const primaryId = screen.getPrimaryDisplay().id;
    return EdgeWindowManager.sortedDisplays().map((display, index) => {
      const { width, height } = display.size;
      const name = display.label || `Pantalla ${index + 1}`;
      return {
        id: display.id,
        label: `${name} (${width}×${height})${display.id === primaryId ? ', principal' : ''}`,
      };
    });
  }

  /** Pantalla elegida por el usuario, o null si está en automático. */
  getChosenDisplayId(): number | null {
    return this.settings.get('displayId');
  }

  setDisplay(displayId: number | null): void {
    this.settings.set('displayId', displayId);
    this.applyBounds();
  }

  /**
   * Coloca la ventana y verifica dónde quedó. En Windows, mover una ventana a
   * un monitor con otra escala (p. ej. 125 % → 100 %) hace que Electron
   * calcule mal tamaño y posición en el primer intento; se aplica de nuevo y,
   * si aun así queda fuera de todas las pantallas, se usa la principal.
   */
  private applyBounds(): void {
    const win = this.window;
    if (!win) return;
    const target = this.targetDisplay();
    let wanted = this.boundsFor(this.mode, target);
    win.setBounds(wanted);
    if (!EdgeWindowManager.sameBounds(win.getBounds(), wanted)) win.setBounds(wanted);

    if (!EdgeWindowManager.isOnScreen(win.getBounds())) {
      wanted = this.boundsFor(this.mode, screen.getPrimaryDisplay());
      win.setBounds(wanted);
      win.setBounds(wanted);
    }
    this.logPlacement(target, wanted, win.getBounds());
  }

  private static sameBounds(a: Electron.Rectangle, b: Electron.Rectangle): boolean {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  }

  /** ¿Al menos 4 px de la ventana caen dentro de alguna pantalla? */
  private static isOnScreen(bounds: Electron.Rectangle): boolean {
    return screen.getAllDisplays().some(({ bounds: d }) => {
      const overlapX = Math.min(bounds.x + bounds.width, d.x + d.width) - Math.max(bounds.x, d.x);
      const overlapY = Math.min(bounds.y + bounds.height, d.y + d.height) - Math.max(bounds.y, d.y);
      return overlapX >= 4 && overlapY >= 4;
    });
  }

  /** Registro de posicionamiento para diagnosticar problemas con varios monitores. */
  private logPlacement(target: Display, wanted: Electron.Rectangle, actual: Electron.Rectangle): void {
    const displays = screen
      .getAllDisplays()
      .map((d) => `  id=${d.id} "${d.label}" bounds=${JSON.stringify(d.bounds)} escala=${d.scaleFactor}`)
      .join('\n');
    const line =
      `${new Date().toISOString()} modo=${this.mode} destino=${target.id}\n` +
      `  pedido=${JSON.stringify(wanted)} real=${JSON.stringify(actual)}\n${displays}\n`;
    try {
      appendFileSync(join(app.getPath('logs'), 'window.log'), line);
    } catch {
      // El registro es solo diagnóstico; nunca debe impedir mostrar la ventana.
    }
  }

  /**
   * La elegida si sigue conectada; si no, la del extremo derecho del
   * escritorio. Con monitores extendidos, el borde derecho de la pantalla
   * principal puede quedar en medio y la pestaña no serviría como borde.
   */
  private targetDisplay(): Display {
    const displays = EdgeWindowManager.sortedDisplays();
    const chosen = displays.find((d) => d.id === this.settings.get('displayId'));
    return chosen ?? displays[displays.length - 1] ?? screen.getPrimaryDisplay();
  }

  /** Ordena por el borde derecho; en empate, la que está más arriba. */
  private static sortedDisplays(): Display[] {
    return [...screen.getAllDisplays()].sort(
      (a, b) =>
        a.bounds.x + a.bounds.width - (b.bounds.x + b.bounds.width) || a.bounds.y - b.bounds.y,
    );
  }

  /** Calcula la posición contra el área útil (sin la barra de tareas) de la pantalla destino. */
  private boundsFor(mode: EdgeMode, display: Display = this.targetDisplay()): Electron.Rectangle {
    const area = display.workArea;
    const width = WIDTH[mode];
    const height =
      mode === 'collapsed' ? Math.round(area.height * COLLAPSED_HEIGHT_RATIO) : area.height;
    return {
      x: area.x + area.width - width,
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height,
    };
  }

  private loadRenderer(): void {
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (devUrl) void this.window?.loadURL(devUrl);
    else void this.window?.loadFile(join(__dirname, '../renderer/index.html'));
  }
}
