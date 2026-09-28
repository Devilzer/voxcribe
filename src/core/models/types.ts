import type { DownloadProgress, ModelInfo } from '@shared/types';

export type { DownloadProgress, ModelInfo };

export type DownloadProgressListener = (progress: DownloadProgress) => void;

export interface ModelManager {
  /** All registry models with `installed` resolved against disk. */
  listModels(): Promise<ModelInfo[]>;
  getInstalledModels(): Promise<ModelInfo[]>;
  /** Registry metadata + install state. Throws MODEL_NOT_FOUND. */
  getModel(modelId: string): ModelInfo;
  isInstalled(modelId: string): Promise<boolean>;
  /** Absolute path of the installed model file, or `null` when not installed. */
  getModelPath(modelId: string): Promise<string | null>;
  downloadModel(modelId: string, onProgress?: DownloadProgressListener): Promise<void>;
  cancelDownload(modelId: string): Promise<void>;
  /** Re-hashes the installed file against the pinned SHA-256. */
  verifyModel(modelId: string): Promise<boolean>;
  deleteModel(modelId: string): Promise<void>;
  /** Latest progress of an active or recently finished download. */
  getDownloadProgress(modelId: string): DownloadProgress | null;
  /** Subscribe to progress events of every download. */
  onProgress(listener: DownloadProgressListener): () => void;
}
