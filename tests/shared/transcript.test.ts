import { describe, expect, it } from 'vitest';
import { toUserMessage } from '@shared/errors';
import { getModelDownloadState, type DownloadProgress, type ModelInfo } from '@shared/types';
import { canTransition } from '@shared/stateMachine';
import { createTranscript, formatBytes, formatDuration, joinSegments, wordCount } from '@shared/transcript';

describe('transcript helpers', () => {
  const segments = [
    { id: 's1', start: 0, end: 1.2, text: ' Hello ' },
    { id: 's2', start: 1.2, end: 2, text: '' },
    { id: 's3', start: 2, end: 3.4, text: 'world.' },
  ];

  it('joins non-empty segments', () => {
    expect(joinSegments(segments)).toBe('Hello world.');
  });

  it('creates a transcript with derived text and duration', () => {
    const transcript = createTranscript({ segments, createdAt: new Date('2026-01-01T00:00:00Z') });
    expect(transcript.text).toBe('Hello world.');
    expect(transcript.duration).toBe(3.4);
    expect(transcript.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(transcript.id).toMatch(/^tr_/);
    expect(wordCount(transcript)).toBe(2);
  });

  it('formats durations and sizes', () => {
    expect(formatDuration(65_400)).toBe('1:05');
    expect(formatBytes(466_000_000)).toBe('466 MB');
    expect(formatBytes(1_600_000_000)).toBe('1.6 GB');
  });
});

describe('errors and state machine', () => {
  it('turns internal codes into friendly messages', () => {
    expect(toUserMessage({ code: 'MODEL_NOT_INSTALLED', message: 'x', details: { modelName: 'Whisper Small' } })).toBe(
      "Whisper Small isn't installed. Download it from Settings.",
    );
    expect(toUserMessage({ code: 'MODEL_CHECKSUM_MISMATCH', message: '/secret/path' })).not.toContain('/');
  });

  it('shows the model-management wording for each model state', () => {
    const base = { installed: false, availability: 'available' } as ModelInfo;
    expect(getModelDownloadState(base, undefined)).toBe('not-installed');
    expect(getModelDownloadState(base, { status: 'downloading' } as DownloadProgress)).toBe('downloading');
    expect(getModelDownloadState(base, { status: 'verifying' } as DownloadProgress)).toBe('verifying');
    expect(getModelDownloadState(base, { status: 'failed' } as DownloadProgress)).toBe('error');
    expect(getModelDownloadState({ ...base, installed: true }, { status: 'completed' } as DownloadProgress)).toBe('installed');
    expect(getModelDownloadState({ ...base, availability: 'planned' } as ModelInfo, undefined)).toBe('unavailable');
  });

  it('allows retrying from error but not skipping steps', () => {
    expect(canTransition('error', 'recording')).toBe(true);
    expect(canTransition('idle', 'transcribing')).toBe(false);
  });
});
