import { app } from 'electron';
import type { SettingsStore } from './SettingsStore';

/**
 * Inicio automático con Windows. Solo aplica a la app instalada: en desarrollo
 * registraría el ejecutable de Electron en vez de Postit Desk.
 */
export class AutoLaunch {
  constructor(private readonly settings: SettingsStore) {}

  get supported(): boolean {
    return app.isPackaged;
  }

  isEnabled(): boolean {
    return this.supported && app.getLoginItemSettings().openAtLogin;
  }

  setEnabled(enabled: boolean): void {
    if (!this.supported) return;
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
  }

  /** La primera ejecución instalada lo activa; después manda lo que elija el usuario. */
  enableOnFirstRun(): void {
    if (!this.supported || this.settings.get('autoLaunchInitialized')) return;
    this.setEnabled(true);
    this.settings.set('autoLaunchInitialized', true);
  }
}
