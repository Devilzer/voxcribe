import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ModelError } from '../errors';
import type { Logger } from '../logging/Logger';
import type { ModelRegistry } from './ModelRegistry';
import type { DownloadProgress, ModelInfo, ModelManager } from './types';

export interface LocalModelManagerDeps {
  registry: ModelRegistry;
  /** `<userData>/models`. Never the app's source tree. */
  modelsDir: string;
  logger: Logger;
  fileExists?: (path: string) => boolean;
}

/**
 * Resolves model files under `<userData>/models/<engine>/<fileName>`.
 * Install detection is real; download / checksum / delete are stubs.
 */
export class LocalModelManager implements ModelManager {
  private readonly fileExists: (path: string) => boolean;

  constructor(private readonly deps: LocalModelManagerDeps) {
    this.fileExists = deps.fileExists ?? existsSync;
  }

  async list(): Promise<ModelInfo[]> {
    return this.deps.registry.list().map((model) => ({ ...model, installed: this.isInstalledSync(model) }));
  }

  async listInstalled(): Promise<ModelInfo[]> {
    return (await this.list()).filter((model) => model.installed);
  }

  getModel(id: string): ModelInfo {
    const model = this.deps.registry.get(id);
    return { ...model, installed: this.isInstalledSync(model) };
  }

  getModelPath(id: string): string {
    const model = this.deps.registry.get(id);
    return join(this.deps.modelsDir, model.engine, model.fileName);
  }

  async checkInstalled(id: string): Promise<boolean> {
    return this.isInstalledSync(this.deps.registry.get(id));
  }

  async download(id: string, _onProgress?: (progress: DownloadProgress) => void): Promise<void> {
    const model = this.deps.registry.get(id);
    // TODO(models): stream `model.downloadUrl` to `<path>.part` in the main process,
    // report progress, verify checksum, then rename atomically.
    this.deps.logger.warn(`download(${id}) requested but not implemented`);
    throw new ModelError('MODEL_DOWNLOAD_NOT_IMPLEMENTED', 'Model download is not implemented yet', {
      details: { modelName: model.name },
    });
  }

  async verifyChecksum(id: string): Promise<boolean> {
    const model = this.deps.registry.get(id);
    // TODO(models): SHA-256 the file with node:crypto and compare to model.checksum.
    throw new ModelError('NOT_IMPLEMENTED', 'Checksum verification is not implemented yet', {
      details: { modelName: model.name },
    });
  }

  async delete(id: string): Promise<void> {
    const model = this.deps.registry.get(id);
    // TODO(models): dispose the engine if this model is loaded, then remove the file.
    throw new ModelError('NOT_IMPLEMENTED', 'Model deletion is not implemented yet', {
      details: { modelName: model.name },
    });
  }

  private isInstalledSync(model: ModelInfo): boolean {
    return this.fileExists(join(this.deps.modelsDir, model.engine, model.fileName));
  }
}
