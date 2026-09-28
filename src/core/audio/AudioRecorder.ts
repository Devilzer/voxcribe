import { ASR_CHANNELS, ASR_SAMPLE_RATE } from '@shared/constants';
import { AudioError } from '../errors';
import type { PcmAudioInput } from '../asr/types';
import type { AudioDevice, AudioRecorderOptions, RecorderState } from './types';

export interface AudioRecorder {
  start(options?: AudioRecorderOptions): Promise<void>;
  stop(): Promise<PcmAudioInput>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getDevices(): Promise<AudioDevice[]>;
  getState(): RecorderState;
}

/** Longest silence buffer the mock will allocate (keeps memory bounded). */
const MOCK_MAX_SECONDS = 120;

/**
 * Fake recorder: tracks elapsed time and returns silent 16 kHz PCM.
 *
 * TODO(audio): real capture. Likely options: getUserMedia in a hidden
 * renderer/AudioWorklet streaming PCM to main, or a native capture addon.
 */
export class MockAudioRecorder implements AudioRecorder {
  private state: RecorderState = 'idle';
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;

  constructor(private readonly now: () => number = Date.now) {}

  getState(): RecorderState {
    return this.state;
  }

  async start(_options?: AudioRecorderOptions): Promise<void> {
    if (this.state !== 'idle') throw new AudioError('AUDIO_ALREADY_RECORDING', 'Recorder already running');
    this.state = 'recording';
    this.startedAt = this.now();
    this.pausedTotal = 0;
  }

  async stop(): Promise<PcmAudioInput> {
    if (this.state === 'idle') throw new AudioError('AUDIO_NOT_RECORDING', 'Recorder is not running');
    if (this.state === 'paused') await this.resume();
    const durationMs = Math.max(0, this.now() - this.startedAt - this.pausedTotal);
    this.state = 'idle';
    const sampleCount = Math.round((Math.min(durationMs, MOCK_MAX_SECONDS * 1000) / 1000) * ASR_SAMPLE_RATE);
    return {
      kind: 'pcm',
      samples: new Float32Array(sampleCount),
      sampleRate: ASR_SAMPLE_RATE,
      channels: ASR_CHANNELS,
      durationMs,
    };
  }

  async pause(): Promise<void> {
    if (this.state !== 'recording') throw new AudioError('AUDIO_NOT_RECORDING', 'Recorder is not recording');
    this.state = 'paused';
    this.pausedAt = this.now();
  }

  async resume(): Promise<void> {
    if (this.state !== 'paused') throw new AudioError('AUDIO_NOT_RECORDING', 'Recorder is not paused');
    this.pausedTotal += this.now() - this.pausedAt;
    this.state = 'recording';
  }

  async getDevices(): Promise<AudioDevice[]> {
    return [
      { id: 'default', label: 'System default microphone', isDefault: true },
      { id: 'mock-usb', label: 'Mock USB Microphone', isDefault: false },
    ];
  }
}
