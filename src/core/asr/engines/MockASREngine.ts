import { createId, createTranscript } from '@shared/transcript';
import type { ASREngine } from '../ASREngine';
import type { ASRCapabilities, ASRConfig, AudioInput, Transcript } from '../types';

const SAMPLE_PHRASES = [
  'This is a mock transcript produced without any model.',
  'Voxcribe keeps your voice on this device.',
  'Replace the mock engine with whisper.cpp to get real transcripts.',
];

export interface MockASREngineOptions {
  /** Register under a real engine id (e.g. "whisper") to stand in for it. */
  id?: string;
  name?: string;
  latencyMs?: number;
}

/** Deterministic fake engine for UI development and tests. */
export class MockASREngine implements ASREngine {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ASRCapabilities = {
    streaming: false,
    multilingual: true,
    timestamps: true,
    translation: false,
    sampleRates: [16_000],
  };

  private initialized = false;
  private calls = 0;
  private readonly latencyMs: number;

  constructor(options: MockASREngineOptions = {}) {
    this.id = options.id ?? 'mock';
    this.name = options.name ?? 'Mock engine';
    this.latencyMs = options.latencyMs ?? 0;
  }

  async initialize(_modelPath: string): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async transcribe(audio: AudioInput, config?: Partial<ASRConfig>): Promise<Transcript> {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    const text = SAMPLE_PHRASES[this.calls % SAMPLE_PHRASES.length] ?? '';
    this.calls += 1;
    const duration = audio.durationMs / 1000;
    return createTranscript({
      language: config?.language === 'auto' || !config?.language ? 'en' : config.language,
      duration,
      segments: [{ id: createId('seg'), start: 0, end: duration, text, confidence: 0.99 }],
    });
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}
