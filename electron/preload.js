// Preload script for Electron
// Runs in an isolated context; only expose what you explicitly need.

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  // Save PDF and open Outlook with attachment
  emailWithAttachment: (pdfData, fileName, recipientEmail, subject, body) => {
    return ipcRenderer.invoke('email-with-attachment', {
      pdfData,
      fileName,
      recipientEmail,
      subject,
      body
    });
  }
});
