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
  pty: {
    defaultShell: () => ipcRenderer.invoke('pty:defaultShell'),
    listShells: () => ipcRenderer.invoke('pty:listShells'),
    spawn: (opts) => ipcRenderer.invoke('pty:spawn', opts),
    write: (id, data) => ipcRenderer.send('pty:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('pty:resize', { id, cols, rows }),
    kill: (id) => ipcRenderer.send('pty:kill', { id }),
    onData: (cb) => {
      const h = (_e, payload) => cb(payload);
      ipcRenderer.on('pty:data', h);
      return () => ipcRenderer.removeListener('pty:data', h);
    },
    onExit: (cb) => {
      const h = (_e, payload) => cb(payload);
      ipcRenderer.on('pty:exit', h);
      return () => ipcRenderer.removeListener('pty:exit', h);
    },
  },
});
