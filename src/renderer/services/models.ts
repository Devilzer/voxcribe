import { useAppStore } from '../store/appStore';
import type { UiError } from '../types';
import { api, ClientError, toUiError, unwrap } from './api';

export async function refreshModels(): Promise<void> {
  useAppStore.getState().setModels(await unwrap(api.models.list()));
}

async function refreshSettings(): Promise<void> {
  useAppStore.getState().setSettings(await unwrap(api.settings.get()));
}

/**
 * Starts a download and resolves when it finishes. Progress (including the
 * failure reason) arrives separately through the download-progress event.
 * Returns an error only for problems the progress event doesn't cover.
 */
export async function downloadModel(modelId: string): Promise<UiError | null> {
  try {
    await unwrap(api.models.download(modelId));
    await Promise.all([refreshModels(), refreshSettings()]);
    return null;
  } catch (error) {
    await refreshModels().catch(() => undefined);
    if (error instanceof ClientError && ['MODEL_DOWNLOAD_CANCELLED', 'MODEL_DOWNLOAD_FAILED', 'MODEL_CHECKSUM_MISMATCH', 'MODEL_INSUFFICIENT_DISK_SPACE'].includes(error.payload.code)) {
      return null;
    }
    return toUiError(error);
  }
}

export async function cancelDownload(modelId: string): Promise<void> {
  await unwrap(api.models.cancelDownload(modelId));
}

export async function deleteModel(modelId: string): Promise<UiError | null> {
  try {
    await unwrap(api.models.delete(modelId));
    await Promise.all([refreshModels(), refreshSettings()]);
    return null;
  } catch (error) {
    return toUiError(error);
  }
}

export async function setActiveModel(modelId: string): Promise<UiError | null> {
  try {
    useAppStore.getState().setSettings(await unwrap(api.models.setActive(modelId)));
    return null;
  } catch (error) {
    return toUiError(error);
  }
}
