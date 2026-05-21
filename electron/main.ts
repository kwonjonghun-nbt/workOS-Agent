import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc';
import { initAutoUpdater } from './infra/autoUpdater';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1F1E1B',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Route external http(s) links to the OS default browser (Chrome if set as
  // default) instead of opening them inside the Electron window. Applies to
  // <a target="_blank">, window.open(), and any link navigation that would
  // leave the app shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalLink(url)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    if (isExternalLink(url) && !isSameOrigin(url, current)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

app.whenReady().then(() => {
  const container = registerIpcHandlers();
  app.on('before-quit', () => {
    container.terminalService.disposeAll();
    container.mcpControlPlane.stop().catch(() => {});
  });
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
