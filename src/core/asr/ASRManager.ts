import { ASRError, VoxcribeError, ModelError } from '../errors';
import type { Logger } from '../logging/Logger';
import type { ModelManager } from '../models/types';
import type { ASREngine } from './ASREngine';
import type { ASRConfig, AudioInput, Transcript } from './types';

export interface ASRManagerDeps {
  modelManager: ModelManager;
  logger: Logger;
}

/**
 * Single entry point for speech recognition. Owns the registered engines,
 * the active engine/model selection and the engine lifecycle.
 */
export class ASRManager {
  private readonly engines = new Map<string, ASREngine>();
  private activeEngineId: string | null = null;
  private selectedModelId: string | null = null;
  /** Model currently loaded into the active engine. */
  private loadedModelId: string | null = null;

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

  getActiveEngine(): ASREngine | null {
    return this.activeEngineId ? this.getEngine(this.activeEngineId) : null;
  }

  getSelectedModelId(): string | null {
    return this.selectedModelId;
  }

  async setActiveEngine(id: string): Promise<void> {
    const engine = this.getEngine(id);
    if (this.activeEngineId === engine.id) return;
    await this.disposeActive();
    this.activeEngineId = engine.id;
  }

  /** Selects a model and switches to the engine that can run it. Loading is lazy. */
  async selectModel(modelId: string): Promise<void> {
    const model = this.deps.modelManager.getModel(modelId);
    if (model.availability !== 'available') {
      throw new ModelError('MODEL_NOT_AVAILABLE', `Model "${modelId}" is not available yet`, {
        details: { modelName: model.name },
      });
    }
    if (!this.engines.has(model.engine)) {
      throw new ModelError('MODEL_ENGINE_MISMATCH', `No engine "${model.engine}" for model "${modelId}"`, {
        details: { modelName: model.name },
      });
    }
    await this.setActiveEngine(model.engine);
    if (this.selectedModelId !== modelId) {
      this.selectedModelId = modelId;
      this.loadedModelId = null;
    }
  }

  /** Loads the selected model into the active engine. */
  async initialize(): Promise<void> {
    const engine = this.getActiveEngine();
    const modelId = this.selectedModelId;
    if (!engine || !modelId) {
      throw new ASRError('ASR_NO_MODEL_SELECTED', 'Select a model before initializing ASR');
    }
    if (this.loadedModelId === modelId && engine.isInitialized()) return;

    const model = this.deps.modelManager.getModel(modelId);
    const modelPath = this.deps.modelManager.getModelPath(modelId);
    this.deps.logger.info(`Initializing ${engine.id} with ${modelId}`, { modelPath });
    try {
      await engine.initialize(modelPath);
    } catch (error) {
      if (error instanceof VoxcribeError) throw error.withDetails({ modelName: model.name });
      throw new ASRError('ASR_ENGINE_NOT_INITIALIZED', `Failed to initialize ${engine.id}`, {
        cause: error,
        details: { modelName: model.name },
      });
    }
    this.loadedModelId = modelId;
  }

  async transcribe(audio: AudioInput, config?: Partial<ASRConfig>): Promise<Transcript> {
    await this.initialize();
    const engine = this.getActiveEngine();
    if (!engine) throw new ASRError('ASR_ENGINE_NOT_INITIALIZED', 'No active ASR engine');

    const transcript = await engine.transcribe(audio, config);
    return { ...transcript, engineId: engine.id, modelId: this.selectedModelId ?? undefined };
  }

  async dispose(): Promise<void> {
    await this.disposeActive();
    this.activeEngineId = null;
  }

  private async disposeActive(): Promise<void> {
    const engine = this.getActiveEngine();
    if (engine) await engine.dispose();
    this.loadedModelId = null;
  }
}
