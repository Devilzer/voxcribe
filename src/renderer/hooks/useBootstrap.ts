import { useEffect } from 'react';
import { api, toUiError } from '../services/api';
import { toggleDictation } from '../services/dictation';
import { loadInitialData } from '../services/settings';
import { useAppStore } from '../store/appStore';

/** Loads initial data and subscribes to main-process events. */
export function useBootstrap(): void {
  useEffect(() => {
    loadInitialData().catch((error: unknown) => useAppStore.getState().fail(toUiError(error)));

    const offToggle = api.events.onDictationToggle(() => void toggleDictation());
    const offNavigate = api.events.onNavigate(({ page }) => useAppStore.getState().setPage(page));
    return () => {
      offToggle();
      offNavigate();
    };
  }, []);
}
