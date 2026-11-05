/** Estados de la ventana lateral: franja oculta, lista de notas o lista + hoja abierta. */
export type EdgeMode = 'collapsed' | 'list' | 'sheet';

/** Datos que el renderer necesita para hablar con el backend. */
export interface BackendConfig {
  baseUrl: string;
  token: string;
}

/** Canales IPC en un solo lugar para que main y preload no se desincronicen. */
export const IpcChannels = {
  GetBackendConfig: 'backend:get-config',
  SetMode: 'window:set-mode',
  ModeChanged: 'window:mode-changed',
  GetPinned: 'window:get-pinned',
  SetPinned: 'window:set-pinned',
  SetPassthrough: 'window:set-passthrough',
  RequestCollapse: 'window:request-collapse',
  OpenNote: 'notes:open',
  NewNote: 'notes:new',
} as const;
