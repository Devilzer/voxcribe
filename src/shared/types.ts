import type { AppErrorPayload } from './errors';

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

/** ASR engine id. Matches `ASREngine.id` in the main process. */
export type ModelEngine = 'whisper' | 'parakeet';
/** Native runtime that executes the engine. */
export type ModelRuntime = 'whisper.cpp' | 'nemo-speech-cpp';
export type ModelFormat = 'ggml' | 'gguf' | 'onnx' | 'nemo';

export interface ModelCapabilities {
  multilingual: boolean;
  streaming: boolean;
  timestamps: boolean;
}

interface ModelDefinitionBase {
  id: string;
  name: string;
  engine: ModelEngine;
  runtime: ModelRuntime;
  provider: string;
  format: ModelFormat;
  /** ISO 639-1 codes. `"*"` means every language the engine supports. */
  languages: string[];
  /** File name inside `<userData>/models/<engine>/`. */
  filename: string;
  capabilities: ModelCapabilities;
  /** One or two words for the UI, e.g. "Fast". */
  tagline: string;
  description?: string;
}

/** A model the app can download and run today. Every field needed to fetch and verify it is pinned. */
export interface DownloadableModelDefinition extends ModelDefinitionBase {
  availability: 'available';
  /** Exact size in bytes of the published file. */
  sizeBytes: number;
  /** HTTPS URL pinned to an immutable revision. */
  downloadUrl: string;
  /** Expected SHA-256 (lowercase hex) of the file. */
  sha256: string;
}

/** Announced in the registry but not usable yet (e.g. Parakeet). */
export interface PlannedModelDefinition extends ModelDefinitionBase {
  availability: 'planned';
  sizeBytes?: number;
}

export type ModelDefinition = DownloadableModelDefinition | PlannedModelDefinition;

/** Registry metadata plus local install state. */
export type ModelInfo = ModelDefinition & {
  /** True only when the verified model file is present at its final path. */
  installed: boolean;
};

export type DownloadStatus = 'queued' | 'downloading' | 'verifying' | 'completed' | 'failed' | 'cancelled';

export interface DownloadProgress {
  modelId: string;
  downloadedBytes: number;
  totalBytes: number;
  /** 0..100 */
  percentage: number;
  status: DownloadStatus;
  /** Set when `status === 'failed'`. */
  error?: AppErrorPayload;
}

/** What the model list shows for one model. */
export type ModelDownloadState = 'not-installed' | 'downloading' | 'verifying' | 'installed' | 'error' | 'unavailable';

export function getModelDownloadState(model: ModelInfo, progress: DownloadProgress | undefined): ModelDownloadState {
  if (model.availability !== 'available') return 'unavailable';
  switch (progress?.status) {
    case 'queued':
    case 'downloading':
      return 'downloading';
    case 'verifying':
      return 'verifying';
    case 'failed':
      return model.installed ? 'installed' : 'error';
    default:
      return model.installed ? 'installed' : 'not-installed';
  }
}

// ---------- Audio ----------

export interface AudioDevice {
  id: string;
  label: string;
  isDefault: boolean;
}

/** An audio file the user picked in the native file dialog. The path stays in main. */
export interface SelectedAudioFile {
  /** Opaque handle for `transcription.transcribeFile`. */
  id: string;
  name: string;
  sizeBytes: number;
  durationSec?: number;
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
  /** Model used for transcription. `null` until the user installs/chooses one. */
  activeModelId: string | null;
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
