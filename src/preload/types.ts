import type { IpcResult } from '@shared/ipc';
import type {
  AppPage,
  AppSettings,
  AudioDevice,
  ModelInfo,
  RecordingResult,
  Transcript,
} from '@shared/types';

export type Unsubscribe = () => void;

/**
 * The only surface the renderer gets (`window.voxcribe`).
 * Every call resolves to an `IpcResult`; see `src/renderer/services/api.ts` for unwrapping.
 */
export interface VoxcribeAPI {
  app: {
    getVersion(): Promise<IpcResult<string>>;
  };
  recording: {
    start(): Promise<IpcResult<void>>;
    stop(): Promise<IpcResult<RecordingResult>>;
    getDevices(): Promise<IpcResult<AudioDevice[]>>;
  };
  transcription: {
    /** Transcribes the audio captured by the last `recording.stop()`. */
    transcribe(): Promise<IpcResult<Transcript>>;
  };
  models: {
    list(): Promise<IpcResult<ModelInfo[]>>;
    getInstalled(): Promise<IpcResult<ModelInfo[]>>;
  };
  settings: {
    get(): Promise<IpcResult<AppSettings>>;
    set(settings: Partial<AppSettings>): Promise<IpcResult<AppSettings>>;
  };
  history: {
    list(): Promise<IpcResult<Transcript[]>>;
    delete(id: string): Promise<IpcResult<void>>;
  };
  clipboard: {
    writeText(text: string): Promise<IpcResult<void>>;
  };
  events: {
    onDictationToggle(listener: (payload: { source: 'shortcut' | 'tray' }) => void): Unsubscribe;
    onNavigate(listener: (payload: { page: AppPage }) => void): Unsubscribe;
  };
}
