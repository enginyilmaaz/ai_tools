'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Generic bridge message (used by Bridge.send in renderer)
  send: (type, data) => ipcRenderer.send('bridge-message', { type, data: data || {} }),

  // Receive messages from main process (used by Bridge.on in renderer)
  onMessage: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on('bridge-reply', handler);
    return () => ipcRenderer.removeListener('bridge-reply', handler);
  },

  // Theme (main → renderer)
  onSetTheme: (cb) => {
    ipcRenderer.on('set-theme', (_e, t) => cb(t));
  },

  // Language (main → renderer)
  onSetLanguage: (cb) => {
    ipcRenderer.on('set-language', (_e, l) => cb(l));
  },

  // Theme (renderer → main)
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),

  // Language (renderer → main)
  setLanguage: (lang) => ipcRenderer.send('set-language', lang),

  // Open external URL
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  getWindowConfig: () => ipcRenderer.sendSync('window-config'),
  onMaximizeChange: (cb) => {
    ipcRenderer.on('window-maximized', () => cb(true));
    ipcRenderer.on('window-unmaximized', () => cb(false));
  },
  onWindowCapabilities: (cb) => {
    ipcRenderer.on('window-capabilities', (_e, data) => cb(data));
  }
});
