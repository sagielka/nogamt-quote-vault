import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../public/favicon.ico"),
    title: "Thinking Inside Quotation System",
  });

  // In production, load the built files
  // In development, you can load from localhost
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadURL("http://localhost:8080");
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("update-available", () => {
  console.log("Update available");
});

autoUpdater.on("update-downloaded", () => {
  console.log("Update downloaded - will install on quit");
});

autoUpdater.on("error", (error) => {
  console.error("Auto-updater error:", error);
});

app.whenReady().then(() => {
  createWindow();

  // Check for updates after window is created
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

