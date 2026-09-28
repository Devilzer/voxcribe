import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { encodeWav, readWavInfo } from '../../../audio/wav';
import { ASRError, ModelError, NativeRuntimeError, type VoxcribeError } from '../../../errors';
import type { Logger } from '../../../logging/Logger';
import type { ProcessResult, ProcessRunner } from '../../../process/ProcessRunner';
import type { NativeRuntimeLocator } from '../../../runtime/NativeRuntime';
import { WHISPER_CPP_RUNTIME_ID } from '../../../runtime/runtimes';
import type { ASREngine } from '../../ASREngine';
import type { ASRCapabilities, ASRConfig, AudioInput, Transcript } from '../../types';
import { WhisperCliOutputParser } from './WhisperCliOutputParser';

export interface WhisperCppEngineDeps {
  runtimeLocator: NativeRuntimeLocator;
  processRunner: ProcessRunner;
  logger: Logger;
  /** Scratch space for converted audio and JSON output (e.g. app.getPath("temp")). */
  tempDir: string;
  threads?: number;
  /** Hard limit per transcription. */
  timeoutMs?: number;
  /** Injected for tests. */
  fileExists?: (path: string) => boolean;
}

const LANGUAGE_PATTERN = /^(auto|[a-z]{2,3})$/;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const STDERR_LOG_CHARS = 2000;

/**
 * ASR engine backed by whisper.cpp's `whisper-cli` (one process per transcription).
 * Runs only in the main process, only the binary found by `NativeRuntimeLocator`,
 * always with an argument array (never a shell string).
 */
export class WhisperCppEngine implements ASREngine {
  readonly id = 'whisper';
  readonly name = 'Whisper (whisper.cpp)';
  readonly capabilities: ASRCapabilities = {
    streaming: false,
    multilingual: true,
    timestamps: true,
    translation: true,
    fileFormats: ['wav'],
  };

  private modelPath: string | null = null;
  private executablePath: string | null = null;
  private readonly running = new Set<AbortController>();
  private readonly fileExists: (path: string) => boolean;
  private readonly threads: number;

  constructor(private readonly deps: WhisperCppEngineDeps) {
    this.fileExists = deps.fileExists ?? existsSync;
    this.threads = deps.threads ?? Math.max(1, Math.min(8, availableParallelism() - 1));
  }

  async initialize(modelPath: string): Promise<void> {
    this.executablePath = this.locateBinary();
    if (!this.fileExists(modelPath)) {
      throw new ModelError('MODEL_NOT_INSTALLED', 'Whisper model file is missing');
    }
    this.modelPath = modelPath;
    this.deps.logger.info('whisper.cpp ready', { executablePath: this.executablePath });
  }

  isInitialized(): boolean {
    return this.modelPath !== null && this.executablePath !== null;
  }

  async transcribe(audio: AudioInput, config: Partial<ASRConfig> = {}): Promise<Transcript> {
    const { modelPath, executablePath } = this;
    if (!modelPath || !executablePath) {
      throw new ASRError('ASR_ENGINE_NOT_INITIALIZED', 'WhisperCppEngine.initialize() was not called');
    }
    if (!this.fileExists(executablePath)) throw this.binaryMissing();
    if (!this.fileExists(modelPath)) throw new ModelError('MODEL_NOT_INSTALLED', 'Whisper model file was removed');

    const language = config.language ?? 'auto';
    if (!LANGUAGE_PATTERN.test(language)) {
      throw new ASRError('ASR_TRANSCRIPTION_FAILED', `Invalid language code "${language}"`);
    }

    const workDir = await mkdtemp(join(this.deps.tempDir, 'voxcribe-whisper-'));
    try {
      const { path: audioPath, durationMs } = await this.prepareAudio(audio, workDir);
      const outputPrefix = join(workDir, 'output');
      const args = [
        '--model', modelPath,
        '--file', audioPath,
        '--language', language,
        '--threads', String(config.threads ?? this.threads),
        '--no-prints',
        '--output-json',
        '--output-json-full',
        '--output-file', outputPrefix,
      ];
      if (config.translate) args.push('--translate');
      if (config.initialPrompt) args.push('--prompt', config.initialPrompt);

      const result = await this.runWhisper(executablePath, args);
      const duration = durationMs === undefined ? undefined : durationMs / 1000;
      const json = await readFile(`${outputPrefix}.json`, 'utf8').catch(() => null);
      return json === null
        ? WhisperCliOutputParser.parseText(result.stdout, { duration })
        : WhisperCliOutputParser.parseJson(json, { duration });
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async dispose(): Promise<void> {
    for (const controller of this.running) controller.abort();
    this.running.clear();
    this.modelPath = null;
    this.executablePath = null;
  }

  private locateBinary(): string {
    try {
      return this.deps.runtimeLocator.require(WHISPER_CPP_RUNTIME_ID).executablePath;
    } catch (error) {
      if (error instanceof NativeRuntimeError) throw this.binaryMissing(error);
      throw error;
    }
  }

  private binaryMissing(cause?: unknown): VoxcribeError {
    return new NativeRuntimeError('WHISPER_BINARY_NOT_FOUND', 'whisper-cli binary not found', { cause });
  }

  private async prepareAudio(audio: AudioInput, workDir: string): Promise<{ path: string; durationMs?: number }> {
    if (audio.kind === 'file') {
      const info = await readWavInfo(audio.path); // throws INVALID_AUDIO / AUDIO_FILE_NOT_FOUND
      return { path: audio.path, durationMs: info.durationMs };
    }
    const path = join(workDir, 'input.wav');
    await writeFile(path, encodeWav(audio));
    return { path, durationMs: audio.durationMs };
  }

  private async runWhisper(executablePath: string, args: string[]): Promise<ProcessResult> {
    const controller = new AbortController();
    this.running.add(controller);
    let result: ProcessResult;
    try {
      result = await this.deps.processRunner.run(executablePath, args, {
        timeoutMs: this.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        signal: controller.signal,
      });
    } catch (error) {
      throw new ASRError('WHISPER_PROCESS_FAILED', 'Could not start whisper-cli', { cause: error });
    } finally {
      this.running.delete(controller);
    }

    if (result.timedOut || result.exitCode !== 0) {
      this.deps.logger.error('whisper-cli failed', {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        stderr: result.stderr.slice(-STDERR_LOG_CHARS),
      });
      throw new ASRError(
        'WHISPER_PROCESS_FAILED',
        result.timedOut ? 'whisper-cli timed out' : `whisper-cli exited with code ${result.exitCode ?? result.signal}`,
        { details: { exitCode: result.exitCode ?? -1 } },
      );
    }
    return result;
  }
}
