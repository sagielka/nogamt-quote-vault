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
});

