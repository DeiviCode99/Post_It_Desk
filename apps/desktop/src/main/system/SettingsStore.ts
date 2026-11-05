import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Preferencias locales de la app de escritorio (no son datos de notas). */
export interface DesktopSettings {
  /** Se activa la primera vez que corre empaquetada para no pisar la elección del usuario. */
  autoLaunchInitialized: boolean;
  pinned: boolean;
  /** Pantalla elegida por el usuario; null = automática (la del extremo derecho). */
  displayId: number | null;
}

const DEFAULTS: DesktopSettings = { autoLaunchInitialized: false, pinned: false, displayId: null };

/** Guarda las preferencias en un JSON dentro de la carpeta de datos de la app. */
export class SettingsStore {
  private readonly filePath = join(app.getPath('userData'), 'settings.json');
  private data: DesktopSettings = this.read();

  get<K extends keyof DesktopSettings>(key: K): DesktopSettings[K] {
    return this.data[key];
  }

  set<K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]): void {
    this.data = { ...this.data, [key]: value };
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  private read(): DesktopSettings {
    if (!existsSync(this.filePath)) return { ...DEFAULTS };
    try {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(this.filePath, 'utf8')) };
    } catch {
      return { ...DEFAULTS }; // Archivo corrupto: se vuelve a los valores por defecto.
    }
  }
}
