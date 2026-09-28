import type { AudioInput } from '../asr/types';

export interface SpeechRegion {
  /** Seconds. */
  start: number;
  /** Seconds. */
  end: number;
}

export interface VADResult {
  hasSpeech: boolean;
  regions: SpeechRegion[];
  /** Audio trimmed to speech regions; engines transcribe this. */
  audio: AudioInput;
}

export interface VoiceActivityDetector {
  readonly id: string;
  initialize(): Promise<void>;
  process(audio: AudioInput): Promise<VADResult>;
  dispose(): Promise<void>;
}

/**
 * No-op detector: treats the whole clip as speech.
 * TODO(vad): add Silero VAD (whisper.cpp ships a GGML port) or WebRTC VAD.
 */
export class PassthroughVAD implements VoiceActivityDetector {
  readonly id = 'passthrough';

  async initialize(): Promise<void> {}

  async process(audio: AudioInput): Promise<VADResult> {
    const durationMs = audio.durationMs ?? 0;
    // Files have unknown length here; let the engine decide.
    const hasSpeech = audio.kind === 'file' || durationMs > 0;
    return { hasSpeech, regions: [{ start: 0, end: durationMs / 1000 }], audio };
  }

  async dispose(): Promise<void> {}
}
