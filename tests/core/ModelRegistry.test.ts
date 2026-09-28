import { describe, expect, it } from 'vitest';
import { silentLogger } from '@core/logging/Logger';
import { LocalModelManager } from '@core/models/ModelManager';
import { BUILTIN_MODELS, ModelRegistry } from '@core/models/ModelRegistry';

describe('ModelRegistry', () => {
  it('contains the six Whisper models, none installed', () => {
    const whisper = new ModelRegistry().listByEngine('whisper');
    expect(whisper.map((model) => model.name)).toEqual([
      'Whisper Tiny',
      'Whisper Base',
      'Whisper Small',
      'Whisper Medium',
      'Whisper Large V3',
      'Whisper Large V3 Turbo',
    ]);
    expect(whisper.every((model) => !model.installed && model.runtime === 'whisper.cpp')).toBe(true);
  });

  it('announces Parakeet as a planned model on its own engine/runtime', () => {
    const parakeet = new ModelRegistry().get('parakeet-tdt-0.6b-v3');
    expect(parakeet.engine).toBe('parakeet');
    expect(parakeet.runtime).toBe('nemo-speech-cpp');
    expect(parakeet.availability).toBe('planned');
  });

  it('has unique ids and rejects duplicates', () => {
    const ids = BUILTIN_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(() => new ModelRegistry([...BUILTIN_MODELS, BUILTIN_MODELS[0]!])).toThrow(/Duplicate/);
  });

  it('returns copies so callers cannot mutate the catalog', () => {
    const registry = new ModelRegistry();
    registry.get('whisper-tiny').name = 'mutated';
    expect(registry.get('whisper-tiny').name).toBe('Whisper Tiny');
  });
});

describe('LocalModelManager', () => {
  it('resolves model paths under <modelsDir>/<engine>/ and detects installed files', async () => {
    const manager = new LocalModelManager({
      registry: new ModelRegistry(),
      modelsDir: '/user-data/models',
      logger: silentLogger,
      fileExists: (path) => path === '/user-data/models/whisper/ggml-base.bin',
    });
    expect(manager.getModelPath('whisper-base')).toBe('/user-data/models/whisper/ggml-base.bin');
    expect(await manager.checkInstalled('whisper-base')).toBe(true);
    expect((await manager.listInstalled()).map((model) => model.id)).toEqual(['whisper-base']);
    await expect(manager.download('whisper-base')).rejects.toMatchObject({ code: 'MODEL_DOWNLOAD_NOT_IMPLEMENTED' });
  });
});
