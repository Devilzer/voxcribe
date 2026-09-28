import { join } from 'node:path';
import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import { APP_ID } from '@shared/constants';
import { IPC_EVENTS, type IpcEvent, type IpcEventContract } from '@shared/ipc';
import { registerIpcHandlers } from './ipc';
import { resolveAppPaths } from './paths';
import { applySecurityPolicies } from './security';
import { createServices, rootLogger } from './services/container';
import { ElectronShortcutManager } from './shortcuts/shortcuts';
import { createTray, type AppTray } from './tray/tray';
import { createMainWindow } from './windows/createMainWindow';

const logger = rootLogger;
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: AppTray | null = null;
let isQuitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());
  void app.whenReady().then(bootstrap).catch((error: unknown) => {
    logger.error('Failed to start', error);
    app.exit(1);
  });
}

function send<E extends IpcEvent>(event: E, payload: IpcEventContract[E]): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(event, payload);
}

function showMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = openMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return mainWindow;
}

function openMainWindow(): BrowserWindow {
  const paths = resolveAppPaths();
  const window = createMainWindow({ iconPath: join(paths.iconsDir, 'icon.png'), isDev });
  // Closing hides to tray; quit from the tray menu.
  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });
  return window;
}

/**
 * The renderer owns the dictation state machine, so shortcut/tray triggers are
 * forwarded to it. The pipeline itself still runs in main via IPC.
 */
function toggleDictation(source: 'shortcut' | 'tray'): void {
  if (!mainWindow || mainWindow.isDestroyed()) showMainWindow();
  send(IPC_EVENTS.DICTATION_TOGGLE, { source });
}

async function bootstrap(): Promise<void> {
  app.setAppUserModelId(APP_ID);
  applySecurityPolicies();

  const paths = resolveAppPaths();
  const services = await createServices(paths);

  const shortcuts = new ElectronShortcutManager({
    logger: logger.child('shortcuts'),
    shortcut: services.settings.get().shortcut,
    onTrigger: () => toggleDictation('shortcut'),
  });

  registerIpcHandlers({ services, shortcuts, getMainWindow: () => mainWindow });

  mainWindow = openMainWindow();

  tray = createTray(paths.iconsDir, {
    toggleRecording: () => toggleDictation('tray'),
    openApp: () => showMainWindow(),
    openSettings: () => {
      showMainWindow();
      send(IPC_EVENTS.NAVIGATE, { page: 'settings' });
    },
    quit: () => app.quit(),
  });

  try {
    await shortcuts.register();
  } catch (error) {
    // Not fatal: the app still works from the UI and tray.
    logger.warn('Global shortcut unavailable', error);
  }

  app.on('activate', () => showMainWindow());

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    void shortcuts.unregister();
    void services.asr.dispose();
    tray?.destroy();
  });
}

// Keep running in the tray when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  if (isQuitting) app.quit();
});
