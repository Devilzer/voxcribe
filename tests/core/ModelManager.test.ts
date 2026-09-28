import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { silentLogger } from '@core/logging/Logger';
import { HttpModelDownloader } from '@core/models/ModelDownloader';
import { LocalModelManager } from '@core/models/ModelManager';
import { ModelRegistry } from '@core/models/ModelRegistry';
import { Sha256ModelVerifier } from '@core/models/ModelVerifier';
import type { DownloadProgress } from '@shared/types';
import { useTempDir } from '../helpers/fs';
import { FAKE_MODEL_BYTES, fakeFetch, fakeModel, sha256 } from '../helpers/models';

function setup(modelsDir: string, fetchOptions: Parameters<typeof fakeFetch>[0] = {}, overrides = {}) {
  const model = fakeModel(overrides);
  const { fetch, calls } = fakeFetch(fetchOptions);
  const manager = new LocalModelManager({
    registry: new ModelRegistry([model]),
    downloader: new HttpModelDownloader({ fetch }),
    verifier: new Sha256ModelVerifier(),
    modelsDir,
    logger: silentLogger,
    progressIntervalMs: 0,
    freeDiskBytes: async () => Number.MAX_SAFE_INTEGER,
  });
  const events: DownloadProgress[] = [];
  manager.onProgress((progress) => events.push(progress));
  return { manager, model, calls, events, finalPath: join(modelsDir, 'whisper', model.filename) };
}

async function listFiles(dir: string): Promise<string[]> {
  return readdir(join(dir, 'whisper')).catch(() => []);
}

describe('LocalModelManager', () => {
  const tempDir = useTempDir();

  it('reports models as not installed and resolves no path', async () => {
    const { manager, model } = setup(await tempDir());
    expect(await manager.isInstalled(model.id)).toBe(false);
    expect(await manager.getModelPath(model.id)).toBeNull();
    expect(await manager.getInstalledModels()).toEqual([]);
  });

  it('detects an installed model and resolves its path under <modelsDir>/<engine>/', async () => {
    const dir = await tempDir();
    const { manager, model, finalPath } = setup(dir);
    await mkdir(join(dir, 'whisper'), { recursive: true });
    await writeFile(finalPath, FAKE_MODEL_BYTES);

    expect(await manager.isInstalled(model.id)).toBe(true);
    expect(await manager.getModelPath(model.id)).toBe(finalPath);
    expect(await manager.verifyModel(model.id)).toBe(true);
  });

  it('does not treat a partial or wrong-size file as installed', async () => {
    const dir = await tempDir();
    const { manager, model, finalPath } = setup(dir);
    await mkdir(join(dir, 'whisper'), { recursive: true });
    await writeFile(`${finalPath}.part`, FAKE_MODEL_BYTES);
    expect(await manager.isInstalled(model.id)).toBe(false);
    await writeFile(finalPath, FAKE_MODEL_BYTES.subarray(0, 10));
    expect(await manager.isInstalled(model.id)).toBe(false);
  });

  it('downloads through an allowed redirect, verifies, then installs', async () => {
    const dir = await tempDir();
    const { manager, model, calls, events, finalPath } = setup(dir, { redirectTo: 'https://us.aws.cdn.hf.co/xet/abc' });

    await manager.downloadModel(model.id);

    expect(calls).toEqual([model.downloadUrl, 'https://us.aws.cdn.hf.co/xet/abc']);
    expect(existsSync(finalPath)).toBe(true);
    expect(await listFiles(dir)).toEqual([model.filename]);
    expect(events.map((event) => event.status)).toEqual(
      expect.arrayContaining(['queued', 'downloading', 'verifying', 'completed']),
    );
    expect(events.at(-1)).toMatchObject({ status: 'completed', percentage: 100, downloadedBytes: model.sizeBytes });
  });

  it('deletes the partial file and reports MODEL_CHECKSUM_MISMATCH when the hash differs', async () => {
    const dir = await tempDir();
    const { manager, model, events } = setup(dir, {}, { sha256: sha256(Buffer.from('different')) });

    await expect(manager.downloadModel(model.id)).rejects.toMatchObject({ code: 'MODEL_CHECKSUM_MISMATCH' });
    expect(await listFiles(dir)).toEqual([]);
    expect(events.at(-1)).toMatchObject({ status: 'failed', error: { code: 'MODEL_CHECKSUM_MISMATCH' } });
    expect(await manager.isInstalled(model.id)).toBe(false);
  });

  it('cleans up after a network failure', async () => {
    const dir = await tempDir();
    const { manager, model, events } = setup(dir, { failAfterBytes: 4096 });

    await expect(manager.downloadModel(model.id)).rejects.toMatchObject({ code: 'MODEL_DOWNLOAD_FAILED' });
    expect(await listFiles(dir)).toEqual([]);
    expect(events.at(-1)?.status).toBe('failed');
  });

  it('fails on HTTP errors and on hosts outside the allowlist', async () => {
    const httpError = setup(await tempDir(), { status: 404 });
    await expect(httpError.manager.downloadModel(httpError.model.id)).rejects.toMatchObject({ code: 'MODEL_DOWNLOAD_FAILED' });

    const evilRedirect = setup(await tempDir(), { redirectTo: 'https://evil.example.com/model.bin' });
    await expect(evilRedirect.manager.downloadModel(evilRedirect.model.id)).rejects.toMatchObject({
      code: 'MODEL_DOWNLOAD_FAILED',
    });
    expect(evilRedirect.calls).toHaveLength(1);
  });

  it('cancels a running download and removes the partial file', async () => {
    const dir = await tempDir();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { manager, model, events } = setup(dir, { beforeChunk: (index) => (index === 3 ? gate : undefined) });

    const download = manager.downloadModel(model.id);
    await expect.poll(() => events.some((event) => event.status === 'downloading' && event.downloadedBytes > 0)).toBe(true);
    const cancelled = manager.cancelDownload(model.id);
    release();
    await cancelled;

    await expect(download).rejects.toMatchObject({ code: 'MODEL_DOWNLOAD_CANCELLED' });
    expect(events.at(-1)?.status).toBe('cancelled');
    expect(await listFiles(dir)).toEqual([]);
  });

  it('refuses to start when the disk is too full', async () => {
    const dir = await tempDir();
    const model = fakeModel();
    const manager = new LocalModelManager({
      registry: new ModelRegistry([model]),
      downloader: new HttpModelDownloader({ fetch: fakeFetch({}).fetch }),
      verifier: new Sha256ModelVerifier(),
      modelsDir: dir,
      logger: silentLogger,
      freeDiskBytes: async () => 10,
    });
    await expect(manager.downloadModel(model.id)).rejects.toMatchObject({ code: 'MODEL_INSUFFICIENT_DISK_SPACE' });
  });

  it('deletes an installed model', async () => {
    const dir = await tempDir();
    const { manager, model } = setup(dir);
    await manager.downloadModel(model.id);
    await manager.deleteModel(model.id);
    expect(await manager.isInstalled(model.id)).toBe(false);
  });

  it('removes stale .part files at startup', async () => {
    const dir = await tempDir();
    const { manager, finalPath } = setup(dir);
    await mkdir(join(dir, 'whisper'), { recursive: true });
    await writeFile(`${finalPath}.part`, 'junk');
    await manager.removeStalePartials();
    expect(await listFiles(dir)).toEqual([]);
  });
});
