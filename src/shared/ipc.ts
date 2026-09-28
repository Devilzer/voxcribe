import type { AppErrorPayload } from './errors';
import type {
  AppPage,
  AppSettings,
  AudioDevice,
  ModelInfo,
  RecordingResult,
  Transcript,
} from './types';

/** Request/response channels (renderer → main, `ipcRenderer.invoke`). */
export const IPC_CHANNELS = {
  APP_GET_VERSION: 'app:get-version',

  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_DEVICES: 'recording:devices',

  TRANSCRIPTION_TRANSCRIBE: 'transcription:transcribe',

  MODELS_LIST: 'models:list',
  MODELS_INSTALLED: 'models:installed',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  HISTORY_LIST: 'history:list',
  HISTORY_DELETE: 'history:delete',

  CLIPBOARD_WRITE_TEXT: 'clipboard:write-text',
} as const;

/** Push events (main → renderer, `webContents.send`). */
export const IPC_EVENTS = {
  /** Global shortcut or tray asked to start/stop dictation. */
  DICTATION_TOGGLE: 'event:dictation-toggle',
  NAVIGATE: 'event:navigate',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
export type IpcEvent = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];

/** Argument and result types for every invoke channel. */
export interface IpcContract {
  [IPC_CHANNELS.APP_GET_VERSION]: { args: []; result: string };
  [IPC_CHANNELS.RECORDING_START]: { args: []; result: void };
  [IPC_CHANNELS.RECORDING_STOP]: { args: []; result: RecordingResult };
  [IPC_CHANNELS.RECORDING_DEVICES]: { args: []; result: AudioDevice[] };
  [IPC_CHANNELS.TRANSCRIPTION_TRANSCRIBE]: { args: []; result: Transcript };
  [IPC_CHANNELS.MODELS_LIST]: { args: []; result: ModelInfo[] };
  [IPC_CHANNELS.MODELS_INSTALLED]: { args: []; result: ModelInfo[] };
  [IPC_CHANNELS.SETTINGS_GET]: { args: []; result: AppSettings };
  [IPC_CHANNELS.SETTINGS_SET]: { args: [settings: Partial<AppSettings>]; result: AppSettings };
  [IPC_CHANNELS.HISTORY_LIST]: { args: []; result: Transcript[] };
  [IPC_CHANNELS.HISTORY_DELETE]: { args: [id: string]; result: void };
  [IPC_CHANNELS.CLIPBOARD_WRITE_TEXT]: { args: [text: string]; result: void };
}

export type IpcArgs<C extends IpcChannel> = IpcContract[C]['args'];
export type IpcReturn<C extends IpcChannel> = IpcContract[C]['result'];

/** Payloads for push events. */
export interface IpcEventContract {
  [IPC_EVENTS.DICTATION_TOGGLE]: { source: 'shortcut' | 'tray' };
  [IPC_EVENTS.NAVIGATE]: { page: AppPage };
}

/**
 * Every invoke resolves to a result envelope. Electron strips custom properties
 * from errors thrown across IPC, so errors travel as data instead.
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: AppErrorPayload };
