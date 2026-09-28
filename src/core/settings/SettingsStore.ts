import { DEFAULT_LANGUAGE, DEFAULT_MODEL_ID, DEFAULT_SHORTCUT } from '@shared/constants';
import type { AppSettings } from '@shared/types';

export const DEFAULT_SETTINGS: AppSettings = {
  selectedModelId: DEFAULT_MODEL_ID,
  microphoneId: null,
  language: DEFAULT_LANGUAGE,
  shortcut: DEFAULT_SHORTCUT,
  postProcessing: { enabled: false, provider: 'none' },
  storage: { saveHistory: true },
};

export type SettingsListener = (next: AppSettings, previous: AppSettings) => void | Promise<void>;

/**
 * TODO(storage): persist to `<userData>/settings.json` (or the SQLite db).
 */
export class SettingsStore {
  private settings: AppSettings;
  private readonly listeners = new Set<SettingsListener>();

  constructor(initial: AppSettings = DEFAULT_SETTINGS) {
    this.settings = structuredClone(initial);
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const previous = this.settings;
    const next: AppSettings = {
      ...previous,
      ...patch,
      postProcessing: { ...previous.postProcessing, ...patch.postProcessing },
      storage: { ...previous.storage, ...patch.storage },
    };
    this.settings = next;
    try {
      for (const listener of this.listeners) await listener(structuredClone(next), structuredClone(previous));
    } catch (error) {
      this.settings = previous;
      throw error;
    }
    return this.get();
  }

  /** Listener errors roll the update back. */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
