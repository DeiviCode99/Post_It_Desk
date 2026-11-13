"use strict";
const electron = require("electron");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const module$1 = require("module");
const net = require("net");
class ApiClient {
  constructor(config) {
    this.config = config;
  }
  config;
  get(path2) {
    return this.request("GET", path2);
  }
  post(path2, body) {
    return this.request("POST", path2, body);
  }
  async request(method, path2, body) {
    const response = await fetch(`${this.config.baseUrl}${path2}`, {
      method,
      headers: { "content-type": "application/json", "x-api-token": this.config.token },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`${method} ${path2} respondió ${response.status}`);
    return response.status === 204 ? void 0 : await response.json();
  }
}
class EmbeddedBackend {
  constructor(options) {
    this.options = options;
  }
  options;
  server = null;
  config = null;
  async start() {
    fs.mkdirSync(path.dirname(this.options.logPath), { recursive: true });
    fs.writeFileSync(this.options.logPath, "");
    const port = await EmbeddedBackend.findFreePort();
    const token = crypto.randomBytes(24).toString("hex");
    this.write(`Cargando ${this.options.entryPath} en el puerto ${port}`);
    try {
      const backend = module$1.createRequire(__filename)(this.options.entryPath);
      this.server = await backend.startServer(
        { port, host: "127.0.0.1", apiToken: token, databasePath: this.options.databasePath },
        ["error", "warn"]
      );
    } catch (error) {
      const detail = error instanceof Error ? error.stack ?? error.message : String(error);
      this.write(`Error al iniciar el backend:
${detail}`);
      throw new Error(`El backend no pudo iniciar.

${detail}

Registro: ${this.options.logPath}`);
    }
    this.write(`Backend listo en ${this.server.url}`);
    this.config = { baseUrl: this.server.url, token };
    return this.config;
  }
  /** Cierra el servidor HTTP y la base de datos. */
  async stop() {
    await this.server?.close();
    this.server = null;
  }
  getConfig() {
    if (!this.config) throw new Error("El backend aún no ha arrancado");
    return this.config;
  }
  write(line) {
    fs.appendFileSync(this.options.logPath, `${(/* @__PURE__ */ new Date()).toISOString()} ${line}
`);
  }
  /** Pide al sistema un puerto libre para no chocar con otros programas. */
  static findFreePort() {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        server.close(() => resolve(port));
      });
    });
  }
}
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
const VALID_MODES = /* @__PURE__ */ new Set(["collapsed", "list", "sheet"]);
function registerIpcHandlers(backendReady, windows) {
  electron.ipcMain.handle(IpcChannels.GetBackendConfig, () => backendReady);
  electron.ipcMain.handle(IpcChannels.SetMode, (_event, mode) => {
    if (typeof mode === "string" && VALID_MODES.has(mode)) {
      windows.setMode(mode);
    }
    return windows.getMode();
  });
  electron.ipcMain.handle(IpcChannels.GetPinned, () => windows.isPinned());
  electron.ipcMain.on(IpcChannels.SetPassthrough, (_event, enabled) => {
    windows.setPassthrough(enabled === true);
  });
  electron.ipcMain.handle(IpcChannels.SetPinned, (_event, pinned) => {
    windows.setPinned(pinned === true);
    return windows.isPinned();
  });
}
class ReminderNotifier {
  constructor(api, onOpenNote, intervalMs = 3e4) {
    this.api = api;
    this.onOpenNote = onOpenNote;
    this.intervalMs = intervalMs;
  }
  api;
  onOpenNote;
  intervalMs;
  timer = null;
  /** Referencias vivas: si el GC recoge la notificación, Windows pierde el clic. */
  visible = /* @__PURE__ */ new Set();
  start() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  async tick() {
    try {
      const due = await this.api.get("/reminders/due");
      for (const note of due) {
        this.show(note);
        await this.api.post(`/reminders/${note.id}/ack`);
      }
    } catch (error) {
      console.error("[recordatorios]", error);
    }
  }
  show(note) {
    const notification = new electron.Notification({
      title: note.title,
      body: note.body.trim().slice(0, 120) || "Tienes esta tarea pendiente."
    });
    notification.on("click", () => this.onOpenNote(note.id));
    notification.on("close", () => this.visible.delete(notification));
    this.visible.add(notification);
    notification.show();
  }
}
class AutoLaunch {
  constructor(settings) {
    this.settings = settings;
  }
  settings;
  get supported() {
    return electron.app.isPackaged;
  }
  isEnabled() {
    return this.supported && electron.app.getLoginItemSettings().openAtLogin;
  }
  setEnabled(enabled) {
    if (!this.supported) return;
    electron.app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
  }
  /** La primera ejecución instalada lo activa; después manda lo que elija el usuario. */
  enableOnFirstRun() {
    if (!this.supported || this.settings.get("autoLaunchInitialized")) return;
    this.setEnabled(true);
    this.settings.set("autoLaunchInitialized", true);
  }
}
const DEFAULTS = { autoLaunchInitialized: false, pinned: false, displayId: null };
class SettingsStore {
  filePath = path.join(electron.app.getPath("userData"), "settings.json");
  data = this.read();
  get(key) {
    return this.data[key];
  }
  set(key, value) {
    this.data = { ...this.data, [key]: value };
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
  read() {
    if (!fs.existsSync(this.filePath)) return { ...DEFAULTS };
    try {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(this.filePath, "utf8")) };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
class TrayController {
  constructor(iconPath, windows, autoLaunch, onQuit) {
    this.iconPath = iconPath;
    this.windows = windows;
    this.autoLaunch = autoLaunch;
    this.onQuit = onQuit;
  }
  iconPath;
  windows;
  autoLaunch;
  onQuit;
  tray = null;
  create() {
    this.tray = new electron.Tray(electron.nativeImage.createFromPath(this.iconPath));
    this.tray.setToolTip("Postit Desk");
    this.tray.on("click", () => this.windows.toggle());
    electron.screen.on("display-added", () => this.refreshMenu());
    electron.screen.on("display-removed", () => this.refreshMenu());
    this.refreshMenu();
  }
  /** Submenú para elegir en qué pantalla vive la pestaña. */
  displayMenu() {
    const chosen = this.windows.getChosenDisplayId();
    const displays = this.windows.listDisplays();
    const chosenExists = displays.some((d) => d.id === chosen);
    return [
      {
        label: "Automática (la de más a la derecha)",
        type: "radio",
        checked: chosen === null || !chosenExists,
        click: () => this.chooseDisplay(null)
      },
      { type: "separator" },
      ...displays.map(
        (display) => ({
          label: display.label,
          type: "radio",
          checked: display.id === chosen,
          click: () => this.chooseDisplay(display.id)
        })
      )
    ];
  }
  chooseDisplay(displayId) {
    this.windows.setDisplay(displayId);
    this.refreshMenu();
  }
  /** Se reconstruye el menú para reflejar el estado actual de las casillas. */
  refreshMenu() {
    this.tray?.setContextMenu(
      electron.Menu.buildFromTemplate([
        { label: "Mostrar notas", click: () => this.windows.reveal() },
        { label: "Nueva nota", click: () => this.windows.startNewNote() },
        { type: "separator" },
        { label: "Pantalla", submenu: this.displayMenu() },
        {
          label: "Iniciar con Windows",
          type: "checkbox",
          enabled: this.autoLaunch.supported,
          checked: this.autoLaunch.isEnabled(),
          click: (item) => {
            this.autoLaunch.setEnabled(item.checked);
            this.refreshMenu();
          }
        },
        { type: "separator" },
        { label: "Salir", click: this.onQuit }
      ])
    );
  }
}
const WIDTH = { collapsed: 16, list: 376, sheet: 860 };
const COLLAPSE_FALLBACK_MS = 600;
const COLLAPSED_HEIGHT_RATIO = 0.22;
class EdgeWindowManager {
  constructor(settings) {
    this.settings = settings;
  }
  settings;
  window = null;
  mode = "collapsed";
  collapseFallback = null;
  passthrough = false;
  create() {
    this.window = new electron.BrowserWindow({
      ...this.boundsFor("collapsed"),
      show: false,
      frame: false,
      thickFrame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      // Transparente: el panel dibuja sus propias esquinas redondeadas y sombra.
      transparent: true,
      backgroundColor: "#00000000",
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    });
    this.window.setAlwaysOnTop(true, "floating");
    this.window.on("blur", () => {
      if (!this.isPinned()) this.requestCollapse();
    });
    this.window.once("ready-to-show", () => {
      this.window?.showInactive();
      this.applyBounds();
    });
    electron.screen.on("display-added", () => this.applyBounds());
    electron.screen.on("display-removed", () => this.applyBounds());
    electron.screen.on("display-metrics-changed", () => this.applyBounds());
    this.loadRenderer();
    return this.window;
  }
  getMode() {
    return this.mode;
  }
  setMode(mode) {
    this.clearCollapseFallback();
    if (!this.window || mode === this.mode) return;
    this.mode = mode;
    if (mode === "collapsed") this.setPassthrough(false);
    this.applyBounds();
    this.window.webContents.send(IpcChannels.ModeChanged, mode);
  }
  /**
   * Repliegue en dos pasos: el renderer anima la salida del panel y luego
   * confirma con setMode('collapsed'). Así la ventana no se encoge a mitad
   * de la animación.
   */
  requestCollapse() {
    if (!this.window || this.mode === "collapsed" || this.collapseFallback) return;
    this.window.webContents.send(IpcChannels.RequestCollapse);
    this.collapseFallback = setTimeout(() => this.setMode("collapsed"), COLLAPSE_FALLBACK_MS);
  }
  /** Las zonas transparentes dejan pasar el clic a las ventanas de abajo. */
  setPassthrough(enabled) {
    if (!this.window || enabled === this.passthrough) return;
    this.passthrough = enabled;
    this.window.setIgnoreMouseEvents(enabled, { forward: true });
  }
  clearCollapseFallback() {
    if (this.collapseFallback) clearTimeout(this.collapseFallback);
    this.collapseFallback = null;
  }
  /** Abre el panel y le enfoca el teclado (atajo global, bandeja, notificación). */
  reveal() {
    if (this.mode === "collapsed") this.setMode("list");
    this.window?.show();
    this.window?.focus();
  }
  toggle() {
    if (this.mode === "collapsed") this.reveal();
    else this.requestCollapse();
  }
  openNote(noteId) {
    this.reveal();
    this.window?.webContents.send(IpcChannels.OpenNote, noteId);
    this.setMode("sheet");
  }
  startNewNote() {
    this.reveal();
    this.window?.webContents.send(IpcChannels.NewNote);
  }
  isPinned() {
    return this.settings.get("pinned");
  }
  setPinned(pinned) {
    this.settings.set("pinned", pinned);
  }
  /** Pantallas disponibles, en orden de izquierda a derecha. */
  listDisplays() {
    const primaryId = electron.screen.getPrimaryDisplay().id;
    return EdgeWindowManager.sortedDisplays().map((display, index) => {
      const { width, height } = display.size;
      const name = display.label || `Pantalla ${index + 1}`;
      return {
        id: display.id,
        label: `${name} (${width}×${height})${display.id === primaryId ? ", principal" : ""}`
      };
    });
  }
  /** Pantalla elegida por el usuario, o null si está en automático. */
  getChosenDisplayId() {
    return this.settings.get("displayId");
  }
  setDisplay(displayId) {
    this.settings.set("displayId", displayId);
    this.applyBounds();
  }
  /**
   * Coloca la ventana y verifica dónde quedó. En Windows, mover una ventana a
   * un monitor con otra escala (p. ej. 125 % → 100 %) hace que Electron
   * calcule mal tamaño y posición en el primer intento; se aplica de nuevo y,
   * si aun así queda fuera de todas las pantallas, se usa la principal.
   */
  applyBounds() {
    const win = this.window;
    if (!win) return;
    const target = this.targetDisplay();
    let wanted = this.boundsFor(this.mode, target);
    win.setBounds(wanted);
    if (!EdgeWindowManager.sameBounds(win.getBounds(), wanted)) win.setBounds(wanted);
    if (!EdgeWindowManager.isOnScreen(win.getBounds())) {
      wanted = this.boundsFor(this.mode, electron.screen.getPrimaryDisplay());
      win.setBounds(wanted);
      win.setBounds(wanted);
    }
    this.logPlacement(target, wanted, win.getBounds());
  }
  static sameBounds(a, b) {
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  }
  /** ¿Al menos 4 px de la ventana caen dentro de alguna pantalla? */
  static isOnScreen(bounds) {
    return electron.screen.getAllDisplays().some(({ bounds: d }) => {
      const overlapX = Math.min(bounds.x + bounds.width, d.x + d.width) - Math.max(bounds.x, d.x);
      const overlapY = Math.min(bounds.y + bounds.height, d.y + d.height) - Math.max(bounds.y, d.y);
      return overlapX >= 4 && overlapY >= 4;
    });
  }
  /** Registro de posicionamiento para diagnosticar problemas con varios monitores. */
  logPlacement(target, wanted, actual) {
    const displays = electron.screen.getAllDisplays().map((d) => `  id=${d.id} "${d.label}" bounds=${JSON.stringify(d.bounds)} escala=${d.scaleFactor}`).join("\n");
    const line = `${(/* @__PURE__ */ new Date()).toISOString()} modo=${this.mode} destino=${target.id}
  pedido=${JSON.stringify(wanted)} real=${JSON.stringify(actual)}
${displays}
`;
    try {
      fs.appendFileSync(path.join(electron.app.getPath("logs"), "window.log"), line);
    } catch {
    }
  }
  /**
   * La elegida si sigue conectada; si no, la del extremo derecho del
   * escritorio. Con monitores extendidos, el borde derecho de la pantalla
   * principal puede quedar en medio y la pestaña no serviría como borde.
   */
  targetDisplay() {
    const displays = EdgeWindowManager.sortedDisplays();
    const chosen = displays.find((d) => d.id === this.settings.get("displayId"));
    return chosen ?? displays[displays.length - 1] ?? electron.screen.getPrimaryDisplay();
  }
  /** Ordena por el borde derecho; en empate, la que está más arriba. */
  static sortedDisplays() {
    return [...electron.screen.getAllDisplays()].sort(
      (a, b) => a.bounds.x + a.bounds.width - (b.bounds.x + b.bounds.width) || a.bounds.y - b.bounds.y
    );
  }
  /** Calcula la posición contra el área útil (sin la barra de tareas) de la pantalla destino. */
  boundsFor(mode, display = this.targetDisplay()) {
    const area = display.workArea;
    const width = WIDTH[mode];
    const height = mode === "collapsed" ? Math.round(area.height * COLLAPSED_HEIGHT_RATIO) : area.height;
    return {
      x: area.x + area.width - width,
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height
    };
  }
  loadRenderer() {
    const devUrl = process.env["ELECTRON_RENDERER_URL"];
    if (devUrl) void this.window?.loadURL(devUrl);
    else void this.window?.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
const TOGGLE_SHORTCUT = "Control+Alt+N";
class DesktopApp {
  settings = new SettingsStore();
  windows = new EdgeWindowManager(this.settings);
  autoLaunch = new AutoLaunch(this.settings);
  backend = new EmbeddedBackend({
    entryPath: electron.app.isPackaged ? path.join(process.resourcesPath, "backend", "dist", "server.js") : path.join(electron.app.getAppPath(), "..", "backend", "dist", "server.js"),
    databasePath: path.join(electron.app.getPath("userData"), "postit-desk.sqlite"),
    logPath: path.join(electron.app.getPath("logs"), "backend.log")
  });
  notifier = null;
  async start() {
    electron.app.setAppUserModelId("com.david.postitdesk");
    this.autoLaunch.enableOnFirstRun();
    const backendReady = this.backend.start();
    backendReady.catch(() => void 0);
    registerIpcHandlers(backendReady, this.windows);
    this.windows.create();
    const config = await backendReady;
    new TrayController(
      this.resourcePath("tray.png"),
      this.windows,
      this.autoLaunch,
      () => electron.app.quit()
    ).create();
    this.notifier = new ReminderNotifier(new ApiClient(config), (id) => this.windows.openNote(id));
    this.notifier.start();
    electron.globalShortcut.register(TOGGLE_SHORTCUT, () => this.windows.toggle());
  }
  /** Si el usuario abre la app otra vez, se muestra la ya abierta. */
  focusExisting() {
    this.windows.reveal();
  }
  shutdown() {
    electron.globalShortcut.unregisterAll();
    this.notifier?.stop();
    return this.backend.stop();
  }
  resourcePath(file) {
    return electron.app.isPackaged ? path.join(process.resourcesPath, "resources", file) : path.join(electron.app.getAppPath(), "resources", file);
  }
}
if (!electron.app.requestSingleInstanceLock()) {
  electron.app.quit();
} else {
  const desktop = new DesktopApp();
  electron.app.on("second-instance", () => desktop.focusExisting());
  let quitting = false;
  electron.app.on("will-quit", (event) => {
    if (quitting) return;
    quitting = true;
    event.preventDefault();
    void desktop.shutdown().finally(() => electron.app.quit());
  });
  electron.app.on("window-all-closed", () => void 0);
  electron.app.whenReady().then(() => desktop.start()).catch((error) => {
    electron.dialog.showErrorBox("Postit Desk no pudo iniciar", error.message);
    electron.app.quit();
  });
}
