/**
 * Prepara la copia del backend que va dentro del instalador: el código
 * compilado más SOLO las dependencias de producción. Sin esto se empaquetaban
 * también Jest, TypeScript y demás herramientas de desarrollo (miles de
 * archivos que el antivirus revisa en el primer arranque).
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = join(desktopDir, '..', 'backend');
const stagingDir = join(desktopDir, '.backend-staging');

if (!existsSync(join(backendDir, 'dist', 'main.js'))) {
  console.error('Falta apps/backend/dist. Compila primero: npm run build:backend (desde la raíz).');
  process.exit(1);
}
if (!existsSync(join(backendDir, 'package-lock.json'))) {
  console.error('Falta apps/backend/package-lock.json. Ejecuta npm install en apps/backend.');
  process.exit(1);
}

rmSync(stagingDir, { recursive: true, force: true });
cpSync(join(backendDir, 'dist'), join(stagingDir, 'dist'), { recursive: true });
for (const file of ['package.json', 'package-lock.json']) {
  cpSync(join(backendDir, file), join(stagingDir, file));
}

console.log('Instalando dependencias de producción del backend…');
execSync('npm ci --omit=dev --no-audit --no-fund', { cwd: stagingDir, stdio: 'inherit' });
if (!existsSync(join(stagingDir, 'node_modules', 'reflect-metadata'))) {
  console.error('npm ci terminó sin instalar las dependencias del backend.');
  process.exit(1);
}
console.log(`Backend listo para empaquetar en ${stagingDir}`);
