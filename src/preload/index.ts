import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type IpcArgs,
  type IpcChannel,
  type IpcEvent,
  type IpcEventContract,
  type IpcResult,
  type IpcReturn,
} from '@shared/ipc';
import type { VoxcribeAPI, Unsubscribe } from './types';

/** Typed invoke restricted to the known channel list. `ipcRenderer` itself is never exposed. */
function invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcResult<IpcReturn<C>>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<IpcReturn<C>>>;
}

function subscribe<E extends IpcEvent>(event: E, listener: (payload: IpcEventContract[E]) => void): Unsubscribe {
  // Strip the IpcRendererEvent so `event.sender` never reaches the renderer.
  const wrapped = (_event: IpcRendererEvent, payload: IpcEventContract[E]) => listener(payload);
  ipcRenderer.on(event, wrapped);
  return () => {
    ipcRenderer.removeListener(event, wrapped);
  };
}

const api: VoxcribeAPI = {
  app: {
    getVersion: () => invoke(IPC_CHANNELS.APP_GET_VERSION),
  },
  recording: {
    start: () => invoke(IPC_CHANNELS.RECORDING_START),
    stop: () => invoke(IPC_CHANNELS.RECORDING_STOP),
    getDevices: () => invoke(IPC_CHANNELS.RECORDING_DEVICES),
  },
  transcription: {
    transcribe: () => invoke(IPC_CHANNELS.TRANSCRIPTION_TRANSCRIBE),
  },
  models: {
    list: () => invoke(IPC_CHANNELS.MODELS_LIST),
    getInstalled: () => invoke(IPC_CHANNELS.MODELS_INSTALLED),
  },
  settings: {
    get: () => invoke(IPC_CHANNELS.SETTINGS_GET),
    set: (settings) => invoke(IPC_CHANNELS.SETTINGS_SET, settings),
  },
  history: {
    list: () => invoke(IPC_CHANNELS.HISTORY_LIST),
    delete: (id) => invoke(IPC_CHANNELS.HISTORY_DELETE, id),
  },
  clipboard: {
    writeText: (text) => invoke(IPC_CHANNELS.CLIPBOARD_WRITE_TEXT, text),
  },
  events: {
    onDictationToggle: (listener) => subscribe(IPC_EVENTS.DICTATION_TOGGLE, listener),
    onNavigate: (listener) => subscribe(IPC_EVENTS.NAVIGATE, listener),
  },
};

contextBridge.exposeInMainWorld('voxcribe', api);
