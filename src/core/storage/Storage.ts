import { createTranscript } from '@shared/transcript';
import { StorageError } from '../errors';
import type { ListTranscriptsOptions, Transcript } from './types';

/**
 * Transcript persistence. The in-memory version is used until SQLite lands.
 *
 * TODO(storage): `SqliteStorage` in the main process (better-sqlite3 or node:sqlite),
 * database at `<userData>/voxcribe.db`, plain SQL migrations, FTS5 for search.
 */
export interface Storage {
  saveTranscript(transcript: Transcript): Promise<void>;
  getTranscript(id: string): Promise<Transcript | null>;
  /** Newest first. */
  listTranscripts(options?: ListTranscriptsOptions): Promise<Transcript[]>;
  deleteTranscript(id: string): Promise<void>;
}

export class InMemoryStorage implements Storage {
  private readonly transcripts = new Map<string, Transcript>();

  constructor(seed: readonly Transcript[] = []) {
    for (const transcript of seed) this.transcripts.set(transcript.id, transcript);
  }

  async saveTranscript(transcript: Transcript): Promise<void> {
    this.transcripts.set(transcript.id, structuredClone(transcript));
  }

  async getTranscript(id: string): Promise<Transcript | null> {
    const transcript = this.transcripts.get(id);
    return transcript ? structuredClone(transcript) : null;
  }

  async listTranscripts(options: ListTranscriptsOptions = {}): Promise<Transcript[]> {
    const offset = options.offset ?? 0;
    const sorted = [...this.transcripts.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = options.limit === undefined ? sorted.slice(offset) : sorted.slice(offset, offset + options.limit);
    return page.map((transcript) => structuredClone(transcript));
  }

  async deleteTranscript(id: string): Promise<void> {
    if (!this.transcripts.delete(id)) {
      throw new StorageError('STORAGE_NOT_FOUND', `Transcript "${id}" not found`, { details: { id } });
    }
  }
}

/** Sample history so the History page has content before real transcription exists. */
export function createMockTranscripts(now: Date = new Date()): Transcript[] {
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const entry = (id: string, text: string, duration: number, minutes: number) =>
    createTranscript({
      id,
      language: 'en',
      duration,
      engineId: 'whisper',
      modelId: 'whisper-small',
      createdAt: minutesAgo(minutes),
      segments: [{ id: `${id}_s0`, start: 0, end: duration, text }],
    });

  return [
    entry('mock_1', 'Remind me to follow up with the design team about the onboarding flow.', 4.2, 12),
    entry('mock_2', 'The quarterly report is ready for review. Please send comments by Friday.', 5.8, 95),
    entry('mock_3', 'Add oat milk, eggs and coffee beans to the shopping list.', 3.1, 60 * 26),
  ];
}
