/**
 * Hook `afterPack` de electron-builder: copia el backend preparado por
 * stage-backend.mjs dentro de resources/backend de la app empaquetada.
 *
 * No se usa `extraResources` porque electron-builder 26 omite las carpetas
 * node_modules al copiar recursos extra, y el backend las necesita para
 * arrancar (sin ellas falla con "Cannot find module 'reflect-metadata'").
 * Este paso corre antes de crear el instalador, así que queda incluido.
 */
const { cpSync, existsSync, rmSync } = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const staging = path.join(__dirname, '..', '.backend-staging');
  const required = path.join(staging, 'node_modules', 'reflect-metadata');
  if (!existsSync(required)) {
    throw new Error(`Backend sin preparar: falta ${required}. Ejecuta node scripts/stage-backend.mjs.`);
  }

  // En Windows y Linux los recursos viven en <app>/resources.
  const target = path.join(context.appOutDir, 'resources', 'backend');
  rmSync(target, { recursive: true, force: true });
  cpSync(staging, target, { recursive: true });

  if (!existsSync(path.join(target, 'node_modules', 'reflect-metadata'))) {
    throw new Error('La copia del backend quedó incompleta.');
  }
  console.log(`  • backend copiado con sus dependencias a ${target}`);
};
