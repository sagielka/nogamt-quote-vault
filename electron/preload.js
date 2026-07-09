// Preload script for Electron
// Runs in an isolated context; only expose what you explicitly need.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // Save PDF and open Outlook with attachment
  emailWithAttachment: (pdfData, fileName, recipientEmail, subject, body) => {
    return ipcRenderer.invoke("email-with-attachment", {
      pdfData,
      fileName,
      recipientEmail,
      subject,
      body,
    });
  },

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  installUpdateNow: () => ipcRenderer.invoke("install-update-now"),
  onUpdateStatus: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on("update-status", listener);
    return () => ipcRenderer.removeListener("update-status", listener);
  },
});

