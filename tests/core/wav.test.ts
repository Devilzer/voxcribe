import { describe, expect, it } from 'vitest';
import { encodeWav, parseWavHeader } from '@core/audio/wav';

describe('wav helpers', () => {
  it('round-trips header info through encodeWav', () => {
    const wav = encodeWav({ kind: 'pcm', samples: new Float32Array(8000), sampleRate: 16_000, channels: 1, durationMs: 500 });
    expect(parseWavHeader(wav)).toMatchObject({ audioFormat: 1, channels: 1, sampleRate: 16_000, bitsPerSample: 16, durationMs: 500 });
  });

  it('rejects non-WAV data', () => {
    expect(() => parseWavHeader(Buffer.from('ID3 this is an mp3'))).toThrow(expect.objectContaining({ code: 'INVALID_AUDIO' }));
  });
});
