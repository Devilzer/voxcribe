import { ValidationError } from '@core/errors';
import { MAX_CLIPBOARD_TEXT_LENGTH, SUPPORTED_LANGUAGES } from '@shared/constants';
import type { AppSettings, PostProcessingProvider } from '@shared/types';

/** Validates the raw `unknown[]` args coming from the renderer. */
export type ArgsValidator<A extends unknown[]> = (args: unknown[]) => A;

export const noArgs: ArgsValidator<[]> = (args) => {
  if (args.length !== 0) throw new ValidationError(`Expected no arguments, got ${args.length}`);
  return [];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string, maxLength = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new ValidationError(`${field} must be a non-empty string (max ${maxLength})`);
  }
  return value;
}

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new ValidationError(`${field} must be a boolean`);
  return value;
}

function assertKnownKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const unknownKey = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknownKey) throw new ValidationError(`${field}.${unknownKey} is not a known setting`);
}

export function singleString(field: string, maxLength = 256): ArgsValidator<[string]> {
  return (args) => {
    if (args.length !== 1) throw new ValidationError(`Expected 1 argument, got ${args.length}`);
    return [assertString(args[0], field, maxLength)];
  };
}

export const clipboardText: ArgsValidator<[string]> = (args) => {
  if (args.length !== 1 || typeof args[0] !== 'string' || args[0].length > MAX_CLIPBOARD_TEXT_LENGTH) {
    throw new ValidationError('Clipboard text must be a string');
  }
  return [args[0]];
};

/** Loose Electron accelerator check: modifiers + one key joined by "+". */
const ACCELERATOR_PATTERN =
  /^((CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|Alt|Option|AltGr|Shift|Super|Meta)\+)+([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right|Escape)$/i;

const POST_PROCESSING_PROVIDERS: readonly PostProcessingProvider[] = ['none', 'ollama', 'lm-studio', 'llama.cpp'];

export const settingsPatch: ArgsValidator<[Partial<AppSettings>]> = (args) => {
  if (args.length !== 1 || !isRecord(args[0])) throw new ValidationError('Settings patch must be an object');
  const input = args[0];
  assertKnownKeys(input, ['selectedModelId', 'microphoneId', 'language', 'shortcut', 'postProcessing', 'storage'], 'settings');

  const patch: Partial<AppSettings> = {};
  if ('selectedModelId' in input) patch.selectedModelId = assertString(input.selectedModelId, 'selectedModelId');
  if ('microphoneId' in input) {
    patch.microphoneId = input.microphoneId === null ? null : assertString(input.microphoneId, 'microphoneId');
  }
  if ('language' in input) {
    const language = assertString(input.language, 'language', 8);
    if (!SUPPORTED_LANGUAGES.some((entry) => entry.code === language)) {
      throw new ValidationError(`Unsupported language "${language}"`);
    }
    patch.language = language;
  }
  if ('shortcut' in input) {
    const shortcut = assertString(input.shortcut, 'shortcut', 64);
    if (!ACCELERATOR_PATTERN.test(shortcut)) throw new ValidationError(`Invalid shortcut "${shortcut}"`);
    patch.shortcut = shortcut;
  }
  if ('postProcessing' in input) {
    const value = input.postProcessing;
    if (!isRecord(value)) throw new ValidationError('postProcessing must be an object');
    assertKnownKeys(value, ['enabled', 'provider'], 'postProcessing');
    const provider = value.provider;
    if (!POST_PROCESSING_PROVIDERS.includes(provider as PostProcessingProvider)) {
      throw new ValidationError('postProcessing.provider is invalid');
    }
    patch.postProcessing = {
      enabled: assertBoolean(value.enabled, 'postProcessing.enabled'),
      provider: provider as PostProcessingProvider,
    };
  }
  if ('storage' in input) {
    const value = input.storage;
    if (!isRecord(value)) throw new ValidationError('storage must be an object');
    assertKnownKeys(value, ['saveHistory'], 'storage');
    patch.storage = { saveHistory: assertBoolean(value.saveHistory, 'storage.saveHistory') };
  }
  return [patch];
};
