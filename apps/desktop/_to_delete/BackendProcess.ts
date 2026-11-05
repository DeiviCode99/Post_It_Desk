import { spawn, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'fs';
import { get } from 'http';
import { createServer } from 'net';
import { dirname } from 'path';
import type { BackendConfig } from '../../shared/contracts';

export interface BackendProcessOptions {
  /** Ruta al `dist/main.js` compilado del backend NestJS. */
  entryPath: string;
  /** Archivo SQLite donde viven las notas. */
  databasePath: string;
  /** Archivo donde se guarda todo lo que imprime el backend, para diagnosticar fallos. */
  logPath: string;
  /** Repetir la salida del backend en la consola (útil en desarrollo). */
  echoToConsole?: boolean;
  /** Si es true no se lanza nada: se asume un backend ya corriendo en `externalPort`. */
  external?: boolean;
  externalPort?: number;
}

/** Margen amplio: en el primer arranque el antivirus puede revisar cada archivo del backend. */
const STARTUP_TIMEOUT_MS = 45_000;
/** Líneas finales del registro que se muestran al usuario si el backend falla. */
const TAIL_LINES = 14;

/**
 * Ciclo de vida del backend: lo lanza como proceso hijo, espera a que responda
 * en /api/health y lo detiene al cerrar la app. Toda su salida queda en un
 * archivo de registro para poder diagnosticar fallos.
 *
 * Se usa el propio ejecutable de Electron en modo Node (ELECTRON_RUN_AS_NODE)
 * y no `utilityProcess.fork`: con utilityProcess el backend empaquetado se
 * quedaba colgado sin imprimir nada en Windows, mientras que en modo Node
 * arranca en ~2 s (verificado con scripts/reconstruir-y-verificar.ps1).
 */
export class BackendProcess {
  private child: ChildProcess | null = null;
  private config: BackendConfig | null = null;
  private exitCode: number | null = null;

  constructor(private readonly options: BackendProcessOptions) {}

  async start(): Promise<BackendConfig> {
    const port = this.options.external
      ? (this.options.externalPort ?? 4317)
      : await BackendProcess.findFreePort();
    const token = this.options.external ? '' : randomBytes(24).toString('hex');

    if (!this.options.external) this.spawn(port, token);

    this.config = { baseUrl: `http://127.0.0.1:${port}/api`, token };
    await this.waitUntilHealthy();
    return this.config;
  }

  stop(): void {
    this.child?.kill();
    this.child = null;
  }

  getConfig(): BackendConfig {
    if (!this.config) throw new Error('El backend aún no ha arrancado');
    return this.config;
  }

  private spawn(port: number, token: string): void {
    mkdirSync(dirname(this.options.logPath), { recursive: true });
    writeFileSync(this.options.logPath, '');
    this.write(`Iniciando ${this.options.entryPath} en el puerto ${port}\n`);
    // Solo nombres (no valores) de variables que podrían alterar al proceso hijo.
    const relevant = Object.keys(process.env).filter((k) => /^(ELECTRON|NODE|CHROME)/i.test(k));
    this.write(`Ejecutable: ${process.execPath}\nVariables heredadas relevantes: ${relevant.join(', ') || 'ninguna'}\n`);

    // La salida del backend va directo al archivo de registro (modo "append").
    // En Windows escribir a un archivo es síncrono: aunque el backend se
    // atasque, lo que alcanzó a imprimir queda guardado. Con tuberías, en
    // cambio, la salida pendiente se pierde si el proceso se bloquea.
    const logFd = openSync(this.options.logPath, 'a');
    this.child = spawn(process.execPath, [this.options.entryPath], {
      cwd: dirname(dirname(this.options.entryPath)),
      stdio: ['ignore', logFd, logFd],
      windowsHide: true, // Sin ventana de consola en Windows.
      env: {
        ...BackendProcess.inheritedEnv(),
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        NO_COLOR: '1', // Registro legible, sin códigos de color de la terminal.
        PORT: String(port),
        API_TOKEN: token,
        DB_PATH: this.options.databasePath,
      },
    });
    closeSync(logFd); // El hijo conserva su propia copia del descriptor.
    this.child.on('spawn', () => this.write(`Proceso del backend lanzado (pid ${this.child?.pid})\n`));
    this.child.on('error', (error) => {
      this.exitCode = -1;
      this.write(`No se pudo lanzar el backend: ${error.message}\n`);
    });
    this.child.on('exit', (code, signal) => {
      this.exitCode = code ?? -1;
      this.write(`El backend terminó (código ${code ?? '-'}, señal ${signal ?? '-'})\n`);
    });
  }

  /** Agrega una línea de la propia app al registro del backend. */
  private write(text: string): void {
    appendFileSync(this.options.logPath, text);
    if (this.options.echoToConsole) process.stdout.write(`[backend] ${text}`);
  }

  /** Últimas líneas del registro, incluida la salida del backend. */
  private logTail(): string[] {
    try {
      return readFileSync(this.options.logPath, 'utf8').split(/\r?\n/).filter(Boolean).slice(-TAIL_LINES);
    } catch {
      return [];
    }
  }

  /**
   * Reintenta el chequeo de salud; falla de inmediato si el proceso ya se
   * cerró. Registra por qué falla cada intento (cada pocos segundos) para
   * distinguir "el backend no escucha" de "la app no logra conectarse".
   */
  private async waitUntilHealthy(): Promise<void> {
    const started = Date.now();
    const deadline = started + STARTUP_TIMEOUT_MS;
    const url = `${this.getConfig().baseUrl}/health`;
    let lastLogged = 0;

    while (Date.now() < deadline) {
      if (this.exitCode !== null) throw this.startupError(`se cerró con código ${this.exitCode}`);
      const result = await BackendProcess.probe(url);
      if (result === 200) {
        this.write(`Backend disponible tras ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
        return;
      }
      if (Date.now() - lastLogged > 5_000) {
        lastLogged = Date.now();
        this.write(`Chequeo de salud: ${result} (proceso vivo: ${this.isAlive()})\n`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw this.startupError(`no respondió en ${STARTUP_TIMEOUT_MS / 1000} s`);
  }

  /**
   * Entorno del proceso principal sin las variables internas de Chromium.
   * CHROME_CRASHPAD_PIPE_NAME apunta al canal de reportes de fallos del
   * proceso padre; si el hijo la hereda, Electron en modo Node intenta
   * conectarse a ese canal y se queda colgado antes de ejecutar el backend.
   */
  private static inheritedEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    delete env.CHROME_CRASHPAD_PIPE_NAME;
    return env;
  }

  private isAlive(): boolean {
    return this.child !== null && this.child.exitCode === null && !this.child.killed;
  }

  /**
   * Petición HTTP directa con el módulo `http` de Node. Devuelve 200 si
   * responde bien o el motivo del fallo en texto.
   */
  private static probe(url: string): Promise<number | string> {
    return new Promise((resolve) => {
      const request = get(url, { timeout: 2_000 }, (response) => {
        response.resume();
        resolve(response.statusCode ?? 'sin código');
      });
      request.on('timeout', () => request.destroy(new Error('tiempo agotado')));
      request.on('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? error.message));
    });
  }

  /** Mensaje con la causa visible: últimas líneas del backend y dónde está el registro completo. */
  private startupError(reason: string): Error {
    const lines = this.logTail();
    const tail = lines.length ? `\n\nÚltimos mensajes:\n${lines.join('\n')}` : '';
    return new Error(`El backend ${reason}.${tail}\n\nRegistro completo: ${this.options.logPath}`);
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
