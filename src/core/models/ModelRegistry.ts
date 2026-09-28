import type { DownloadableModelDefinition, ModelDefinition } from '@shared/types';
import { ModelError } from '../errors';

/**
 * whisper.cpp GGML models from https://huggingface.co/ggerganov/whisper.cpp,
 * pinned to one immutable commit so URL, size and checksum always agree.
 * Sizes and SHA-256 values are the Git LFS metadata of that commit.
 */
const WHISPER_CPP_REPO = 'https://huggingface.co/ggerganov/whisper.cpp';
const WHISPER_CPP_REVISION = '5359861c739e955e79d9a303bcbc70fb988958b1';

const WHISPER_BASE = {
  engine: 'whisper',
  runtime: 'whisper.cpp',
  provider: 'OpenAI Whisper (GGML conversion by ggml-org)',
  format: 'ggml',
  languages: ['*'],
  availability: 'available',
  capabilities: { multilingual: true, streaming: false, timestamps: true },
} as const;

function whisperModel(
  model: Pick<DownloadableModelDefinition, 'id' | 'name' | 'filename' | 'sizeBytes' | 'sha256' | 'tagline' | 'description'>,
): DownloadableModelDefinition {
  return {
    ...WHISPER_BASE,
    languages: [...WHISPER_BASE.languages],
    capabilities: { ...WHISPER_BASE.capabilities },
    ...model,
    downloadUrl: `${WHISPER_CPP_REPO}/resolve/${WHISPER_CPP_REVISION}/${model.filename}`,
  };
}

/** Single source of truth for every model the app knows about. */
export const BUILTIN_MODELS: readonly ModelDefinition[] = [
  whisperModel({
    id: 'whisper-base',
    name: 'Whisper Base',
    filename: 'ggml-base.bin',
    sizeBytes: 147_951_465,
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    tagline: 'Fast',
    description: 'Quick and light. Good for short, clear dictation.',
  }),
  whisperModel({
    id: 'whisper-small',
    name: 'Whisper Small',
    filename: 'ggml-small.bin',
    sizeBytes: 487_601_967,
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    tagline: 'Balanced',
    description: 'Good accuracy at a reasonable speed.',
  }),
  whisperModel({
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large V3 Turbo',
    filename: 'ggml-large-v3-turbo.bin',
    sizeBytes: 1_624_555_275,
    sha256: '1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69',
    tagline: 'High accuracy',
    description: 'Best accuracy. Needs a fast CPU or GPU.',
  }),
  {
    id: 'parakeet-tdt-0.6b-v3',
    name: 'Parakeet TDT 0.6B v3',
    engine: 'parakeet',
    runtime: 'nemo-speech-cpp',
    provider: 'NVIDIA',
    // TODO(parakeet): confirm the on-disk format produced for NeMo-Speech.cpp.
    format: 'gguf',
    languages: [
      'bg', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr', 'de', 'el', 'hu', 'it',
      'lv', 'lt', 'mt', 'pl', 'pt', 'ro', 'sk', 'sl', 'es', 'sv', 'ru', 'uk',
    ],
    filename: 'parakeet-tdt-0.6b-v3.gguf',
    availability: 'planned',
    capabilities: { multilingual: true, streaming: true, timestamps: true },
    tagline: 'Coming soon',
    description: 'Fast European-language ASR.',
  },
];

const ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;
const FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/** Throws if a definition is unsafe or incomplete. Runs for every registered model. */
export function validateModelDefinition(model: ModelDefinition): void {
  const fail = (reason: string) => {
    throw new Error(`Invalid model "${model.id}": ${reason}`);
  };
  if (!ID_PATTERN.test(model.id)) fail('bad id');
  if (!FILENAME_PATTERN.test(model.filename) || model.filename.includes('..')) fail('filename must be a plain file name');
  if (model.name.trim().length === 0) fail('missing name');
  if (model.availability === 'available') {
    if (!SHA256_PATTERN.test(model.sha256)) fail('sha256 must be 64 lowercase hex chars');
    if (!Number.isSafeInteger(model.sizeBytes) || model.sizeBytes <= 0) fail('sizeBytes must be a positive integer');
    const url = new URL(model.downloadUrl);
    if (url.protocol !== 'https:') fail('downloadUrl must be https');
    if (!url.pathname.endsWith(`/${model.filename}`)) fail('downloadUrl must end with the filename');
  }
}

/** Metadata-only catalog. Holds no install state. */
export class ModelRegistry {
  private readonly models = new Map<string, ModelDefinition>();

  constructor(models: readonly ModelDefinition[] = BUILTIN_MODELS) {
    for (const model of models) this.register(model);
  }

  register(model: ModelDefinition): void {
    validateModelDefinition(model);
    if (this.models.has(model.id)) throw new Error(`Duplicate model id "${model.id}"`);
    this.models.set(model.id, structuredClone(model));
  }

  list(): ModelDefinition[] {
    return [...this.models.values()].map((model) => structuredClone(model));
  }

  listByEngine(engine: string): ModelDefinition[] {
    return this.list().filter((model) => model.engine === engine);
  }

  has(id: string): boolean {
    return this.models.has(id);
  }

  find(id: string): ModelDefinition | undefined {
    const model = this.models.get(id);
    return model ? structuredClone(model) : undefined;
  }

  get(id: string): ModelDefinition {
    const model = this.find(id);
    if (!model) throw new ModelError('MODEL_NOT_FOUND', `Unknown model "${id}"`, { details: { modelId: id } });
    return model;
  }

  /** Like `get`, but only for models that can be downloaded now. */
  getDownloadable(id: string): DownloadableModelDefinition {
    const model = this.get(id);
    if (model.availability !== 'available') {
      throw new ModelError('MODEL_NOT_AVAILABLE', `Model "${id}" is not available yet`, {
        details: { modelName: model.name },
      });
    }
    return model;
  }
}
