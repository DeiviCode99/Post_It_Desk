import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IpcChannels, type BackendConfig, type EdgeMode } from '../shared/contracts';

/** Suscribe un callback y devuelve la función para cancelar la suscripción. */
function subscribe<T extends unknown[]>(channel: string, callback: (...args: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...(args as T));
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

/**
 * API mínima expuesta al renderer. Nada de Node llega a React: solo estas
 * funciones, que pasan por los handlers validados del proceso principal.
 */
const bridge = {
  getBackendConfig: (): Promise<BackendConfig> => ipcRenderer.invoke(IpcChannels.GetBackendConfig),
  setMode: (mode: EdgeMode): Promise<EdgeMode> => ipcRenderer.invoke(IpcChannels.SetMode, mode),
  getPinned: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.GetPinned),
  setPinned: (pinned: boolean): Promise<boolean> => ipcRenderer.invoke(IpcChannels.SetPinned, pinned),
  /** Se envía sin esperar respuesta: ocurre en cada movimiento del mouse. */
  setPassthrough: (enabled: boolean): void => ipcRenderer.send(IpcChannels.SetPassthrough, enabled),
  onRequestCollapse: (callback: () => void) => subscribe<[]>(IpcChannels.RequestCollapse, callback),
  onModeChanged: (callback: (mode: EdgeMode) => void) =>
    subscribe<[EdgeMode]>(IpcChannels.ModeChanged, callback),
  onOpenNote: (callback: (noteId: string) => void) =>
    subscribe<[string]>(IpcChannels.OpenNote, callback),
  onNewNote: (callback: () => void) => subscribe<[]>(IpcChannels.NewNote, callback),
};

export type DesktopBridge = typeof bridge;

contextBridge.exposeInMainWorld('desktop', bridge);
