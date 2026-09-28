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
    const end = audio.durationMs / 1000;
    return { hasSpeech: audio.durationMs > 0, regions: [{ start: 0, end }], audio };
  }

  async dispose(): Promise<void> {}
}
