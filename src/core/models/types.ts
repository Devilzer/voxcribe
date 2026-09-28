import type { ModelInfo } from '@shared/types';

export type { ModelInfo };

export interface DownloadProgress {
  modelId: string;
  receivedBytes: number;
  totalBytes?: number;
}

export interface ModelManager {
  /** All registry models with `installed` resolved against disk. */
  list(): Promise<ModelInfo[]>;
  listInstalled(): Promise<ModelInfo[]>;
  /** Registry metadata. Throws MODEL_NOT_FOUND. */
  getModel(id: string): ModelInfo;
  /** `<userData>/models/<engine>/<fileName>`, whether or not the file exists. */
  getModelPath(id: string): string;
  checkInstalled(id: string): Promise<boolean>;
  download(id: string, onProgress?: (progress: DownloadProgress) => void): Promise<void>;
  verifyChecksum(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}
