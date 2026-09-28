import type { AppErrorPayload, ErrorCode, ErrorDetails } from '@shared/errors';
import { isErrorCode } from '@shared/errors';

export type ErrorSubsystem = 'asr' | 'model' | 'audio' | 'storage' | 'native-runtime' | 'shortcut' | 'ipc' | 'app';

export class VoxcribeError extends Error {
  readonly code: ErrorCode;
  readonly subsystem: ErrorSubsystem;
  details: ErrorDetails | undefined;

  constructor(
    subsystem: ErrorSubsystem,
    code: ErrorCode,
    message: string,
    options?: { details?: ErrorDetails; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = new.target.name;
    this.code = code;
    this.subsystem = subsystem;
    this.details = options?.details;
  }

  /** Adds context (e.g. a model name) while the error bubbles up. */
  withDetails(details: ErrorDetails): this {
    this.details = { ...details, ...this.details };
    return this;
  }

  toPayload(): AppErrorPayload {
    return { code: this.code, message: this.message, details: this.details };
  }
}

type ErrorOptions = { details?: ErrorDetails; cause?: unknown };

export class ASRError extends VoxcribeError {
  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super('asr', code, message, options);
  }
}

export class ModelError extends VoxcribeError {
  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super('model', code, message, options);
  }
}

export class AudioError extends VoxcribeError {
  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super('audio', code, message, options);
  }
}

export class StorageError extends VoxcribeError {
  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super('storage', code, message, options);
  }
}

export class NativeRuntimeError extends VoxcribeError {
  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super('native-runtime', code, message, options);
  }
}

export class ValidationError extends VoxcribeError {
  constructor(message: string, options?: ErrorOptions) {
    super('ipc', 'IPC_INVALID_ARGUMENT', message, options);
  }
}

export function toErrorPayload(error: unknown): AppErrorPayload {
  if (error instanceof VoxcribeError) return error.toPayload();
  if (error instanceof Error) {
    const code = 'code' in error && isErrorCode(error.code) ? error.code : 'UNKNOWN';
    return { code, message: error.message };
  }
  return { code: 'UNKNOWN', message: String(error) };
}
