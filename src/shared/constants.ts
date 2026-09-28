export const APP_NAME = 'Voxcribe';
export const APP_ID = 'com.voxcribe.app';

export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space';
export const DEFAULT_LANGUAGE = 'auto';

/** whisper.cpp (and most local ASR engines) expect 16 kHz mono PCM. */
export const ASR_SAMPLE_RATE = 16_000;
export const ASR_CHANNELS = 1;

/** Directory names, resolved against app paths in the main process. */
export const MODELS_DIR_NAME = 'models';
export const BINARIES_DIR_NAME = 'binaries';

export const MAX_CLIPBOARD_TEXT_LENGTH = 1_000_000;

export const SUPPORTED_LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
];
