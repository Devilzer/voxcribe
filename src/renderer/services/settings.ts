import type { AppSettings } from '@shared/types';
import { useAppStore } from '../store/appStore';
import { api, toUiError, unwrap } from './api';
import type { UiError } from '../types';

/** Loads everything the UI needs from main. */
export async function loadInitialData(): Promise<void> {
  const store = useAppStore.getState();
  const [settings, models, devices, history] = await Promise.all([
    unwrap(api.settings.get()),
    unwrap(api.models.list()),
    unwrap(api.recording.getDevices()),
    unwrap(api.history.list()),
  ]);
  store.setModels(models);
  store.setSettings(settings);
  store.setDevices(devices);
  store.setHistory(history);
}

/** Returns an error for inline display instead of moving the dictation state machine. */
export async function updateSettings(patch: Partial<AppSettings>): Promise<UiError | null> {
  try {
    useAppStore.getState().setSettings(await unwrap(api.settings.set(patch)));
    return null;
  } catch (error) {
    return toUiError(error);
  }
}
