/**
 * Domain types shared between the main process and the renderer.
 * Everything here must be serializable (structured clone) because it crosses IPC.
 */

// ---------- Transcripts ----------

export interface TranscriptSegment {
  id: string;
  /** Seconds from the start of the audio. */
  start: number;
  /** Seconds from the start of the audio. */
  end: number;
  text: string;
  /** 0..1, when the engine reports it. */
  confidence?: number;
}

export interface Transcript {
  id: string;
  text: string;
  language?: string;
  /** Audio duration in seconds. */
  duration?: number;
  segments: TranscriptSegment[];
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** Engine + model that produced this transcript. */
  engineId?: string;
  modelId?: string;
}

// ---------- Models ----------

export type ModelFormat = 'ggml' | 'gguf' | 'onnx' | 'nemo';

/** Whether the app can use this model today or it is only announced in the registry. */
export type ModelAvailability = 'available' | 'planned';

export interface ModelCapabilities {
  streaming?: boolean;
  multilingual?: boolean;
  timestamps?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  /** ASR engine id that can load this model (e.g. "whisper", "parakeet"). */
  engine: string;
  /** Native runtime id that executes the engine (e.g. "whisper.cpp", "nemo-speech-cpp"). */
  runtime: string;
  provider: string;
  format: ModelFormat;
  /** ISO 639-1 codes. `"*"` means every language the engine supports. */
  languages: string[];
  /** File name inside `<userData>/models/<engine>/`. */
  fileName: string;
  /** Approximate download size. */
  sizeBytes?: number;
  downloadUrl?: string;
  /** SHA-256 hex digest. */
  checksum?: string;
  installed: boolean;
  availability: ModelAvailability;
  capabilities?: ModelCapabilities;
  description?: string;
}

// ---------- Audio ----------

export interface AudioDevice {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface RecordingResult {
  /** Milliseconds of audio captured. */
  durationMs: number;
}

// ---------- Settings ----------

export type PostProcessingProvider = 'none' | 'ollama' | 'lm-studio' | 'llama.cpp';

export interface PostProcessingSettings {
  enabled: boolean;
  provider: PostProcessingProvider;
}

export interface StorageSettings {
  saveHistory: boolean;
}

export interface AppSettings {
  selectedModelId: string;
  /** `null` = system default microphone. */
  microphoneId: string | null;
  /** ISO 639-1 code or "auto". */
  language: string;
  shortcut: string;
  postProcessing: PostProcessingSettings;
  storage: StorageSettings;
}

// ---------- App state machine ----------

export type AppState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'transcribing'
  | 'cleaning'
  | 'inserting'
  | 'error';

export type AppPage = 'home' | 'history' | 'settings';
