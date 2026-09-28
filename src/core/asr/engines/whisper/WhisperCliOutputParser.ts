import { createId, createTranscript } from '@shared/transcript';
import type { TranscriptSegment } from '@shared/types';
import { ASRError } from '../../../errors';
import type { Transcript } from '../../types';

/** Markers whisper emits for non-speech; they are not transcript text. */
const NON_SPEECH = /^\s*[[(](BLANK_AUDIO|MUSIC|NO SPEECH|SILENCE|INAUDIBLE)[\])]\s*$/i;
/** Special tokens like [_BEG_], [_TT_150], <|endoftext|>. */
const SPECIAL_TOKEN = /^\s*(\[_[A-Z_0-9]+\]|<\|.*\|>)\s*$/;

interface WhisperJsonToken {
  text?: unknown;
  p?: unknown;
}

interface WhisperJsonSegment {
  offsets?: { from?: unknown; to?: unknown };
  text?: unknown;
  tokens?: unknown;
}

interface WhisperJson {
  result?: { language?: unknown };
  transcription?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function malformed(reason: string): ASRError {
  return new ASRError('WHISPER_TRANSCRIPTION_FAILED', `Malformed whisper-cli output: ${reason}`);
}

function averageTokenProbability(tokens: unknown): number | undefined {
  if (!Array.isArray(tokens)) return undefined;
  const probabilities = (tokens as WhisperJsonToken[])
    .filter((token) => typeof token.text === 'string' && !SPECIAL_TOKEN.test(token.text))
    .map((token) => token.p)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  if (probabilities.length === 0) return undefined;
  return probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length;
}

export interface ParseOptions {
  /** Audio duration in seconds, when known from the input. */
  duration?: number;
}

/**
 * Converts whisper-cli output into a `Transcript`.
 * Primary format: the `-oj -ojf` JSON file. Fallback: the timestamped text on stdout.
 */
export const WhisperCliOutputParser = {
  parseJson(raw: string, options: ParseOptions = {}): Transcript {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw malformed('invalid JSON');
    }
    if (!isRecord(json) || !Array.isArray((json as WhisperJson).transcription)) {
      throw malformed('missing "transcription" array');
    }
    const data = json as WhisperJson;

    const segments: TranscriptSegment[] = [];
    for (const [index, item] of (data.transcription as unknown[]).entries()) {
      if (!isRecord(item)) throw malformed(`segment ${index} is not an object`);
      const segment = item as WhisperJsonSegment;
      const from = segment.offsets?.from;
      const to = segment.offsets?.to;
      if (typeof segment.text !== 'string' || typeof from !== 'number' || typeof to !== 'number') {
        throw malformed(`segment ${index} lacks text/offsets`);
      }
      if (NON_SPEECH.test(segment.text)) continue;
      const text = segment.text.trim();
      if (text.length === 0) continue;
      segments.push({
        id: createId('seg'),
        start: from / 1000,
        end: to / 1000,
        text,
        confidence: averageTokenProbability(segment.tokens),
      });
    }

    const language = typeof data.result?.language === 'string' ? data.result.language : undefined;
    return createTranscript({ segments, language, duration: options.duration ?? segments.at(-1)?.end });
  },

  /** Parses lines like `[00:00:00.000 --> 00:00:10.500]   And so my fellow Americans…`. */
  parseText(raw: string, options: ParseOptions = {}): Transcript {
    const line = /^\[(\d+):(\d{2}):(\d{2})[.,](\d{3}) --> (\d+):(\d{2}):(\d{2})[.,](\d{3})\]\s?(.*)$/;
    const toSeconds = (h: string, m: string, s: string, ms: string) =>
      Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

    const segments: TranscriptSegment[] = [];
    let sawTimestamp = false;
    for (const rawLine of raw.split(/\r?\n/)) {
      const match = line.exec(rawLine.trim());
      if (!match) continue;
      sawTimestamp = true;
      const [, h1, m1, s1, ms1, h2, m2, s2, ms2, text = ''] = match;
      if (NON_SPEECH.test(text) || text.trim().length === 0) continue;
      segments.push({
        id: createId('seg'),
        start: toSeconds(h1!, m1!, s1!, ms1!),
        end: toSeconds(h2!, m2!, s2!, ms2!),
        text: text.trim(),
      });
    }
    if (!sawTimestamp && raw.trim().length > 0) throw malformed('no timestamped segments in text output');
    return createTranscript({ segments, duration: options.duration ?? segments.at(-1)?.end });
  },
};
