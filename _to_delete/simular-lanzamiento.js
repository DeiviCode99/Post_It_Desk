/**
 * Diagnóstico: lanza el backend empaquetado con las MISMAS opciones que usa
 * la app (spawn con tuberías, windowsHide, ELECTRON_RUN_AS_NODE) y espera a
 * que responda. Si esto funciona y la app no, el problema está en el proceso
 * principal de Electron y no en cómo se lanza el backend.
 *
 * Uso: Postit Desk.exe (con ELECTRON_RUN_AS_NODE=1) simular-lanzamiento.js <ruta main.js> <ruta db>
 */
const { spawn } = require('child_process');
const { get } = require('http');
const path = require('path');

const [entry, dbPath] = process.argv.slice(2);
const port = 47000 + Math.floor(Math.random() * 1000);
const started = Date.now();
const seconds = () => ((Date.now() - started) / 1000).toFixed(1);

const child = spawn(process.execPath, [entry], {
  cwd: path.dirname(path.dirname(entry)),
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NO_COLOR: '1', PORT: String(port), API_TOKEN: 'x', DB_PATH: dbPath },
});
let lines = 0;
child.stdout.on('data', (c) => { lines += String(c).split('\n').length; });
child.stderr.on('data', (c) => process.stdout.write(`[stderr] ${c}`));
child.on('exit', (code) => { console.log(`El backend se cerró con código ${code} a los ${seconds()} s`); process.exit(1); });

const probe = () =>
  get(`http://127.0.0.1:${port}/api/health`, (res) => {
    console.log(`RESPONDIO ${res.statusCode} a los ${seconds()} s (líneas de salida recibidas: ${lines})`);
    child.kill();
    process.exit(0);
  }).on('error', () => {
    if (Date.now() - started > 45_000) {
      console.log(`NO RESPONDIO en 45 s (líneas de salida recibidas: ${lines})`);
      child.kill();
      process.exit(1);
    }
    setTimeout(probe, 300);
  });
probe();
