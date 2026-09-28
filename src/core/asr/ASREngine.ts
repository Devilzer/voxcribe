import type { ASRCapabilities, ASRConfig, AudioInput, Transcript } from './types';

/**
 * Contract every local speech-recognition backend implements.
 * The rest of the app only talks to engines through `ASRManager`.
 *
 * Implementations: WhisperCppEngine (whisper.cpp), later ParakeetEngine (NeMo-Speech.cpp).
 */
export interface ASREngine {
  /** Matches `ModelInfo.engine`. */
  readonly id: string;
  readonly name: string;
  readonly capabilities: ASRCapabilities;

  /** Loads the model at `modelPath`. Calling again with another path reloads. */
  initialize(modelPath: string): Promise<void>;

  isInitialized(): boolean;

  transcribe(audio: AudioInput, config?: Partial<ASRConfig>): Promise<Transcript>;

  /** Frees native resources. Safe to call more than once. */
  dispose(): Promise<void>;
}
