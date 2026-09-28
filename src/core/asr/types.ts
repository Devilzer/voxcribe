import type { Transcript, TranscriptSegment } from '@shared/types';

export type { Transcript, TranscriptSegment };

/** Raw PCM audio (e.g. from the recorder). */
export interface PcmAudioInput {
  kind: 'pcm';
  /** Mono float32 samples in [-1, 1]. */
  samples: Float32Array;
  /** Hz. whisper.cpp works at 16 000. */
  sampleRate: number;
  channels: number;
  durationMs: number;
}

/** An audio file on disk, owned by the main process. */
export interface FileAudioInput {
  kind: 'file';
  /** Absolute path. Never taken from the renderer directly. */
  path: string;
  format: 'wav';
  durationMs?: number;
}

/** Audio handed to VAD and ASR engines. */
export type AudioInput = PcmAudioInput | FileAudioInput;

export interface ASRConfig {
  /** ISO 639-1 code or "auto". */
  language: string;
  /** Translate to English instead of transcribing (Whisper feature). */
  translate?: boolean;
  /** CPU threads for native inference. */
  threads?: number;
  /** Prompt to bias vocabulary (names, jargon). */
  initialPrompt?: string;
}

export interface ASRCapabilities {
  streaming: boolean;
  multilingual: boolean;
  timestamps: boolean;
  translation: boolean;
  /** Audio file formats the engine reads directly. */
  fileFormats: Array<FileAudioInput['format']>;
}
