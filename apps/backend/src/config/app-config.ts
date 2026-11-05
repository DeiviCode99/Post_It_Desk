import { Inject, Injectable, Optional } from '@nestjs/common';
import { homedir } from 'os';
import { join } from 'path';

/** Valores de configuración del backend. */
export interface AppConfigValues {
  port: number;
  host: string;
  /** Token compartido con el cliente; vacío desactiva la protección (solo desarrollo). */
  apiToken: string;
  databasePath: string;
}

/** Token de inyección para pasar valores explícitos (lo usa Electron al embeber el backend). */
export const APP_CONFIG_VALUES = Symbol('APP_CONFIG_VALUES');

/**
 * Configuración del backend. Toma los valores explícitos si se proporcionan
 * (backend embebido en Electron) y, si no, variables de entorno (modo
 * independiente con `npm start`), con valores por defecto razonables.
 */
@Injectable()
export class AppConfig implements AppConfigValues {
  readonly port: number;
  readonly host: string;
  readonly apiToken: string;
  readonly databasePath: string;

  constructor(@Optional() @Inject(APP_CONFIG_VALUES) values?: Partial<AppConfigValues>) {
    this.port = values?.port ?? Number(process.env.PORT ?? 4317);
    this.host = values?.host ?? '127.0.0.1';
    this.apiToken = values?.apiToken ?? process.env.API_TOKEN ?? '';
    this.databasePath =
      values?.databasePath ?? process.env.DB_PATH ?? join(homedir(), '.postit-desk', 'postit-desk.sqlite');
  }
}
