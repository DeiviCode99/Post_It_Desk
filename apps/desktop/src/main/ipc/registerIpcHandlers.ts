import { ipcMain } from 'electron';
import { IpcChannels, type EdgeMode } from '../../shared/contracts';
import type { BackendConfig } from '../../shared/contracts';
import type { EdgeWindowManager } from '../window/EdgeWindowManager';

const VALID_MODES: ReadonlySet<EdgeMode> = new Set(['collapsed', 'list', 'sheet']);

/** Puente entre el renderer y el proceso principal. Valida todo lo que llega. */
export function registerIpcHandlers(backendReady: Promise<BackendConfig>, windows: EdgeWindowManager): void {
  // El renderer espera aquí mientras el backend termina de arrancar.
  ipcMain.handle(IpcChannels.GetBackendConfig, () => backendReady);

  ipcMain.handle(IpcChannels.SetMode, (_event, mode: unknown) => {
    if (typeof mode === 'string' && VALID_MODES.has(mode as EdgeMode)) {
      windows.setMode(mode as EdgeMode);
    }
    return windows.getMode();
  });

  ipcMain.handle(IpcChannels.GetPinned, () => windows.isPinned());

  ipcMain.on(IpcChannels.SetPassthrough, (_event, enabled: unknown) => {
    windows.setPassthrough(enabled === true);
  });

  ipcMain.handle(IpcChannels.SetPinned, (_event, pinned: unknown) => {
    windows.setPinned(pinned === true);
    return windows.isPinned();
  });
}
