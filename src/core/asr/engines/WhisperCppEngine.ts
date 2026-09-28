import { existsSync } from 'node:fs';
import { ASRError } from '../../errors';
import type { Logger } from '../../logging/Logger';
import type { NativeRuntimeLocator } from '../../runtime/NativeRuntime';
import { WHISPER_CPP_RUNTIME_ID } from '../../runtime/runtimes';
import type { ASREngine } from '../ASREngine';
import type { ASRCapabilities, ASRConfig, AudioInput, Transcript } from '../types';

export interface WhisperCppEngineDeps {
  runtimeLocator: NativeRuntimeLocator;
  logger: Logger;
  /** Injected for tests. */
  fileExists?: (path: string) => boolean;
}

/**
 * ASR engine backed by whisper.cpp (https://github.com/ggml-org/whisper.cpp).
 * Loads GGML models from `<userData>/models/whisper/`.
 */
export class WhisperCppEngine implements ASREngine {
  readonly id = 'whisper';
  readonly name = 'Whisper (whisper.cpp)';
  readonly capabilities: ASRCapabilities = {
    streaming: false,
    multilingual: true,
    timestamps: true,
    translation: true,
    sampleRates: [16_000],
  };

  private modelPath: string | null = null;
  private readonly fileExists: (path: string) => boolean;

  constructor(private readonly deps: WhisperCppEngineDeps) {
    this.fileExists = deps.fileExists ?? existsSync;
  }

  async initialize(modelPath: string): Promise<void> {
    if (!this.fileExists(modelPath)) {
      throw new ASRError('WHISPER_MODEL_NOT_FOUND', `Whisper model not found at ${modelPath}`, {
        details: { modelPath },
      });
    }

    // Throws NATIVE_RUNTIME_NOT_FOUND when resources/binaries/whisper.cpp is missing.
    const runtime = this.deps.runtimeLocator.require(WHISPER_CPP_RUNTIME_ID);
    this.deps.logger.info('whisper.cpp runtime located', { executablePath: runtime.executablePath });

    // TODO(whisper.cpp): start the native runtime and load the model. Options:
    //   a) spawn `whisper-server` once with `-m <modelPath>` and keep it warm, or
    //   b) load a Node-API addon built from whisper.cpp in a utilityProcess.
    // Either way this must run in the main process (never the renderer).
    this.modelPath = modelPath;
  }

  isInitialized(): boolean {
    return this.modelPath !== null;
  }

  async transcribe(audio: AudioInput, config?: Partial<ASRConfig>): Promise<Transcript> {
    if (!this.modelPath) {
      throw new ASRError('ASR_ENGINE_NOT_INITIALIZED', 'WhisperCppEngine.initialize() was not called');
    }
    if (audio.sampleRate !== 16_000) {
      throw new ASRError('ASR_TRANSCRIPTION_FAILED', `whisper.cpp needs 16 kHz audio, got ${audio.sampleRate}`);
    }

    // TODO(whisper.cpp): native inference goes here.
    //   1. Send `audio.samples` (16 kHz mono f32) to the runtime.
    //   2. Pass `config.language`, `config.translate`, `config.threads`, `config.initialPrompt`.
    //   3. Map whisper segments (t0/t1 in 10 ms units) to TranscriptSegment (seconds).
    //   4. Build the result with `createTranscript()` from @shared/transcript.
    this.deps.logger.debug('transcribe() called', { durationMs: audio.durationMs, language: config?.language });
    throw new ASRError('ASR_NOT_IMPLEMENTED', 'whisper.cpp inference is not implemented yet');
  }

  async dispose(): Promise<void> {
    // TODO(whisper.cpp): stop the native runtime / free the whisper context.
    this.modelPath = null;
  }
}
