import { app, dialog, globalShortcut } from 'electron';
import { join } from 'path';
import { ApiClient } from './backend/ApiClient';
import { EmbeddedBackend } from './backend/EmbeddedBackend';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import { ReminderNotifier } from './reminders/ReminderNotifier';
import { AutoLaunch } from './system/AutoLaunch';
import { SettingsStore } from './system/SettingsStore';
import { TrayController } from './system/TrayController';
import { EdgeWindowManager } from './window/EdgeWindowManager';

const TOGGLE_SHORTCUT = 'Control+Alt+N';

/**
 * Orquesta el arranque: backend → ventana lateral → bandeja → recordatorios.
 * Cada pieza es una clase con una sola responsabilidad; aquí solo se conectan.
 */
class DesktopApp {
  private readonly settings = new SettingsStore();
  private readonly windows = new EdgeWindowManager(this.settings);
  private readonly autoLaunch = new AutoLaunch(this.settings);
  private readonly backend = new EmbeddedBackend({
    entryPath: app.isPackaged
      ? join(process.resourcesPath, 'backend', 'dist', 'server.js')
      : join(app.getAppPath(), '..', 'backend', 'dist', 'server.js'),
    databasePath: join(app.getPath('userData'), 'postit-desk.sqlite'),
    logPath: join(app.getPath('logs'), 'backend.log'),
  });
  private notifier: ReminderNotifier | null = null;

  async start(): Promise<void> {
    app.setAppUserModelId('com.david.postitdesk'); // Necesario para notificaciones en Windows.
    this.autoLaunch.enableOnFirstRun();

    // La ventana aparece de inmediato; el backend arranca en paralelo (en el
    // primer inicio el antivirus puede demorarlo un minuto).
    const backendReady = this.backend.start();
    backendReady.catch(() => undefined); // El error se maneja abajo, al esperarlo.
    registerIpcHandlers(backendReady, this.windows);
    this.windows.create();
    const config = await backendReady;

    new TrayController(this.resourcePath('tray.png'), this.windows, this.autoLaunch, () =>
      app.quit(),
    ).create();

    this.notifier = new ReminderNotifier(new ApiClient(config), (id) => this.windows.openNote(id));
    this.notifier.start();

    globalShortcut.register(TOGGLE_SHORTCUT, () => this.windows.toggle());
  }

  /** Si el usuario abre la app otra vez, se muestra la ya abierta. */
  focusExisting(): void {
    this.windows.reveal();
  }

  shutdown(): Promise<void> {
    globalShortcut.unregisterAll();
    this.notifier?.stop();
    return this.backend.stop();
  }

  private resourcePath(file: string): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'resources', file)
      : join(app.getAppPath(), 'resources', file);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const desktop = new DesktopApp();

  app.on('second-instance', () => desktop.focusExisting());
  // Al salir se espera a que el backend cierre la base de datos.
  let quitting = false;
  app.on('will-quit', (event) => {
    if (quitting) return;
    quitting = true;
    event.preventDefault();
    void desktop.shutdown().finally(() => app.quit());
  });
  // La app vive en la bandeja: cerrar la ventana no la termina.
  app.on('window-all-closed', () => undefined);

  app
    .whenReady()
    .then(() => desktop.start())
    .catch((error: Error) => {
      dialog.showErrorBox('Postit Desk no pudo iniciar', error.message);
      app.quit();
    });
}
