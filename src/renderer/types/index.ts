import type { VoxcribeAPI } from '../../preload/types';
import type { ErrorCode } from '@shared/errors';

declare global {
  interface Window {
    voxcribe: VoxcribeAPI;
  }
}

/** Error as the UI shows it: code for logic, message for people. */
export interface UiError {
  code: ErrorCode;
  message: string;
}

export type { VoxcribeAPI };
