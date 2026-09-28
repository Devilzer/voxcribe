import { ModelError } from '../errors';
import type { ModelInfo } from './types';

const MB = 1_000_000;
const WHISPER_BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

const WHISPER_CAPABILITIES = { streaming: false, multilingual: true, timestamps: true } as const;

function whisperModel(
  id: string,
  name: string,
  fileName: string,
  sizeBytes: number,
  description: string,
): ModelInfo {
  return {
    id,
    name,
    engine: 'whisper',
    runtime: 'whisper.cpp',
    provider: 'OpenAI (GGML conversion by ggml-org)',
    format: 'ggml',
    languages: ['*'],
    fileName,
    sizeBytes,
    downloadUrl: `${WHISPER_BASE_URL}/${fileName}`,
    // TODO(models): pin SHA-256 checksums before enabling downloads.
    checksum: undefined,
    installed: false,
    availability: 'available',
    capabilities: WHISPER_CAPABILITIES,
    description,
  };
}

/** Built-in model catalog. Sizes are approximate. */
export const BUILTIN_MODELS: readonly ModelInfo[] = [
  whisperModel('whisper-tiny', 'Whisper Tiny', 'ggml-tiny.bin', 75 * MB, 'Fastest, lowest accuracy.'),
  whisperModel('whisper-base', 'Whisper Base', 'ggml-base.bin', 142 * MB, 'Fast with fair accuracy.'),
  whisperModel('whisper-small', 'Whisper Small', 'ggml-small.bin', 466 * MB, 'Good balance for dictation.'),
  whisperModel('whisper-medium', 'Whisper Medium', 'ggml-medium.bin', 1_500 * MB, 'High accuracy, slower.'),
  whisperModel('whisper-large-v3', 'Whisper Large V3', 'ggml-large-v3.bin', 2_900 * MB, 'Best accuracy, needs a strong machine.'),
  whisperModel(
    'whisper-large-v3-turbo',
    'Whisper Large V3 Turbo',
    'ggml-large-v3-turbo.bin',
    1_600 * MB,
    'Near Large V3 accuracy, much faster.',
  ),
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
    fileName: 'parakeet-tdt-0.6b-v3.gguf',
    installed: false,
    availability: 'planned',
    capabilities: { streaming: true, multilingual: true, timestamps: true },
    description: 'Fast European-language ASR. Coming soon.',
  },
];

/** Metadata-only catalog of known models. Holds no installation state. */
export class ModelRegistry {
  private readonly models = new Map<string, ModelInfo>();

  constructor(models: readonly ModelInfo[] = BUILTIN_MODELS) {
    for (const model of models) this.register(model);
  }

  register(model: ModelInfo): void {
    if (this.models.has(model.id)) throw new Error(`Duplicate model id "${model.id}"`);
    this.models.set(model.id, { ...model });
  }

  list(): ModelInfo[] {
    return [...this.models.values()].map((model) => ({ ...model }));
  }

  listByEngine(engine: string): ModelInfo[] {
    return this.list().filter((model) => model.engine === engine);
  }

  find(id: string): ModelInfo | undefined {
    const model = this.models.get(id);
    return model ? { ...model } : undefined;
  }

  get(id: string): ModelInfo {
    const model = this.find(id);
    if (!model) throw new ModelError('MODEL_NOT_FOUND', `Unknown model "${id}"`, { details: { modelId: id } });
    return model;
  }
}
