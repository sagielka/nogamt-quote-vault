// Preload script for Electron
// Runs in an isolated context; only expose what you explicitly need.

import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
});

