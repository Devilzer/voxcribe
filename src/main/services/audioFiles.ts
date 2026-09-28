import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { dialog, type BrowserWindow } from 'electron';
import { readWavInfo } from '@core/audio/wav';
import { AudioError } from '@core/errors';
import type { SelectedAudioFile } from '@shared/types';

const MAX_REMEMBERED_FILES = 20;

/**
 * Lets the user pick an audio file with the native dialog. The renderer only
 * receives an opaque id; the real path never leaves the main process and the
 * renderer can't point transcription at arbitrary files.
 */
export class AudioFileSelector {
  private readonly files = new Map<string, string>();

  constructor(private readonly defaultDir: string) {}

  async select(window: BrowserWindow | null): Promise<SelectedAudioFile | null> {
    const options: Electron.OpenDialogOptions = {
      title: 'Choose a WAV file to transcribe',
      defaultPath: this.defaultDir,
      properties: ['openFile'],
      filters: [{ name: 'WAV audio', extensions: ['wav'] }],
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;

    const [info, stats] = await Promise.all([readWavInfo(path), stat(path)]);
    const id = randomUUID();
    this.files.set(id, path);
    while (this.files.size > MAX_REMEMBERED_FILES) {
      const oldest = this.files.keys().next().value;
      if (oldest === undefined) break;
      this.files.delete(oldest);
    }
    return { id, name: basename(path), sizeBytes: stats.size, durationSec: info.durationMs / 1000 };
  }

  resolve(id: string): string {
    const path = this.files.get(id);
    if (!path) throw new AudioError('AUDIO_FILE_NOT_FOUND', 'Unknown audio file id');
    return path;
  }
}
