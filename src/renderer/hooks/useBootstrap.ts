import { useEffect } from 'react';
import { api, toUiError } from '../services/api';
import { toggleDictation } from '../services/dictation';
import { refreshModels } from '../services/models';
import { loadInitialData } from '../services/settings';
import { useAppStore } from '../store/appStore';

/** Loads initial data and subscribes to main-process events. */
export function useBootstrap(): void {
  useEffect(() => {
    loadInitialData().catch((error: unknown) => useAppStore.getState().fail(toUiError(error)));

    const offToggle = api.events.onDictationToggle(() => void toggleDictation());
    const offNavigate = api.events.onNavigate(({ page }) => useAppStore.getState().setPage(page));
    const offProgress = api.events.onModelDownloadProgress((progress) => {
      useAppStore.getState().setDownloadProgress(progress);
      if (progress.status === 'completed' || progress.status === 'cancelled') void refreshModels().catch(() => undefined);
    });
    return () => {
      offToggle();
      offNavigate();
      offProgress();
    };
  }, []);
}
