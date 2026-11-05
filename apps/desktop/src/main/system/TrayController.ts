import { Menu, Tray, nativeImage, screen, type MenuItemConstructorOptions } from 'electron';
import type { EdgeWindowManager } from '../window/EdgeWindowManager';
import type { AutoLaunch } from './AutoLaunch';

/** Icono en la bandeja de Windows: mostrar, crear nota, inicio automático y salir. */
export class TrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly iconPath: string,
    private readonly windows: EdgeWindowManager,
    private readonly autoLaunch: AutoLaunch,
    private readonly onQuit: () => void,
  ) {}

  create(): void {
    this.tray = new Tray(nativeImage.createFromPath(this.iconPath));
    this.tray.setToolTip('Postit Desk');
    this.tray.on('click', () => this.windows.toggle());
    // La lista de pantallas del menú cambia al conectar o desconectar monitores.
    screen.on('display-added', () => this.refreshMenu());
    screen.on('display-removed', () => this.refreshMenu());
    this.refreshMenu();
  }

  /** Submenú para elegir en qué pantalla vive la pestaña. */
  private displayMenu(): MenuItemConstructorOptions[] {
    const chosen = this.windows.getChosenDisplayId();
    const displays = this.windows.listDisplays();
    const chosenExists = displays.some((d) => d.id === chosen);
    return [
      {
        label: 'Automática (la de más a la derecha)',
        type: 'radio',
        checked: chosen === null || !chosenExists,
        click: () => this.chooseDisplay(null),
      },
      { type: 'separator' },
      ...displays.map(
        (display): MenuItemConstructorOptions => ({
          label: display.label,
          type: 'radio',
          checked: display.id === chosen,
          click: () => this.chooseDisplay(display.id),
        }),
      ),
    ];
  }

  private chooseDisplay(displayId: number | null): void {
    this.windows.setDisplay(displayId);
    this.refreshMenu();
  }

  /** Se reconstruye el menú para reflejar el estado actual de las casillas. */
  private refreshMenu(): void {
    this.tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Mostrar notas', click: () => this.windows.reveal() },
        { label: 'Nueva nota', click: () => this.windows.startNewNote() },
        { type: 'separator' },
        { label: 'Pantalla', submenu: this.displayMenu() },
        {
          label: 'Iniciar con Windows',
          type: 'checkbox',
          enabled: this.autoLaunch.supported,
          checked: this.autoLaunch.isEnabled(),
          click: (item) => {
            this.autoLaunch.setEnabled(item.checked);
            this.refreshMenu();
          },
        },
        { type: 'separator' },
        { label: 'Salir', click: this.onQuit },
      ]),
    );
  }
}
