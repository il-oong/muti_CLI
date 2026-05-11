'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  state: {
    get: () => ipcRenderer.invoke('state:get'),
    set: (next) => ipcRenderer.invoke('state:set', next),
  },
  dialog: {
    pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  },
});
