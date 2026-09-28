import type { IpcResult } from '@shared/ipc';
import type {
  AppPage,
  AppSettings,
  AudioDevice,
  DownloadProgress,
  ModelInfo,
  RecordingResult,
  SelectedAudioFile,
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
    /** Transcribes a file picked with `files.selectAudio()` (by its opaque id). */
    transcribeFile(fileId: string): Promise<IpcResult<Transcript>>;
  };
  files: {
    /** Opens the native file dialog in main. Resolves `null` when cancelled. */
    selectAudio(): Promise<IpcResult<SelectedAudioFile | null>>;
  };
  models: {
    list(): Promise<IpcResult<ModelInfo[]>>;
    getInstalled(): Promise<IpcResult<ModelInfo[]>>;
    /** Resolves when the model is downloaded and verified. Progress arrives via `events.onModelDownloadProgress`. */
    download(modelId: string): Promise<IpcResult<ModelInfo>>;
    cancelDownload(modelId: string): Promise<IpcResult<void>>;
    delete(modelId: string): Promise<IpcResult<void>>;
    getDownloadProgress(modelId: string): Promise<IpcResult<DownloadProgress | null>>;
    setActive(modelId: string): Promise<IpcResult<AppSettings>>;
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
    onModelDownloadProgress(listener: (progress: DownloadProgress) => void): Unsubscribe;
  };
}
