import { describe, expect, it } from 'vitest';
import { ASRManager } from '@core/asr/ASRManager';
import { MockASREngine } from '@core/asr/engines/MockASREngine';
import { WhisperCppEngine } from '@core/asr/engines/WhisperCppEngine';
import type { AudioInput } from '@core/asr/types';
import { VoxcribeError } from '@core/errors';
import { silentLogger } from '@core/logging/Logger';
import { LocalModelManager } from '@core/models/ModelManager';
import { ModelRegistry } from '@core/models/ModelRegistry';
import { NativeRuntimeLocator } from '@core/runtime/NativeRuntime';
import { NATIVE_RUNTIMES } from '@core/runtime/runtimes';

const audio: AudioInput = { samples: new Float32Array(16_000), sampleRate: 16_000, channels: 1, durationMs: 1000 };

function setup(existingFiles: string[] = []) {
  const fileExists = (path: string) => existingFiles.some((file) => path.endsWith(file));
  const modelManager = new LocalModelManager({
    registry: new ModelRegistry(),
    modelsDir: '/data/models',
    logger: silentLogger,
    fileExists,
  });
  const manager = new ASRManager({ modelManager, logger: silentLogger });
  const runtimeLocator = new NativeRuntimeLocator({
    binariesDir: '/app/binaries',
    definitions: NATIVE_RUNTIMES,
    platform: 'linux',
    arch: 'x64',
    fileExists,
  });
  return { manager, modelManager, runtimeLocator };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(VoxcribeError);
  expect((error as VoxcribeError).code).toBe(code);
  return error as VoxcribeError;
}

describe('ASRManager', () => {
  it('registers engines and rejects duplicates', () => {
    const { manager } = setup();
    manager.registerEngine(new MockASREngine({ id: 'whisper' }));
    expect(manager.listEngines().map((engine) => engine.id)).toEqual(['whisper']);
    expect(() => manager.registerEngine(new MockASREngine({ id: 'whisper' }))).toThrow(VoxcribeError);
  });

  it('selects the engine that matches the model and transcribes', async () => {
    const { manager } = setup();
    manager.registerEngine(new MockASREngine({ id: 'whisper' }));
    await manager.selectModel('whisper-small');

    expect(manager.getActiveEngine()?.id).toBe('whisper');
    const transcript = await manager.transcribe(audio, { language: 'en' });
    expect(transcript.text.length).toBeGreaterThan(0);
    expect(transcript.engineId).toBe('whisper');
    expect(transcript.modelId).toBe('whisper-small');
  });

  it('refuses planned models and models without an engine', async () => {
    const { manager } = setup();
    manager.registerEngine(new MockASREngine({ id: 'whisper' }));
    await expectCode(manager.selectModel('parakeet-tdt-0.6b-v3'), 'MODEL_NOT_AVAILABLE');
    await expectCode(manager.selectModel('does-not-exist'), 'MODEL_NOT_FOUND');
  });

  it('requires a model before transcribing', async () => {
    const { manager } = setup();
    manager.registerEngine(new MockASREngine({ id: 'whisper' }));
    await expectCode(manager.transcribe(audio), 'ASR_NO_MODEL_SELECTED');
  });

  it('surfaces WHISPER_MODEL_NOT_FOUND with the model name when the file is missing', async () => {
    const { manager, runtimeLocator } = setup();
    manager.registerEngine(new WhisperCppEngine({ runtimeLocator, logger: silentLogger, fileExists: () => false }));
    await manager.selectModel('whisper-small');
    const error = await expectCode(manager.transcribe(audio), 'WHISPER_MODEL_NOT_FOUND');
    expect(error.details?.modelName).toBe('Whisper Small');
  });

  it('WhisperCppEngine reports the missing native runtime, then not-implemented inference', async () => {
    const modelFile = 'whisper/ggml-small.bin';
    const { manager, runtimeLocator } = setup([modelFile]);
    manager.registerEngine(
      new WhisperCppEngine({ runtimeLocator, logger: silentLogger, fileExists: (path) => path.endsWith(modelFile) }),
    );
    await manager.selectModel('whisper-small');
    await expectCode(manager.transcribe(audio), 'NATIVE_RUNTIME_NOT_FOUND');

    const withBinary = setup([modelFile, 'whisper.cpp/linux-x64/whisper-cli']);
    withBinary.manager.registerEngine(
      new WhisperCppEngine({
        runtimeLocator: withBinary.runtimeLocator,
        logger: silentLogger,
        fileExists: (path) => path.endsWith(modelFile),
      }),
    );
    await withBinary.manager.selectModel('whisper-small');
    await expectCode(withBinary.manager.transcribe(audio), 'ASR_NOT_IMPLEMENTED');
  });
});
