import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, rename, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import type { DownloadableModelDefinition, DownloadStatus, ModelDefinition } from '@shared/types';
import { ModelError, toErrorPayload, VoxcribeError } from '../errors';
import type { Logger } from '../logging/Logger';
import type { ModelDownloader } from './ModelDownloader';
import type { ModelRegistry } from './ModelRegistry';
import type { ModelVerifier } from './ModelVerifier';
import type { DownloadProgress, DownloadProgressListener, ModelInfo, ModelManager } from './types';

export interface LocalModelManagerDeps {
  registry: ModelRegistry;
  downloader: ModelDownloader;
  verifier: ModelVerifier;
  /** `<userData>/models`. Never the app's source tree. */
  modelsDir: string;
  logger: Logger;
  /** Free space required on top of the model size. */
  diskHeadroomBytes?: number;
  /** Minimum ms between two `downloading` progress events. */
  progressIntervalMs?: number;
  /** Injected for tests. */
  freeDiskBytes?: (dir: string) => Promise<number>;
}

interface ActiveDownload {
  controller: AbortController;
  promise: Promise<void>;
}

const PART_SUFFIX = '.part';

async function defaultFreeDiskBytes(dir: string): Promise<number> {
  const stats = await statfs(dir);
  return stats.bavail * stats.bsize;
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && error.name === 'AbortError');
}

/**
 * Installs models under `<modelsDir>/<engine>/<filename>`.
 *
 * download → `<filename>.part` → SHA-256 check against the registry → rename.
 * A file at the final path therefore always passed verification; `.part`
 * files are never reported as installed and are deleted on any failure.
 */
export class LocalModelManager implements ModelManager {
  private readonly active = new Map<string, ActiveDownload>();
  private readonly progress = new Map<string, DownloadProgress>();
  private readonly listeners = new Set<DownloadProgressListener>();
  private readonly freeDiskBytes: (dir: string) => Promise<number>;

  constructor(private readonly deps: LocalModelManagerDeps) {
    this.freeDiskBytes = deps.freeDiskBytes ?? defaultFreeDiskBytes;
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.deps.registry.list().map((model) => this.withInstallState(model));
  }

  async getInstalledModels(): Promise<ModelInfo[]> {
    return (await this.listModels()).filter((model) => model.installed);
  }

  getModel(modelId: string): ModelInfo {
    return this.withInstallState(this.deps.registry.get(modelId));
  }

  async isInstalled(modelId: string): Promise<boolean> {
    return this.getModel(modelId).installed;
  }

  async getModelPath(modelId: string): Promise<string | null> {
    const model = this.deps.registry.get(modelId);
    return this.isInstalledSync(model) ? this.finalPath(model) : null;
  }

  getDownloadProgress(modelId: string): DownloadProgress | null {
    this.deps.registry.get(modelId);
    return this.progress.get(modelId) ?? null;
  }

  onProgress(listener: DownloadProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  downloadModel(modelId: string, onProgress?: DownloadProgressListener): Promise<void> {
    const model = this.deps.registry.getDownloadable(modelId);
    if (this.active.has(modelId)) {
      return Promise.reject(
        new ModelError('MODEL_DOWNLOAD_IN_PROGRESS', `${modelId} is already downloading`, {
          details: { modelName: model.name },
        }),
      );
    }
    if (this.isInstalledSync(model)) return Promise.resolve();

    const controller = new AbortController();
    const unsubscribe = onProgress
      ? this.onProgress((progress) => {
          if (progress.modelId === modelId) onProgress(progress);
        })
      : () => undefined;
    const promise = this.runDownload(model, controller.signal).finally(() => {
      this.active.delete(modelId);
      unsubscribe();
    });
    this.active.set(modelId, { controller, promise });
    return promise;
  }

  async cancelDownload(modelId: string): Promise<void> {
    this.deps.registry.get(modelId);
    const download = this.active.get(modelId);
    if (!download) return;
    download.controller.abort();
    await download.promise.catch(() => undefined);
  }

  async verifyModel(modelId: string): Promise<boolean> {
    const model = this.deps.registry.getDownloadable(modelId);
    if (!this.isInstalledSync(model)) return false;
    return this.deps.verifier.verify(this.finalPath(model), model.sha256);
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = this.deps.registry.get(modelId);
    await this.cancelDownload(modelId);
    await rm(this.finalPath(model), { force: true });
    await rm(this.partPath(model), { force: true });
    this.progress.delete(modelId);
    this.deps.logger.info(`Deleted model ${modelId}`);
  }

  /** Removes `.part` files left by a crash or forced quit. Call once at startup. */
  async removeStalePartials(): Promise<void> {
    const engines = new Set(this.deps.registry.list().map((model) => model.engine));
    for (const engine of engines) {
      const dir = join(this.deps.modelsDir, engine);
      const entries = await readdir(dir).catch(() => [] as string[]);
      for (const entry of entries) {
        if (entry.endsWith(PART_SUFFIX) && !this.isDownloadingFile(engine, entry)) {
          await rm(join(dir, entry), { force: true });
          this.deps.logger.info(`Removed stale partial download ${engine}/${entry}`);
        }
      }
    }
  }

  // ---------- internals ----------

  private async runDownload(model: DownloadableModelDefinition, signal: AbortSignal): Promise<void> {
    const partPath = this.partPath(model);
    const total = model.sizeBytes;
    let lastEmit = 0;
    const interval = this.deps.progressIntervalMs ?? 250;

    this.emit(model.id, 'queued', 0, total);
    try {
      await mkdir(join(this.deps.modelsDir, model.engine), { recursive: true });
      await rm(partPath, { force: true });

      const free = await this.freeDiskBytes(this.deps.modelsDir);
      const needed = total + (this.deps.diskHeadroomBytes ?? 200 * 1024 * 1024);
      if (free < needed) {
        throw new ModelError('MODEL_INSUFFICIENT_DISK_SPACE', `Need ${needed} bytes, ${free} free`);
      }

      this.emit(model.id, 'downloading', 0, total);
      this.deps.logger.info(`Downloading ${model.id}`, { url: model.downloadUrl });
      await this.deps.downloader.download({
        url: model.downloadUrl,
        destination: partPath,
        expectedBytes: total,
        signal,
        onProgress: (downloaded) => {
          const now = Date.now();
          if (now - lastEmit >= interval || downloaded === total) {
            lastEmit = now;
            this.emit(model.id, 'downloading', downloaded, total);
          }
        },
      });
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      this.emit(model.id, 'verifying', total, total);
      const valid = await this.deps.verifier.verify(partPath, model.sha256);
      if (!valid) throw new ModelError('MODEL_CHECKSUM_MISMATCH', `SHA-256 mismatch for ${model.id}`);

      await rename(partPath, this.finalPath(model));
      this.emit(model.id, 'completed', total, total);
      this.deps.logger.info(`Installed ${model.id}`);
    } catch (error) {
      await rm(partPath, { force: true }).catch(() => undefined);
      const current = this.progress.get(model.id)?.downloadedBytes ?? 0;
      if (isAbort(error, signal)) {
        this.emit(model.id, 'cancelled', current, total);
        throw new ModelError('MODEL_DOWNLOAD_CANCELLED', `Download of ${model.id} cancelled`, {
          details: { modelName: model.name },
        });
      }
      const wrapped = this.wrapError(error).withDetails({ modelName: model.name });
      this.emit(model.id, 'failed', current, total, wrapped);
      this.deps.logger.error(`Download of ${model.id} failed`, wrapped.toPayload());
      throw wrapped;
    }
  }

  private wrapError(error: unknown): VoxcribeError {
    if (error instanceof VoxcribeError) return error;
    if (error instanceof Error && 'code' in error && error.code === 'ENOSPC') {
      return new ModelError('MODEL_INSUFFICIENT_DISK_SPACE', 'Disk full while downloading', { cause: error });
    }
    return new ModelError('MODEL_DOWNLOAD_FAILED', error instanceof Error ? error.message : String(error), {
      cause: error,
    });
  }

  private emit(modelId: string, status: DownloadStatus, downloadedBytes: number, totalBytes: number, error?: VoxcribeError): void {
    const progress: DownloadProgress = {
      modelId,
      downloadedBytes,
      totalBytes,
      percentage: totalBytes > 0 ? Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100)) : 0,
      status,
      ...(error ? { error: toErrorPayload(error) } : {}),
    };
    this.progress.set(modelId, progress);
    for (const listener of this.listeners) {
      try {
        listener(progress);
      } catch (listenerError) {
        this.deps.logger.warn('Download progress listener threw', listenerError);
      }
    }
  }

  private withInstallState(model: ModelDefinition): ModelInfo {
    return { ...model, installed: this.isInstalledSync(model) };
  }

  /** Installed = final file exists with the exact registry size (it was verified before the rename). */
  private isInstalledSync(model: ModelDefinition): boolean {
    if (model.availability !== 'available') return false;
    const path = this.finalPath(model);
    if (!existsSync(path)) return false;
    try {
      return statSync(path).size === model.sizeBytes;
    } catch {
      return false;
    }
  }

  private isDownloadingFile(engine: string, fileName: string): boolean {
    return [...this.active.keys()].some((id) => {
      const model = this.deps.registry.get(id);
      return model.engine === engine && `${model.filename}${PART_SUFFIX}` === fileName;
    });
  }

  private finalPath(model: ModelDefinition): string {
    return join(this.deps.modelsDir, model.engine, model.filename);
  }

  private partPath(model: ModelDefinition): string {
    return `${this.finalPath(model)}${PART_SUFFIX}`;
  }
}
