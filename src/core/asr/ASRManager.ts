import { ASRError, ModelError, VoxcribeError } from '../errors';
import type { Logger } from '../logging/Logger';
import type { ModelInfo, ModelManager } from '../models/types';
import type { ASREngine } from './ASREngine';
import type { ASRConfig, AudioInput, Transcript } from './types';

export interface ASRManagerDeps {
  modelManager: ModelManager;
  logger: Logger;
}

/**
 * Single entry point for speech recognition. Owns the registered engines,
 * the active model and the engine lifecycle. Transcriptions run one at a time.
 */
export class ASRManager {
  private readonly engines = new Map<string, ASREngine>();
  private activeModelId: string | null = null;
  /** Engine + model path currently initialized. */
  private loaded: { engine: ASREngine; modelPath: string } | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: ASRManagerDeps) {}

  registerEngine(engine: ASREngine): void {
    if (this.engines.has(engine.id)) {
      throw new ASRError('ASR_ENGINE_NOT_FOUND', `Engine "${engine.id}" is already registered`);
    }
    this.engines.set(engine.id, engine);
    this.deps.logger.debug(`Registered ASR engine ${engine.id}`);
  }

  listEngines(): ASREngine[] {
    return [...this.engines.values()];
  }

  getEngine(id: string): ASREngine {
    const engine = this.engines.get(id);
    if (!engine) throw new ASRError('ASR_ENGINE_NOT_FOUND', `No ASR engine registered with id "${id}"`);
    return engine;
  }

  getActiveModelId(): string | null {
    return this.activeModelId;
  }

  /** Sets the active model (or clears it). Validates it can run; does not require it to be installed. */
  async selectModel(modelId: string | null): Promise<void> {
    if (modelId === null) {
      await this.unload();
      this.activeModelId = null;
      return;
    }
    const model = this.deps.modelManager.getModel(modelId);
    this.assertRunnable(model);
    if (this.activeModelId !== modelId) {
      await this.unload();
      this.activeModelId = modelId;
    }
  }

  /** Throws the user-facing reason why transcription can't start (no model, not installed, ...). */
  async assertReady(): Promise<ModelInfo> {
    if (!this.activeModelId) {
      throw new ASRError('ASR_NO_MODEL_SELECTED', 'No active model');
    }
    const model = this.deps.modelManager.getModel(this.activeModelId);
    this.assertRunnable(model);
    if (!model.installed) {
      throw new ModelError('MODEL_NOT_INSTALLED', `${model.id} is not installed`, { details: { modelName: model.name } });
    }
    return model;
  }

  transcribe(audio: AudioInput, config?: Partial<ASRConfig>): Promise<Transcript> {
    const run = this.queue.then(() => this.transcribeNow(audio, config));
    this.queue = run.catch(() => undefined);
    return run;
  }

  async dispose(): Promise<void> {
    await this.unload();
    this.activeModelId = null;
  }

  private async transcribeNow(audio: AudioInput, config?: Partial<ASRConfig>): Promise<Transcript> {
    // 1–2. Active model exists and is installed.
    const model = await this.assertReady();
    // 3. Resolve the verified model file.
    const modelPath = await this.deps.modelManager.getModelPath(model.id);
    if (!modelPath) {
      throw new ModelError('MODEL_NOT_INSTALLED', `${model.id} is not installed`, { details: { modelName: model.name } });
    }
    const engine = this.getEngine(model.engine);

    try {
      // 4. Initialize (once per engine + model).
      if (this.loaded?.engine !== engine || this.loaded.modelPath !== modelPath || !engine.isInitialized()) {
        await this.unload();
        this.deps.logger.info(`Initializing ${engine.id} with ${model.id}`);
        await engine.initialize(modelPath);
        this.loaded = { engine, modelPath };
      }
      // 5–6. Transcribe.
      const transcript = await engine.transcribe(audio, config);
      return { ...transcript, engineId: engine.id, modelId: model.id };
    } catch (error) {
      if (error instanceof VoxcribeError) throw error.withDetails({ modelName: model.name });
      throw new ASRError('ASR_TRANSCRIPTION_FAILED', `Transcription with ${engine.id} failed`, {
        cause: error,
        details: { modelName: model.name },
      });
    }
  }

  private assertRunnable(model: ModelInfo): void {
    if (model.availability !== 'available') {
      throw new ModelError('MODEL_NOT_AVAILABLE', `Model "${model.id}" is not available yet`, {
        details: { modelName: model.name },
      });
    }
    if (!this.engines.has(model.engine)) {
      throw new ModelError('MODEL_ENGINE_MISMATCH', `No engine "${model.engine}" for model "${model.id}"`, {
        details: { modelName: model.name },
      });
    }
  }

  /** 7. Release native resources. */
  private async unload(): Promise<void> {
    const loaded = this.loaded;
    this.loaded = null;
    if (loaded) await loaded.engine.dispose();
  }
}
