'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { createStore } = require('./store');
const ptyMgr = require('./pty-manager');
const shells = require('./shells');

let store = null;
let mainWindow = null;

function persistBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const b = mainWindow.getBounds();
  store.patch({
    window: {
      width: b.width,
      height: b.height,
      x: b.x,
      y: b.y,
      maximized: mainWindow.isMaximized(),
    },
  });
}

function createWindow() {
  const { window: w } = store.getState();
  mainWindow = new BrowserWindow({
    width: w.width || 1280,
    height: w.height || 800,
    x: w.x ?? undefined,
    y: w.y ?? undefined,
    backgroundColor: '#1e1e1e',
    title: 'Muti CLI',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (w.maximized) mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('maximize', persistBounds);
  mainWindow.on('unmaximize', persistBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  store = createStore(path.join(app.getPath('userData'), 'state.json'));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  ptyMgr.killAll();
  if (store) store.flush();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  ptyMgr.killAll();
  if (store) store.flush();
});

ipcMain.handle('state:get', () => store.getState());
ipcMain.handle('state:set', (_event, next) => {
  store.setState(next);
  return true;
});

ipcMain.handle('dialog:pickFolder', async () => {
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
  const res = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('pty:defaultShell', () => ptyMgr.defaultShell());

ipcMain.handle('pty:listShells', () => shells.listShells());

ipcMain.handle('pty:spawn', (event, opts) => {
  const wc = event.sender;
  return ptyMgr.spawn(
    opts,
    (data) => {
      if (!wc.isDestroyed()) wc.send('pty:data', { id: opts.id, data });
    },
    (exit) => {
      if (!wc.isDestroyed()) wc.send('pty:exit', { id: opts.id, ...exit });
    }
  );
});

ipcMain.on('pty:write', (_e, { id, data }) => ptyMgr.write(id, data));
ipcMain.on('pty:resize', (_e, { id, cols, rows }) => ptyMgr.resize(id, cols, rows));
ipcMain.on('pty:kill', (_e, { id }) => ptyMgr.kill(id));
