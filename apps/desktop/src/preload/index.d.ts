import type { DesktopBridge } from './index';

declare global {
  interface Window {
    /** Puente seguro hacia el proceso principal de Electron (ver preload/index.ts). */
    desktop: DesktopBridge;
  }
}
