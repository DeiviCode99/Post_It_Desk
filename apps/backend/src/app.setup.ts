import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Orígenes del renderer: Vite en desarrollo y `file://` (origen "null") empaquetado. */
const ALLOWED_ORIGINS = new Set(['null', 'http://localhost:5173']);

/** Permite peticiones sin origen (procesos locales) o desde el renderer de Electron. */
function allowRendererOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  callback(null, !origin || ALLOWED_ORIGINS.has(origin));
}

/**
 * Configuración HTTP compartida entre `main.ts` y los tests, para que ambos
 * validen y serialicen exactamente igual.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableCors({ origin: allowRendererOrigin });
  return app;
}
