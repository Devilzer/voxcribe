import { app, clipboard, ipcMain, type BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc';
import type { Services } from '../services/container';
import type { ShortcutManager } from '../shortcuts/shortcuts';
import { handle, type HandlerContext } from './handle';
import { clipboardText, noArgs, settingsPatch, singleString } from './validators';

export interface IpcDeps {
  services: Services;
  shortcuts: ShortcutManager;
  getMainWindow: () => BrowserWindow | null;
}

export function registerIpcHandlers({ services, shortcuts, getMainWindow }: IpcDeps): void {
  const context: HandlerContext = {
    logger: services.logger.child('ipc'),
    isTrustedSender: (event) => {
      const window = getMainWindow();
      return window !== null && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
    },
  };

  handle(context, IPC_CHANNELS.APP_GET_VERSION, noArgs, () => app.getVersion());

  handle(context, IPC_CHANNELS.RECORDING_START, noArgs, () => services.dictation.startRecording());
  handle(context, IPC_CHANNELS.RECORDING_STOP, noArgs, () => services.dictation.stopRecording());
  handle(context, IPC_CHANNELS.RECORDING_DEVICES, noArgs, () => services.recorder.getDevices());

  handle(context, IPC_CHANNELS.TRANSCRIPTION_TRANSCRIBE, noArgs, () => services.dictation.transcribePending());

  handle(context, IPC_CHANNELS.MODELS_LIST, noArgs, () => services.models.list());
  handle(context, IPC_CHANNELS.MODELS_INSTALLED, noArgs, () => services.models.listInstalled());

  handle(context, IPC_CHANNELS.SETTINGS_GET, noArgs, () => services.settings.get());
  handle(context, IPC_CHANNELS.SETTINGS_SET, settingsPatch, async (patch) => {
    const previous = services.settings.get();
    const next = await services.settings.update(patch);
    if (next.shortcut !== previous.shortcut) {
      try {
        await shortcuts.setShortcut(next.shortcut);
      } catch (error) {
        await services.settings.update({ shortcut: previous.shortcut });
        throw error;
      }
    }
    return next;
  });

  handle(context, IPC_CHANNELS.HISTORY_LIST, noArgs, () => services.storage.listTranscripts());
  handle(context, IPC_CHANNELS.HISTORY_DELETE, singleString('id'), (id) => services.storage.deleteTranscript(id));

  handle(context, IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, clipboardText, (text) => clipboard.writeText(text));
}

export function removeIpcHandlers(): void {
  for (const channel of Object.values(IPC_CHANNELS)) ipcMain.removeHandler(channel);
}
