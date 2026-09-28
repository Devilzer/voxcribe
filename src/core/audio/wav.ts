import { open } from 'node:fs/promises';
import { AudioError } from '../errors';
import type { PcmAudioInput } from '../asr/types';

export interface WavInfo {
  /** 1 = PCM, 3 = IEEE float, 0xFFFE = extensible. */
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  durationMs: number;
}

const HEADER_READ_BYTES = 64 * 1024;
const SUPPORTED_FORMATS = new Set([1, 3, 0xfffe]);

/** Parses a RIFF/WAVE header. Throws INVALID_AUDIO for anything else. */
export function parseWavHeader(buffer: Buffer, fileSize = buffer.length): WavInfo {
  const invalid = (reason: string) => new AudioError('INVALID_AUDIO', `Not a supported WAV file: ${reason}`);
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw invalid('missing RIFF/WAVE header');
  }

  let offset = 12;
  let fmt: Omit<WavInfo, 'dataBytes' | 'durationMs'> | null = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (body + 16 > buffer.length) throw invalid('truncated fmt chunk');
      fmt = {
        audioFormat: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!fmt) throw invalid('data chunk before fmt chunk');
      if (!SUPPORTED_FORMATS.has(fmt.audioFormat)) throw invalid(`unsupported encoding ${fmt.audioFormat}`);
      if (fmt.channels < 1 || fmt.sampleRate < 1 || fmt.bitsPerSample < 8) throw invalid('bad fmt values');
      // Streamed WAVs may carry a 0 or 0xFFFFFFFF size; fall back to the file size.
      const available = Math.max(0, fileSize - body);
      const dataBytes = size === 0 || size === 0xffffffff || size > available ? available : size;
      const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
      return { ...fmt, dataBytes, durationMs: Math.round((dataBytes / bytesPerSecond) * 1000) };
    }
    offset = body + size + (size % 2);
  }
  throw invalid('no data chunk');
}

export async function readWavInfo(path: string): Promise<WavInfo> {
  let handle;
  try {
    handle = await open(path, 'r');
  } catch (error) {
    throw new AudioError('AUDIO_FILE_NOT_FOUND', 'Audio file could not be opened', { cause: error });
  }
  try {
    const { size } = await handle.stat();
    const buffer = Buffer.alloc(Math.min(size, HEADER_READ_BYTES));
    await handle.read(buffer, 0, buffer.length, 0);
    return parseWavHeader(buffer, size);
  } finally {
    await handle.close();
  }
}

/** Encodes mono/stereo float PCM as a 16-bit PCM WAV file. */
export function encodeWav(audio: PcmAudioInput): Buffer {
  const bytesPerSample = 2;
  const dataBytes = audio.samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(audio.channels, 22);
  buffer.writeUInt32LE(audio.sampleRate, 24);
  buffer.writeUInt32LE(audio.sampleRate * audio.channels * bytesPerSample, 28);
  buffer.writeUInt16LE(audio.channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < audio.samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, audio.samples[i] ?? 0));
    buffer.writeInt16LE(Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), 44 + i * bytesPerSample);
  }
  return buffer;
}
