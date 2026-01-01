// Preload script for Electron
// This runs in a sandboxed environment with access to Node.js APIs

const { contextBridge } = require('electron');

// Expose any APIs you need to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});
