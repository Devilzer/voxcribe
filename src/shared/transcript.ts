import type { Transcript, TranscriptSegment } from './types';

let idCounter = 0;

/** Short unique id; not cryptographically secure. */
export function createId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function joinSegments(segments: readonly TranscriptSegment[]): string {
  return segments
    .map((segment) => segment.text.trim())
    .filter((text) => text.length > 0)
    .join(' ');
}

export interface CreateTranscriptInput {
  segments: TranscriptSegment[];
  language?: string;
  duration?: number;
  engineId?: string;
  modelId?: string;
  id?: string;
  createdAt?: Date;
}

export function createTranscript(input: CreateTranscriptInput): Transcript {
  const lastSegment = input.segments.at(-1);
  return {
    id: input.id ?? createId('tr'),
    text: joinSegments(input.segments),
    language: input.language,
    duration: input.duration ?? lastSegment?.end,
    segments: input.segments,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    engineId: input.engineId,
    modelId: input.modelId,
  };
}

export function wordCount(transcript: Pick<Transcript, 'text'>): number {
  const trimmed = transcript.text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Formats milliseconds as `m:ss`. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
