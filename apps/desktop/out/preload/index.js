"use strict";
const electron = require("electron");
const IpcChannels = {
  GetBackendConfig: "backend:get-config",
  SetMode: "window:set-mode",
  ModeChanged: "window:mode-changed",
  GetPinned: "window:get-pinned",
  SetPinned: "window:set-pinned",
  SetPassthrough: "window:set-passthrough",
  RequestCollapse: "window:request-collapse",
  OpenNote: "notes:open",
  NewNote: "notes:new"
};
function subscribe(channel, callback) {
  const listener = (_event, ...args) => callback(...args);
  electron.ipcRenderer.on(channel, listener);
  return () => {
    electron.ipcRenderer.removeListener(channel, listener);
  };
}
const bridge = {
  getBackendConfig: () => electron.ipcRenderer.invoke(IpcChannels.GetBackendConfig),
  setMode: (mode) => electron.ipcRenderer.invoke(IpcChannels.SetMode, mode),
  getPinned: () => electron.ipcRenderer.invoke(IpcChannels.GetPinned),
  setPinned: (pinned) => electron.ipcRenderer.invoke(IpcChannels.SetPinned, pinned),
  /** Se envía sin esperar respuesta: ocurre en cada movimiento del mouse. */
  setPassthrough: (enabled) => electron.ipcRenderer.send(IpcChannels.SetPassthrough, enabled),
  onRequestCollapse: (callback) => subscribe(IpcChannels.RequestCollapse, callback),
  onModeChanged: (callback) => subscribe(IpcChannels.ModeChanged, callback),
  onOpenNote: (callback) => subscribe(IpcChannels.OpenNote, callback),
  onNewNote: (callback) => subscribe(IpcChannels.NewNote, callback)
};
electron.contextBridge.exposeInMainWorld("desktop", bridge);
