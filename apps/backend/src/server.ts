import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig, type AppConfigValues } from './config/app-config';

/** Servidor en ejecución, con su URL base y la forma de detenerlo. */
export interface RunningServer {
  url: string;
  close(): Promise<void>;
}

/**
 * Punto de entrada reutilizable del backend. Lo usan `main.ts` (modo
 * independiente) y Electron, que lo carga dentro de su proceso principal en
 * vez de lanzar un proceso aparte.
 */
export async function startServer(
  config: Partial<AppConfigValues> = {},
  logger: Array<'error' | 'warn' | 'log'> = ['error', 'warn', 'log'],
): Promise<RunningServer> {
  const app = configureApp(await NestFactory.create(AppModule.forRoot(config), { logger }));
  const { port, host } = app.get(AppConfig);
  await app.listen(port, host);
  return { url: `http://${host}:${port}/api`, close: () => app.close() };
}
