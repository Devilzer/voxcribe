import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export interface ModelVerifier {
  /** `expectedSha256` must come from the registry, never from the download itself. */
  verify(filePath: string, expectedSha256: string): Promise<boolean>;
}

/** Streams the file through SHA-256; memory use stays constant for multi-GB models. */
export class Sha256ModelVerifier implements ModelVerifier {
  async hash(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath, { highWaterMark: 1024 * 1024 })) {
      hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
  }

  async verify(filePath: string, expectedSha256: string): Promise<boolean> {
    if (!/^[0-9a-f]{64}$/i.test(expectedSha256)) throw new Error('Expected checksum is not a SHA-256 hex digest');
    return (await this.hash(filePath)) === expectedSha256.toLowerCase();
  }
}
