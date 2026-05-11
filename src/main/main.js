const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const store = require('./store');
const ptyMgr = require('./pty-manager');

let mainWindow = null;

function createWindow() {
  const { window: win } = store.getState();
  mainWindow = new BrowserWindow({
    width: win.width || 1280,
    height: win.height || 800,
    x: win.x ?? undefined,
    y: win.y ?? undefined,
    backgroundColor: '#1e1e1e',
    title: 'Muti CLI',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (win.maximized) mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  const persistBounds = () => {
    if (!mainWindow) return;
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
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('maximize', persistBounds);
  mainWindow.on('unmaximize', persistBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  ptyMgr.killAll();
  store.flush();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  ptyMgr.killAll();
  store.flush();
});

ipcMain.handle('state:get', () => store.getState());

ipcMain.handle('state:set', (_e, next) => {
  store.setState(next);
  return true;
});

ipcMain.handle('dialog:pickFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle('pty:spawn', (event, opts) => {
  const wc = event.sender;
  const info = ptyMgr.spawn(
    opts,
    (data) => {
      if (!wc.isDestroyed()) wc.send('pty:data', { id: opts.id, data });
    },
    (exit) => {
      if (!wc.isDestroyed()) wc.send('pty:exit', { id: opts.id, ...exit });
    }
  );
  return info;
});

ipcMain.on('pty:write', (_e, { id, data }) => ptyMgr.write(id, data));
ipcMain.on('pty:resize', (_e, { id, cols, rows }) => ptyMgr.resize(id, cols, rows));
ipcMain.on('pty:kill', (_e, { id }) => ptyMgr.kill(id));

ipcMain.handle('pty:defaultShell', () => ptyMgr.defaultShell());
