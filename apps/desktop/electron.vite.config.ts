import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

/**
 * Tres compilaciones separadas: proceso principal, preload y renderer (React).
 * main y preload no usan paquetes de npm (solo `electron` y módulos de Node),
 * así que no necesitan configuración adicional de dependencias externas.
 */
export default defineConfig({
  main: {},
  preload: {},
  renderer: { plugins: [react()] },
});
