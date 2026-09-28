import { describe, expect, it } from 'vitest';
import { BUILTIN_MODELS, ModelRegistry, validateModelDefinition } from '@core/models/ModelRegistry';
import { fakeModel } from '../helpers/models';

describe('ModelRegistry', () => {
  const registry = new ModelRegistry();

  it('registers Whisper Base, Small and Large V3 Turbo for whisper.cpp', () => {
    expect(registry.listByEngine('whisper').map((model) => model.name)).toEqual([
      'Whisper Base',
      'Whisper Small',
      'Whisper Large V3 Turbo',
    ]);
  });

  it('has unique ids and filenames', () => {
    const ids = BUILTIN_MODELS.map((model) => model.id);
    const files = BUILTIN_MODELS.map((model) => `${model.engine}/${model.filename}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(files).size).toBe(files.length);
  });

  it('pins URL, size and SHA-256 for every downloadable model', () => {
    for (const model of BUILTIN_MODELS) {
      if (model.availability !== 'available') continue;
      expect(model.downloadUrl).toMatch(/^https:\/\/huggingface\.co\/ggerganov\/whisper\.cpp\/resolve\/[0-9a-f]{40}\//);
      expect(model.downloadUrl.endsWith(`/${model.filename}`)).toBe(true);
      expect(model.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(model.sizeBytes).toBeGreaterThan(0);
      expect(model.filename).toMatch(/^ggml-[a-z0-9-]+\.bin$/);
      expect(model.runtime).toBe('whisper.cpp');
      expect(model.format).toBe('ggml');
    }
  });

  it('keeps Parakeet as a planned model on its own engine/runtime', () => {
    const parakeet = registry.get('parakeet-tdt-0.6b-v3');
    expect(parakeet).toMatchObject({ engine: 'parakeet', runtime: 'nemo-speech-cpp', availability: 'planned' });
    expect(() => registry.getDownloadable('parakeet-tdt-0.6b-v3')).toThrow(expect.objectContaining({ code: 'MODEL_NOT_AVAILABLE' }));
  });

  it('rejects duplicates and unknown ids', () => {
    expect(() => new ModelRegistry([...BUILTIN_MODELS, BUILTIN_MODELS[0]!])).toThrow(/Duplicate/);
    expect(() => registry.get('nope')).toThrow(expect.objectContaining({ code: 'MODEL_NOT_FOUND' }));
  });

  it('rejects unsafe or incomplete definitions', () => {
    expect(() => validateModelDefinition(fakeModel({ filename: '../evil.bin' }))).toThrow(/filename/);
    expect(() => validateModelDefinition(fakeModel({ sha256: 'abc' }))).toThrow(/sha256/);
    expect(() => validateModelDefinition(fakeModel({ downloadUrl: 'http://huggingface.co/x/ggml-fake.bin' }))).toThrow(/https/);
    expect(() => validateModelDefinition(fakeModel({ sizeBytes: 0 }))).toThrow(/sizeBytes/);
  });

  it('returns copies so callers cannot mutate the catalog', () => {
    registry.get('whisper-base').name = 'mutated';
    expect(registry.get('whisper-base').name).toBe('Whisper Base');
  });
});
