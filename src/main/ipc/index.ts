import { app, clipboard, ipcMain, type BrowserWindow } from 'electron';
import { ModelError } from '@core/errors';
import { IPC_CHANNELS } from '@shared/ipc';
import type { Services } from '../services/container';
import type { ShortcutManager } from '../shortcuts/shortcuts';
import { handle, type HandlerContext } from './handle';
import { audioFileId, clipboardText, noArgs, registeredModelId, settingsPatch, singleString } from './validators';

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
  const modelId = registeredModelId((id) => services.registry.has(id));
  const { models, settings } = services;

  handle(context, IPC_CHANNELS.APP_GET_VERSION, noArgs, () => app.getVersion());

  // ---------- recording (mock recorder until Phase 3) ----------
  handle(context, IPC_CHANNELS.RECORDING_START, noArgs, () => services.dictation.startRecording());
  handle(context, IPC_CHANNELS.RECORDING_STOP, noArgs, () => services.dictation.stopRecording());
  handle(context, IPC_CHANNELS.RECORDING_DEVICES, noArgs, () => services.recorder.getDevices());

  // ---------- transcription ----------
  handle(context, IPC_CHANNELS.TRANSCRIPTION_TRANSCRIBE, noArgs, () => services.dictation.transcribePending());
  handle(context, IPC_CHANNELS.TRANSCRIPTION_TRANSCRIBE_FILE, audioFileId, (fileId) =>
    services.dictation.transcribeFile(services.audioFiles.resolve(fileId)),
  );
  handle(context, IPC_CHANNELS.FILES_SELECT_AUDIO, noArgs, () => services.audioFiles.select(getMainWindow()));

  // ---------- models ----------
  handle(context, IPC_CHANNELS.MODELS_LIST, noArgs, () => models.listModels());
  handle(context, IPC_CHANNELS.MODELS_INSTALLED, noArgs, () => models.getInstalledModels());
  handle(context, IPC_CHANNELS.MODELS_GET_DOWNLOAD_PROGRESS, modelId, (id) => models.getDownloadProgress(id));
  handle(context, IPC_CHANNELS.MODELS_DOWNLOAD, modelId, async (id) => {
    await models.downloadModel(id);
    // Convenience: the first installed model becomes active.
    if (settings.get().activeModelId === null) await settings.update({ activeModelId: id });
    return models.getModel(id);
  });
  handle(context, IPC_CHANNELS.MODELS_CANCEL_DOWNLOAD, modelId, (id) => models.cancelDownload(id));
  handle(context, IPC_CHANNELS.MODELS_DELETE, modelId, async (id) => {
    if (settings.get().activeModelId === id) await settings.update({ activeModelId: null });
    await models.deleteModel(id);
  });
  handle(context, IPC_CHANNELS.MODELS_SET_ACTIVE, modelId, async (id) => {
    const model = models.getModel(id);
    if (!model.installed) {
      throw new ModelError('MODEL_NOT_INSTALLED', `${id} is not installed`, { details: { modelName: model.name } });
    }
    return settings.update({ activeModelId: id });
  });

  // ---------- settings ----------
  handle(context, IPC_CHANNELS.SETTINGS_GET, noArgs, () => settings.get());
  handle(context, IPC_CHANNELS.SETTINGS_SET, settingsPatch, async (patch) => {
    const previous = settings.get();
    const next = await settings.update(patch);
    if (next.shortcut !== previous.shortcut) {
      try {
        await shortcuts.setShortcut(next.shortcut);
      } catch (error) {
        await settings.update({ shortcut: previous.shortcut });
        throw error;
      }
    }
    return next;
  });

  // ---------- history / clipboard ----------
  handle(context, IPC_CHANNELS.HISTORY_LIST, noArgs, () => services.storage.listTranscripts());
  handle(context, IPC_CHANNELS.HISTORY_DELETE, singleString('id'), (id) => services.storage.deleteTranscript(id));
  handle(context, IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, clipboardText, (text) => clipboard.writeText(text));
}

export function removeIpcHandlers(): void {
  for (const channel of Object.values(IPC_CHANNELS)) ipcMain.removeHandler(channel);
}
