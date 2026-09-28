import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { ModelError } from '../errors';

export interface DownloadRequest {
  url: string;
  /** Temporary file (`*.part`); the caller renames it after verification. */
  destination: string;
  /** Exact expected size from the registry. The download fails if the body differs. */
  expectedBytes: number;
  signal?: AbortSignal;
  onProgress?: (downloadedBytes: number, totalBytes: number) => void;
}

export interface ModelDownloader {
  download(request: DownloadRequest): Promise<void>;
}

export type FetchLike = (url: string, init: { redirect: 'manual'; signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Response>;

export interface HttpModelDownloaderOptions {
  fetch?: FetchLike;
  /** Hostnames allowed at every hop (exact or `*.suffix`). */
  allowedHosts?: readonly string[];
  maxRedirects?: number;
}

/** Hugging Face and its CDN (`*.hf.co` serves LFS/Xet content). */
export const HUGGING_FACE_HOSTS = ['huggingface.co', '*.huggingface.co', 'hf.co', '*.hf.co'] as const;

function hostAllowed(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some((pattern) =>
    pattern.startsWith('*.') ? hostname.endsWith(pattern.slice(1)) : hostname === pattern,
  );
}

/**
 * Streams a file over HTTPS to disk. Redirects are followed manually so every
 * hop is checked against the host allowlist. Integrity is checked afterwards
 * by the ModelVerifier; this class only guarantees size and transport.
 */
export class HttpModelDownloader implements ModelDownloader {
  private readonly fetch: FetchLike;
  private readonly allowedHosts: readonly string[];
  private readonly maxRedirects: number;

  constructor(options: HttpModelDownloaderOptions = {}) {
    this.fetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.allowedHosts = options.allowedHosts ?? HUGGING_FACE_HOSTS;
    this.maxRedirects = options.maxRedirects ?? 5;
  }

  async download(request: DownloadRequest): Promise<void> {
    const response = await this.open(request.url, request.signal);
    const lengthHeader = response.headers.get('content-length');
    if (lengthHeader !== null && Number(lengthHeader) !== request.expectedBytes) {
      throw new ModelError('MODEL_DOWNLOAD_FAILED', `Unexpected size ${lengthHeader}, expected ${request.expectedBytes}`);
    }
    if (!response.body) throw new ModelError('MODEL_DOWNLOAD_FAILED', 'Empty response body');

    let downloaded = 0;
    const counter = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        downloaded += chunk.length;
        if (downloaded > request.expectedBytes) {
          callback(new ModelError('MODEL_DOWNLOAD_FAILED', 'Download is larger than the registry size'));
          return;
        }
        request.onProgress?.(downloaded, request.expectedBytes);
        callback(null, chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
      counter,
      createWriteStream(request.destination, { flags: 'w' }),
      { signal: request.signal },
    );

    if (downloaded !== request.expectedBytes) {
      throw new ModelError('MODEL_DOWNLOAD_FAILED', `Download truncated at ${downloaded} of ${request.expectedBytes} bytes`);
    }
  }

  private async open(initialUrl: string, signal?: AbortSignal): Promise<Response> {
    let url = initialUrl;
    for (let hop = 0; hop <= this.maxRedirects; hop++) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !hostAllowed(parsed.hostname, this.allowedHosts)) {
        throw new ModelError('MODEL_DOWNLOAD_FAILED', `Refusing to download from ${parsed.protocol}//${parsed.hostname}`);
      }
      const response = await this.fetch(url, { redirect: 'manual', signal });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new ModelError('MODEL_DOWNLOAD_FAILED', `Redirect ${response.status} without location`);
        url = new URL(location, url).toString();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ModelError('MODEL_DOWNLOAD_FAILED', `HTTP ${response.status}`, { details: { status: response.status } });
      }
      return response;
    }
    throw new ModelError('MODEL_DOWNLOAD_FAILED', 'Too many redirects');
  }
}
