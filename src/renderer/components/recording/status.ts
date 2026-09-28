import type { AppState } from '@shared/types';

export const STATE_LABELS: Record<AppState, string> = {
  idle: 'Ready',
  recording: 'Listening…',
  processing: 'Processing…',
  transcribing: 'Transcribing…',
  cleaning: 'Cleaning up…',
  inserting: 'Inserting text…',
  error: 'Error',
};
