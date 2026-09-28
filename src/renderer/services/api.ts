import { toUserMessage, type AppErrorPayload } from '@shared/errors';
import type { IpcResult } from '@shared/ipc';
import type { UiError } from '../types';

/** Error thrown by `unwrap` when main returns `{ ok: false }`. */
export class ClientError extends Error {
  constructor(readonly payload: AppErrorPayload) {
    super(payload.message);
    this.name = 'ClientError';
  }
}

export const api = window.voxcribe;

export async function unwrap<T>(result: Promise<IpcResult<T>>): Promise<T> {
  const value = await result;
  if (!value.ok) throw new ClientError(value.error);
  return value.data;
}

/** UI boundary: any error becomes a friendly message. */
export function toUiError(error: unknown): UiError {
  if (error instanceof ClientError) {
    return { code: error.payload.code, message: toUserMessage(error.payload) };
  }
  return { code: 'UNKNOWN', message: toUserMessage({ code: 'UNKNOWN', message: String(error) }) };
}
