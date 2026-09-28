import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_LANGUAGE, DEFAULT_SHORTCUT } from '@shared/constants';
import type { AppSettings } from '@shared/types';

export const DEFAULT_SETTINGS: AppSettings = {
  activeModelId: null,
  microphoneId: null,
  language: DEFAULT_LANGUAGE,
  shortcut: DEFAULT_SHORTCUT,
  postProcessing: { enabled: false, provider: 'none' },
  storage: { saveHistory: true },
};

export type SettingsListener = (next: AppSettings, previous: AppSettings) => void | Promise<void>;

/** Turns untrusted JSON into a valid partial settings object (drops what it can't accept). */
export type SettingsSanitizer = (raw: unknown) => Partial<AppSettings>;

export interface SettingsStoreOptions {
  /** JSON file to persist to (e.g. `<userData>/settings.json`). In-memory when omitted. */
  filePath?: string;
  onPersistError?: (error: unknown) => void;
}

/**
 * App settings with change listeners and optional JSON-file persistence.
 * TODO(storage): move into SQLite with the transcript history.
 */
export class SettingsStore {
  private settings: AppSettings;
  private readonly listeners = new Set<SettingsListener>();
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    initial: AppSettings = DEFAULT_SETTINGS,
    private readonly options: SettingsStoreOptions = {},
  ) {
    this.settings = structuredClone(initial);
  }

  /** Loads settings from `filePath`, falling back to defaults for missing/invalid values. */
  static async load(filePath: string, sanitize: SettingsSanitizer, options: Omit<SettingsStoreOptions, 'filePath'> = {}): Promise<SettingsStore> {
    let patch: Partial<AppSettings> = {};
    try {
      patch = sanitize(JSON.parse(await readFile(filePath, 'utf8')));
    } catch {
      // Missing or corrupt file: start from defaults.
    }
    return new SettingsStore(merge(DEFAULT_SETTINGS, patch), { ...options, filePath });
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const previous = this.settings;
    const next = merge(previous, patch);
    this.settings = next;
    try {
      for (const listener of this.listeners) await listener(structuredClone(next), structuredClone(previous));
    } catch (error) {
      this.settings = previous;
      throw error;
    }
    this.persist();
    return this.get();
  }

  /** Listener errors roll the update back. */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Resolves once pending writes are on disk. */
  flush(): Promise<void> {
    return this.writeChain;
  }

  private persist(): void {
    const { filePath } = this.options;
    if (!filePath) return;
    const snapshot = JSON.stringify(this.settings, null, 2);
    this.writeChain = this.writeChain
      .then(async () => {
        await mkdir(dirname(filePath), { recursive: true });
        const tmp = `${filePath}.tmp`;
        await writeFile(tmp, snapshot, 'utf8');
        await rename(tmp, filePath);
      })
      .catch((error: unknown) => this.options.onPersistError?.(error));
  }
}

function merge(base: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    ...base,
    ...patch,
    postProcessing: { ...base.postProcessing, ...patch.postProcessing },
    storage: { ...base.storage, ...patch.storage },
  };
}
