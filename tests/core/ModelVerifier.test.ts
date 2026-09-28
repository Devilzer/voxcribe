import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Sha256ModelVerifier } from '@core/models/ModelVerifier';
import { useTempDir } from '../helpers/fs';
import { sha256 } from '../helpers/models';

describe('Sha256ModelVerifier', () => {
  const tempDir = useTempDir();
  const verifier = new Sha256ModelVerifier();
  const content = Buffer.from('hello voxcribe');

  it('accepts a file whose SHA-256 matches', async () => {
    const file = join(await tempDir(), 'model.bin');
    await writeFile(file, content);
    expect(await verifier.verify(file, sha256(content))).toBe(true);
    expect(await verifier.verify(file, sha256(content).toUpperCase())).toBe(true);
  });

  it('rejects a file whose SHA-256 differs', async () => {
    const file = join(await tempDir(), 'model.bin');
    await writeFile(file, content);
    expect(await verifier.verify(file, sha256(Buffer.from('something else')))).toBe(false);
  });

  it('refuses an expected value that is not a SHA-256 digest', async () => {
    const file = join(await tempDir(), 'model.bin');
    await writeFile(file, content);
    await expect(verifier.verify(file, 'deadbeef')).rejects.toThrow(/SHA-256/);
  });
});
