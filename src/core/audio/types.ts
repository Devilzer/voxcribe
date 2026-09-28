import type { AudioDevice } from '@shared/types';
import type { AudioInput } from '../asr/types';

export type { AudioDevice, AudioInput };

export type RecorderState = 'idle' | 'recording' | 'paused';

export interface AudioRecorderOptions {
  deviceId?: string | null;
  /** Output sample rate. Defaults to 16 kHz for ASR. */
  sampleRate?: number;
}
