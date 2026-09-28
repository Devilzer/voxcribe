import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WhisperCliOutputParser } from '@core/asr/engines/whisper/WhisperCliOutputParser';

const fixture = readFileSync(join(__dirname, '../fixtures/whisper-output.json'), 'utf8');

describe('WhisperCliOutputParser.parseJson', () => {
  it('parses a normal transcript with language', () => {
    const transcript = WhisperCliOutputParser.parseJson(fixture);
    expect(transcript.text).toBe('Hello, this is a test of Voxcribe. Everything runs locally.');
    expect(transcript.language).toBe('en');
  });

  it('keeps multiple segments with timestamps in seconds and drops [BLANK_AUDIO]', () => {
    const { segments, duration } = WhisperCliOutputParser.parseJson(fixture);
    expect(segments.map(({ start, end, text }) => ({ start, end, text }))).toEqual([
      { start: 0, end: 4.2, text: 'Hello, this is a test of Voxcribe.' },
      { start: 6, end: 9.75, text: 'Everything runs locally.' },
    ]);
    expect(duration).toBe(9.75);
  });

  it('derives confidence from token probabilities, ignoring special tokens', () => {
    const [first, second] = WhisperCliOutputParser.parseJson(fixture).segments;
    expect(first?.confidence).toBeCloseTo(0.85);
    expect(second?.confidence).toBeUndefined();
  });

  it('prefers the known audio duration', () => {
    expect(WhisperCliOutputParser.parseJson(fixture, { duration: 11 }).duration).toBe(11);
  });

  it('returns an empty transcript for silence', () => {
    const silent = JSON.stringify({ transcription: [{ offsets: { from: 0, to: 1000 }, text: ' [BLANK_AUDIO]' }] });
    expect(WhisperCliOutputParser.parseJson(silent)).toMatchObject({ text: '', segments: [] });
  });

  it.each([
    ['not json', 'invalid JSON'],
    ['{"foo": 1}', 'transcription'],
    ['{"transcription": [42]}', 'segment 0'],
    ['{"transcription": [{"text": "hi"}]}', 'segment 0'],
  ])('rejects malformed output %s', (raw, reason) => {
    expect(() => WhisperCliOutputParser.parseJson(raw)).toThrow(expect.objectContaining({ code: 'WHISPER_TRANSCRIPTION_FAILED' }));
    expect(() => WhisperCliOutputParser.parseJson(raw)).toThrow(new RegExp(reason));
  });
});

describe('WhisperCliOutputParser.parseText', () => {
  it('parses timestamped stdout lines', () => {
    const stdout = [
      '',
      '[00:00:00.000 --> 00:00:10.500]   And so my fellow Americans, ask not what your country can do for you,',
      '[00:00:10.500 --> 00:00:11.000]   [BLANK_AUDIO]',
      '[00:01:02.250 --> 00:01:05.000]   ask what you can do for your country.',
    ].join('\n');
    const transcript = WhisperCliOutputParser.parseText(stdout);
    expect(transcript.segments.map(({ start, end }) => [start, end])).toEqual([
      [0, 10.5],
      [62.25, 65],
    ]);
    expect(transcript.text).toBe('And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country.');
  });

  it('rejects text without timestamps', () => {
    expect(() => WhisperCliOutputParser.parseText('error: failed to load model')).toThrow(
      expect.objectContaining({ code: 'WHISPER_TRANSCRIPTION_FAILED' }),
    );
  });
});
