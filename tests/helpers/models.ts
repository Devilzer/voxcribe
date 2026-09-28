import { createHash } from 'node:crypto';
import type { DownloadableModelDefinition } from '@shared/types';

export const FAKE_MODEL_BYTES = Buffer.from('not really a ggml model, but good enough for tests\n'.repeat(200));

export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function fakeModel(overrides: Partial<DownloadableModelDefinition> = {}): DownloadableModelDefinition {
  return {
    id: 'fake-small',
    name: 'Fake Small',
    engine: 'whisper',
    runtime: 'whisper.cpp',
    provider: 'test',
    format: 'ggml',
    languages: ['*'],
    filename: 'ggml-fake.bin',
    availability: 'available',
    capabilities: { multilingual: true, streaming: false, timestamps: true },
    tagline: 'Test',
    sizeBytes: FAKE_MODEL_BYTES.length,
    sha256: sha256(FAKE_MODEL_BYTES),
    downloadUrl: 'https://huggingface.co/test/repo/resolve/abc/ggml-fake.bin',
    ...overrides,
  };
}

/** Minimal `fetch` stand-in serving `body` (optionally after a redirect, optionally failing mid-stream). */
export function fakeFetch(options: {
  body?: Buffer;
  status?: number;
  redirectTo?: string;
  failAfterBytes?: number;
  chunkSize?: number;
  /** Called before each chunk; lets tests pause or cancel mid-download. */
  beforeChunk?: (index: number) => Promise<void> | void;
}) {
  const calls: string[] = [];
  const fetch = async (url: string, init: { signal?: AbortSignal }): Promise<Response> => {
    calls.push(url);
    if (options.redirectTo && calls.length === 1) {
      return new Response(null, { status: 302, headers: { location: options.redirectTo } });
    }
    if (options.status && options.status >= 400) return new Response('nope', { status: options.status });

    const body = options.body ?? FAKE_MODEL_BYTES;
    const chunkSize = options.chunkSize ?? 1024;
    let offset = 0;
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await options.beforeChunk?.(index++);
        if (init.signal?.aborted) {
          controller.error(new DOMException('Aborted', 'AbortError'));
          return;
        }
        if (options.failAfterBytes !== undefined && offset >= options.failAfterBytes) {
          controller.error(new TypeError('network connection lost'));
          return;
        }
        if (offset >= body.length) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(body.subarray(offset, offset + chunkSize)));
        offset += chunkSize;
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-length': String(body.length) } });
  };
  return { fetch, calls };
}
