import { writeFile } from 'node:fs/promises';
import { encodeWav } from '@core/audio/wav';

/** Writes a short silent 16 kHz mono WAV. */
export async function writeSilentWav(path: string, seconds = 1): Promise<void> {
  const samples = new Float32Array(16_000 * seconds);
  await writeFile(path, encodeWav({ kind: 'pcm', samples, sampleRate: 16_000, channels: 1, durationMs: seconds * 1000 }));
}
