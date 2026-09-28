import { join } from 'node:path';
import { BrowserWindow, shell } from 'electron';
import { APP_NAME } from '@shared/constants';

export interface CreateMainWindowOptions {
  iconPath: string;
  isDev: boolean;
}

/** Only these origins may be loaded in the main window. */
function isAllowedUrl(url: string): boolean {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl && url.startsWith(devUrl)) return true;
  return url.startsWith('file://');
}

export function createMainWindow({ iconPath, isDev }: CreateMainWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    show: false,
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
      devTools: isDev,
    },
  });

  window.once('ready-to-show', () => window.show());

  // Block new windows; open http(s) links in the system browser instead.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Block navigation away from the app.
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) event.preventDefault();
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDev && devUrl) {
    void window.loadURL(devUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}
