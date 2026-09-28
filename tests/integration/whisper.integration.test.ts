/**
 * End-to-end check of the real stack, without Electron:
 *   Hugging Face download → SHA-256 verification → whisper-cli → test-audio/sample.wav → Transcript
 *
 * Run with `npm run test:integration`. Skipped by `npm test`.
 * Env:
 *   VOXCRIBE_MODEL       registry id (default whisper-small)
 *   VOXCRIBE_MODELS_DIR  models dir (default: the Linux userData dir, ~/.config/Voxcribe/models)
 *   VOXCRIBE_AUDIO       WAV file (default test-audio/sample.wav)
 */
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASRManager } from '@core/asr/ASRManager';
import { WhisperCppEngine } from '@core/asr/engines/whisper/WhisperCppEngine';
import { readWavInfo } from '@core/audio/wav';
import { createLogger } from '@core/logging/Logger';
import { HttpModelDownloader } from '@core/models/ModelDownloader';
import { LocalModelManager } from '@core/models/ModelManager';
import { ModelRegistry } from '@core/models/ModelRegistry';
import { Sha256ModelVerifier } from '@core/models/ModelVerifier';
import { NodeProcessRunner } from '@core/process/ProcessRunner';
import { NativeRuntimeLocator } from '@core/runtime/NativeRuntime';
import { NATIVE_RUNTIMES } from '@core/runtime/runtimes';

const root = resolve(__dirname, '../..');
const modelId = process.env.VOXCRIBE_MODEL ?? 'whisper-small';
const modelsDir = process.env.VOXCRIBE_MODELS_DIR ?? join(homedir(), '.config', 'Voxcribe', 'models');
const audioPath = process.env.VOXCRIBE_AUDIO ?? join(root, 'test-audio', 'sample.wav');

describe.skipIf(!process.env.VOXCRIBE_INTEGRATION)('whisper.cpp integration', () => {
  it(
    `downloads/verifies ${modelId} and transcribes ${audioPath}`,
    async () => {
      const logger = createLogger('integration', { level: 'info' });
      const models = new LocalModelManager({
        registry: new ModelRegistry(),
        downloader: new HttpModelDownloader(),
        verifier: new Sha256ModelVerifier(),
        modelsDir,
        logger: logger.child('models'),
        progressIntervalMs: 5000,
      });

      if (!(await models.isInstalled(modelId))) {
        await models.downloadModel(modelId, (progress) => {
          if (progress.status !== 'downloading' || progress.percentage % 10 === 0) {
            logger.info(`${progress.status} ${progress.percentage}%`);
          }
        });
      }
      expect(await models.isInstalled(modelId)).toBe(true);

      const runtimes = new NativeRuntimeLocator({ binariesDir: join(root, 'resources', 'binaries'), definitions: NATIVE_RUNTIMES });
      const asr = new ASRManager({ modelManager: models, logger: logger.child('asr') });
      asr.registerEngine(
        new WhisperCppEngine({ runtimeLocator: runtimes, processRunner: new NodeProcessRunner(), tempDir: tmpdir(), logger: logger.child('whisper') }),
      );
      await asr.selectModel(modelId);

      expect(existsSync(audioPath)).toBe(true);
      const info = await readWavInfo(audioPath);
      const started = Date.now();
      const transcript = await asr.transcribe({ kind: 'file', path: audioPath, format: 'wav', durationMs: info.durationMs }, { language: 'auto' });
      logger.info(`Transcribed ${info.durationMs} ms of audio in ${Date.now() - started} ms`, {
        text: transcript.text,
        language: transcript.language,
        segments: transcript.segments.length,
      });
      await asr.dispose();

      expect(transcript.text.length).toBeGreaterThan(0);
      expect(transcript.segments.length).toBeGreaterThan(0);
      expect(transcript.segments[0]!.end).toBeGreaterThan(transcript.segments[0]!.start);
      if (audioPath.endsWith('sample.wav')) expect(transcript.text.toLowerCase()).toContain('country');
    },
    30 * 60 * 1000,
  );
});
