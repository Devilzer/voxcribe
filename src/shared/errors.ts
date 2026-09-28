/**
 * Error codes and user-facing messages. Internal errors (see `src/core/errors.ts`)
 * are serialized to `AppErrorPayload` at the IPC boundary and turned into
 * friendly text in the renderer with `toUserMessage`.
 */

export const ERROR_CODES = [
  // ASR
  'ASR_ENGINE_NOT_FOUND',
  'ASR_ENGINE_NOT_INITIALIZED',
  'ASR_NO_MODEL_SELECTED',
  'ASR_TRANSCRIPTION_FAILED',
  // whisper.cpp
  'WHISPER_BINARY_NOT_FOUND',
  'WHISPER_PROCESS_FAILED',
  'WHISPER_TRANSCRIPTION_FAILED',
  // Models
  'MODEL_NOT_FOUND',
  'MODEL_NOT_INSTALLED',
  'MODEL_NOT_AVAILABLE',
  'MODEL_ENGINE_MISMATCH',
  'MODEL_INVALID',
  'MODEL_DOWNLOAD_FAILED',
  'MODEL_DOWNLOAD_CANCELLED',
  'MODEL_DOWNLOAD_IN_PROGRESS',
  'MODEL_INSUFFICIENT_DISK_SPACE',
  'MODEL_CHECKSUM_MISMATCH',
  // Audio
  'INVALID_AUDIO',
  'AUDIO_FILE_NOT_FOUND',
  'AUDIO_ALREADY_RECORDING',
  'AUDIO_NOT_RECORDING',
  'AUDIO_NO_RECORDING',
  'AUDIO_NO_SPEECH',
  'AUDIO_DEVICE_NOT_FOUND',
  // Storage
  'STORAGE_NOT_FOUND',
  'STORAGE_FAILED',
  // Native runtimes
  'NATIVE_RUNTIME_NOT_FOUND',
  'NATIVE_RUNTIME_FAILED',
  // Shortcuts
  'SHORTCUT_REGISTRATION_FAILED',
  // Generic
  'IPC_INVALID_ARGUMENT',
  'NOT_IMPLEMENTED',
  'UNKNOWN',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ErrorDetails = Record<string, string | number | boolean>;

/** Serializable error shape that crosses IPC. */
export interface AppErrorPayload {
  code: ErrorCode;
  /** Developer-facing message. Not shown to users directly. */
  message: string;
  details?: ErrorDetails;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

function detail(details: ErrorDetails | undefined, key: string, fallback: string): string {
  const value = details?.[key];
  return value === undefined ? fallback : String(value);
}

/** Human-readable text for the UI. Never includes file system paths. */
export function toUserMessage(error: AppErrorPayload): string {
  const { details } = error;
  const modelName = detail(details, 'modelName', 'The selected model');

  switch (error.code) {
    case 'MODEL_NOT_INSTALLED':
      return `${modelName} isn't installed. Download it from Settings.`;
    case 'MODEL_NOT_AVAILABLE':
      return `${modelName} isn't supported in this version of Voxcribe yet.`;
    case 'MODEL_NOT_FOUND':
      return 'That model is not in the model registry.';
    case 'MODEL_ENGINE_MISMATCH':
      return `${modelName} can't be loaded by the current transcription engine.`;
    case 'MODEL_INVALID':
      return `${modelName} is damaged or incomplete. Delete it and download it again.`;
    case 'MODEL_DOWNLOAD_FAILED':
      return `Downloading ${modelName} failed. Check your internet connection and try again.`;
    case 'MODEL_DOWNLOAD_CANCELLED':
      return 'Download cancelled.';
    case 'MODEL_DOWNLOAD_IN_PROGRESS':
      return `${modelName} is already downloading.`;
    case 'MODEL_INSUFFICIENT_DISK_SPACE':
      return `Not enough free disk space to download ${modelName}.`;
    case 'MODEL_CHECKSUM_MISMATCH':
      return 'The downloaded model failed verification and was removed. Please try downloading it again.';
    case 'ASR_NO_MODEL_SELECTED':
      return 'No transcription model installed. Download a model in Settings to start using Voxcribe.';
    case 'ASR_ENGINE_NOT_FOUND':
    case 'ASR_ENGINE_NOT_INITIALIZED':
      return 'The transcription engine is not ready. Try again in a moment.';
    case 'ASR_TRANSCRIPTION_FAILED':
    case 'WHISPER_TRANSCRIPTION_FAILED':
      return 'Transcription failed. Please try again.';
    case 'WHISPER_BINARY_NOT_FOUND':
      return 'The whisper.cpp engine is missing from this installation. See the README to install it.';
    case 'WHISPER_PROCESS_FAILED':
      return 'The whisper.cpp engine stopped unexpectedly. Please try again.';
    case 'NATIVE_RUNTIME_NOT_FOUND':
      return `The ${detail(details, 'runtimeName', 'speech')} runtime is missing. Reinstall Voxcribe.`;
    case 'NATIVE_RUNTIME_FAILED':
      return `The ${detail(details, 'runtimeName', 'speech')} runtime stopped unexpectedly.`;
    case 'INVALID_AUDIO':
      return "That audio file can't be read. Use a WAV file.";
    case 'AUDIO_FILE_NOT_FOUND':
      return 'The selected audio file no longer exists. Choose it again.';
    case 'AUDIO_ALREADY_RECORDING':
      return 'Already recording.';
    case 'AUDIO_NOT_RECORDING':
    case 'AUDIO_NO_RECORDING':
      return 'Nothing was recorded. Hold the shortcut and speak.';
    case 'AUDIO_NO_SPEECH':
      return 'No speech was detected.';
    case 'AUDIO_DEVICE_NOT_FOUND':
      return "The selected microphone isn't connected. Choose another one in Settings.";
    case 'STORAGE_NOT_FOUND':
      return 'That transcript no longer exists.';
    case 'STORAGE_FAILED':
      return 'Could not save your transcript history.';
    case 'SHORTCUT_REGISTRATION_FAILED':
      return `Couldn't register ${detail(details, 'shortcut', 'that shortcut')}. It may be used by another app.`;
    case 'IPC_INVALID_ARGUMENT':
      return 'The request was invalid.';
    case 'NOT_IMPLEMENTED':
      return 'This feature is not available yet.';
    case 'UNKNOWN':
      return 'Something went wrong.';
  }
}
