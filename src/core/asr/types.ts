import type { Transcript, TranscriptSegment } from '@shared/types';

export type { Transcript, TranscriptSegment };

/** Raw PCM audio handed to VAD and ASR engines. */
export interface AudioInput {
  /** Mono float32 samples in [-1, 1]. */
  samples: Float32Array;
  /** Hz. whisper.cpp requires 16 000. */
  sampleRate: number;
  channels: number;
  durationMs: number;
}

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
  /** Sample rates the engine accepts directly. */
  sampleRates: number[];
}
