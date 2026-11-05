import { randomBytes } from 'crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { createServer } from 'net';
import { dirname } from 'path';
import type { BackendConfig } from '../../shared/contracts';

/**
 * Contrato del módulo `server.js` del backend (apps/backend/src/server.ts).
 * Se repite aquí porque el backend es un proyecto aparte y se carga en
 * tiempo de ejecución, no en la compilación del escritorio.
 */
interface BackendModule {
  startServer(
    config: { port: number; host: string; apiToken: string; databasePath: string },
    logger?: Array<'error' | 'warn' | 'log'>,
  ): Promise<{ url: string; close(): Promise<void> }>;
}

export interface EmbeddedBackendOptions {
  /** Ruta al `dist/server.js` compilado del backend NestJS. */
  entryPath: string;
  /** Archivo SQLite donde viven las notas. */
  databasePath: string;
  /** Registro de arranque y errores del backend. */
  logPath: string;
}

/**
 * Ejecuta el backend NestJS dentro del proceso principal de Electron.
 *
 * Frontend y backend siguen separados: se comunican solo por la API HTTP
 * local, protegida con un token aleatorio. Se evita un proceso hijo porque,
 * en la app instalada en Windows, los procesos hijos de Electron quedaban
 * bloqueados antes de ejecutar código (ver scripts/reconstruir-y-verificar.ps1).
 */
export class EmbeddedBackend {
  private server: { url: string; close(): Promise<void> } | null = null;
  private config: BackendConfig | null = null;

  constructor(private readonly options: EmbeddedBackendOptions) {}

  async start(): Promise<BackendConfig> {
    mkdirSync(dirname(this.options.logPath), { recursive: true });
    writeFileSync(this.options.logPath, '');

    const port = await EmbeddedBackend.findFreePort();
    const token = randomBytes(24).toString('hex');
    this.write(`Cargando ${this.options.entryPath} en el puerto ${port}`);

    try {
      // createRequire: carga el backend con la resolución de módulos de Node,
      // así encuentra su propio node_modules junto a `dist/`.
      const backend = createRequire(__filename)(this.options.entryPath) as BackendModule;
      this.server = await backend.startServer(
        { port, host: '127.0.0.1', apiToken: token, databasePath: this.options.databasePath },
        ['error', 'warn'],
      );
    } catch (error) {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      this.write(`Error al iniciar el backend:\n${detail}`);
      throw new Error(`El backend no pudo iniciar.\n\n${detail}\n\nRegistro: ${this.options.logPath}`);
    }

    this.write(`Backend listo en ${this.server.url}`);
    this.config = { baseUrl: this.server.url, token };
    return this.config;
  }

  /** Cierra el servidor HTTP y la base de datos. */
  async stop(): Promise<void> {
    await this.server?.close();
    this.server = null;
  }

  getConfig(): BackendConfig {
    if (!this.config) throw new Error('El backend aún no ha arrancado');
    return this.config;
  }

  private write(line: string): void {
    appendFileSync(this.options.logPath, `${new Date().toISOString()} ${line}\n`);
  }

  /** Pide al sistema un puerto libre para no chocar con otros programas. */
  private static findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        server.close(() => resolve(port));
      });
    });
  }
}
