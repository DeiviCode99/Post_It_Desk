import { Logger } from '@nestjs/common';
import { startServer } from './server';

/** Modo independiente (`npm start`): configuración desde variables de entorno. */
startServer()
  .then((server) => {
    Logger.log(`Backend listo en ${server.url}`, 'Bootstrap');
    // Cierre ordenado (base de datos incluida) al detener el proceso.
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => void server.close().then(() => process.exit(0)));
    }
  })
  .catch((error) => {
    Logger.error(error, 'Bootstrap');
    process.exit(1);
  });
