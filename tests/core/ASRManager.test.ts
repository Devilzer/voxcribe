import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASRManager } from '@core/asr/ASRManager';
import { MockASREngine } from '@core/asr/engines/MockASREngine';
import type { AudioInput } from '@core/asr/types';
import { silentLogger } from '@core/logging/Logger';
import { HttpModelDownloader } from '@core/models/ModelDownloader';
import { LocalModelManager } from '@core/models/ModelManager';
import { BUILTIN_MODELS, ModelRegistry } from '@core/models/ModelRegistry';
import { Sha256ModelVerifier } from '@core/models/ModelVerifier';
import { useTempDir } from '../helpers/fs';
import { FAKE_MODEL_BYTES, fakeFetch, fakeModel } from '../helpers/models';

const audio: AudioInput = { kind: 'pcm', samples: new Float32Array(16_000), sampleRate: 16_000, channels: 1, durationMs: 1000 };

class TrackingEngine extends MockASREngine {
  initializedWith: string[] = [];
  disposed = 0;
  override async initialize(modelPath: string) {
    this.initializedWith.push(modelPath);
    await super.initialize(modelPath);
  }
  override async dispose() {
    this.disposed += 1;
    await super.dispose();
  }
}

async function setup(modelsDir: string, installed: boolean) {
  const model = fakeModel();
  const registry = new ModelRegistry([...BUILTIN_MODELS, model]);
  const modelManager = new LocalModelManager({
    registry,
    downloader: new HttpModelDownloader({ fetch: fakeFetch({}).fetch }),
    verifier: new Sha256ModelVerifier(),
    modelsDir,
    logger: silentLogger,
  });
  if (installed) {
    await mkdir(join(modelsDir, 'whisper'), { recursive: true });
    await writeFile(join(modelsDir, 'whisper', model.filename), FAKE_MODEL_BYTES);
  }
  const manager = new ASRManager({ modelManager, logger: silentLogger });
  const engine = new TrackingEngine({ id: 'whisper' });
  manager.registerEngine(engine);
  return { manager, engine, model };
}

describe('ASRManager', () => {
  const tempDir = useTempDir();

  it('rejects duplicate engines', async () => {
    const { manager } = await setup(await tempDir(), false);
    expect(() => manager.registerEngine(new MockASREngine({ id: 'whisper' }))).toThrow();
  });

  it('refuses to transcribe without an active model', async () => {
    const { manager } = await setup(await tempDir(), false);
    await expect(manager.transcribe(audio)).rejects.toMatchObject({ code: 'ASR_NO_MODEL_SELECTED' });
  });

  it('refuses to transcribe with a model that is not installed', async () => {
    const { manager, model } = await setup(await tempDir(), false);
    await manager.selectModel(model.id);
    await expect(manager.assertReady()).rejects.toMatchObject({
      code: 'MODEL_NOT_INSTALLED',
      details: { modelName: 'Fake Small' },
    });
    await expect(manager.transcribe(audio)).rejects.toMatchObject({ code: 'MODEL_NOT_INSTALLED' });
  });

  it('initializes the engine with the installed model path once, then transcribes', async () => {
    const dir = await tempDir();
    const { manager, engine, model } = await setup(dir, true);
    await manager.selectModel(model.id);

    const first = await manager.transcribe(audio, { language: 'en' });
    await manager.transcribe(audio);

    expect(first).toMatchObject({ engineId: 'whisper', modelId: model.id });
    expect(engine.initializedWith).toEqual([join(dir, 'whisper', model.filename)]);
  });

  it('disposes the engine when the model changes or the manager is disposed', async () => {
    const { manager, engine, model } = await setup(await tempDir(), true);
    await manager.selectModel(model.id);
    await manager.transcribe(audio);
    await manager.selectModel('whisper-base');
    expect(engine.disposed).toBe(1);
    await manager.dispose();
    expect(manager.getActiveModelId()).toBeNull();
  });

  it('refuses planned models and unknown ids', async () => {
    const { manager } = await setup(await tempDir(), false);
    await expect(manager.selectModel('parakeet-tdt-0.6b-v3')).rejects.toMatchObject({ code: 'MODEL_NOT_AVAILABLE' });
    await expect(manager.selectModel('nope')).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
  });
});
