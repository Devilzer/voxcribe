import type { AppState } from './types';

/**
 * Allowed transitions of the dictation state machine.
 *
 * idle → recording → processing (VAD) → transcribing → [cleaning] → [inserting] → idle
 * idle → processing is the file-transcription entry (no recording step).
 * Any active state can fail into `error`; `error` can be dismissed or retried.
 */
export const APP_STATE_TRANSITIONS: Readonly<Record<AppState, readonly AppState[]>> = {
  idle: ['recording', 'processing', 'error'],
  recording: ['processing', 'idle', 'error'],
  processing: ['transcribing', 'idle', 'error'],
  transcribing: ['cleaning', 'inserting', 'idle', 'error'],
  cleaning: ['inserting', 'idle', 'error'],
  inserting: ['idle', 'error'],
  error: ['idle', 'recording', 'processing'],
};

export function canTransition(from: AppState, to: AppState): boolean {
  return APP_STATE_TRANSITIONS[from].includes(to);
}

/** States in which the pipeline is working and a new recording must not start. */
export function isBusy(state: AppState): boolean {
  return state === 'processing' || state === 'transcribing' || state === 'cleaning' || state === 'inserting';
}
