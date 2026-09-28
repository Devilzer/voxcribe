import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WhisperCppEngine } from '@core/asr/engines/whisper/WhisperCppEngine';
import type { AudioInput } from '@core/asr/types';
import { silentLogger } from '@core/logging/Logger';
import type { ProcessResult, ProcessRunner } from '@core/process/ProcessRunner';
import { NativeRuntimeLocator } from '@core/runtime/NativeRuntime';
import { NATIVE_RUNTIMES } from '@core/runtime/runtimes';
import { useTempDir } from '../helpers/fs';
import { writeSilentWav } from '../helpers/wav';

const fixture = readFileSync(join(__dirname, '../fixtures/whisper-output.json'), 'utf8');
const BINARY = '/app/binaries/whisper.cpp/linux-x64/whisper-cli';
const MODEL = '/data/models/whisper/ggml-base.bin';

type RunCall = { executable: string; args: readonly string[] };

function fakeRunner(behaviour: (call: RunCall) => Promise<Partial<ProcessResult>>) {
  const calls: RunCall[] = [];
  const runner: ProcessRunner = {
    async run(executable, args) {
      calls.push({ executable, args });
      const result = await behaviour({ executable, args });
      return { exitCode: 0, signal: null, stdout: '', stderr: '', timedOut: false, ...result };
    },
  };
  return { runner, calls };
}

/** Behaves like whisper-cli with `-oj`: writes `<output-file>.json`. */
const writesJson = async ({ args }: RunCall) => {
  const prefix = args[args.indexOf('--output-file') + 1]!;
  await writeFile(`${prefix}.json`, fixture);
  return {};
};

function setup(tempDir: string, runner: ProcessRunner, existing: string[] = [BINARY, MODEL]) {
  const fileExists = (path: string) => existing.includes(path);
  const runtimeLocator = new NativeRuntimeLocator({
    binariesDir: '/app/binaries',
    definitions: NATIVE_RUNTIMES,
    platform: 'linux',
    arch: 'x64',
    fileExists,
  });
  return new WhisperCppEngine({ runtimeLocator, processRunner: runner, logger: silentLogger, tempDir, threads: 2, fileExists });
}

const pcm: AudioInput = { kind: 'pcm', samples: new Float32Array(16_000), sampleRate: 16_000, channels: 1, durationMs: 1000 };

describe('WhisperCppEngine', () => {
  const tempDir = useTempDir();

  it('fails with WHISPER_BINARY_NOT_FOUND when whisper-cli is missing', async () => {
    const engine = setup(await tempDir(), fakeRunner(writesJson).runner, [MODEL]);
    await expect(engine.initialize(MODEL)).rejects.toMatchObject({ code: 'WHISPER_BINARY_NOT_FOUND' });
  });

  it('fails with MODEL_NOT_INSTALLED when the model file is missing', async () => {
    const engine = setup(await tempDir(), fakeRunner(writesJson).runner, [BINARY]);
    await expect(engine.initialize(MODEL)).rejects.toMatchObject({ code: 'MODEL_NOT_INSTALLED' });
  });

  it('transcribes a WAV file by running whisper-cli with an argument array', async () => {
    const dir = await tempDir();
    const wav = join(dir, 'sample.wav');
    await writeSilentWav(wav, 2);
    const { runner, calls } = fakeRunner(writesJson);
    const engine = setup(dir, runner);
    await engine.initialize(MODEL);

    const transcript = await engine.transcribe({ kind: 'file', path: wav, format: 'wav' }, { language: 'en' });

    expect(transcript.text).toBe('Hello, this is a test of Voxcribe. Everything runs locally.');
    expect(transcript.duration).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.executable).toBe(BINARY);
    expect(calls[0]!.args).toEqual(expect.arrayContaining(['--model', MODEL, '--file', wav, '--language', 'en', '--output-json']));
  });

  it('writes PCM input to a temporary WAV and cleans it up', async () => {
    const dir = await tempDir();
    let audioPath = '';
    const engine = setup(
      dir,
      fakeRunner(async (call) => {
        audioPath = call.args[call.args.indexOf('--file') + 1]!;
        expect(readFileSync(audioPath).toString('ascii', 0, 4)).toBe('RIFF');
        return writesJson(call);
      }).runner,
    );
    await engine.initialize(MODEL);
    await engine.transcribe(pcm);
    expect(() => readFileSync(audioPath)).toThrow();
  });

  it('maps a non-zero exit code to WHISPER_PROCESS_FAILED', async () => {
    const engine = setup(await tempDir(), fakeRunner(async () => ({ exitCode: 3, stderr: 'boom' })).runner);
    await engine.initialize(MODEL);
    await expect(engine.transcribe(pcm)).rejects.toMatchObject({ code: 'WHISPER_PROCESS_FAILED' });
  });

  it('maps spawn errors and timeouts to WHISPER_PROCESS_FAILED', async () => {
    const spawnFails: ProcessRunner = { run: () => Promise.reject(new Error('EACCES')) };
    const engine = setup(await tempDir(), spawnFails);
    await engine.initialize(MODEL);
    await expect(engine.transcribe(pcm)).rejects.toMatchObject({ code: 'WHISPER_PROCESS_FAILED' });

    const timesOut = setup(await tempDir(), fakeRunner(async () => ({ exitCode: null, signal: 'SIGKILL', timedOut: true })).runner);
    await timesOut.initialize(MODEL);
    await expect(timesOut.transcribe(pcm)).rejects.toMatchObject({ code: 'WHISPER_PROCESS_FAILED' });
  });

  it('falls back to stdout parsing when no JSON file is written', async () => {
    const stdout = '[00:00:00.000 --> 00:00:01.000]   Plain text output.';
    const engine = setup(await tempDir(), fakeRunner(async () => ({ stdout })).runner);
    await engine.initialize(MODEL);
    expect((await engine.transcribe(pcm)).text).toBe('Plain text output.');
  });

  it('rejects invalid audio files and language codes', async () => {
    const dir = await tempDir();
    const notWav = join(dir, 'notes.wav');
    await writeFile(notWav, 'definitely not audio');
    const engine = setup(dir, fakeRunner(writesJson).runner);
    await engine.initialize(MODEL);
    await expect(engine.transcribe({ kind: 'file', path: notWav, format: 'wav' })).rejects.toMatchObject({ code: 'INVALID_AUDIO' });
    await expect(engine.transcribe(pcm, { language: 'en; rm -rf /' })).rejects.toMatchObject({ code: 'ASR_TRANSCRIPTION_FAILED' });
  });

  it('requires initialize() before transcribe()', async () => {
    const engine = setup(await tempDir(), fakeRunner(writesJson).runner);
    await expect(engine.transcribe(pcm)).rejects.toMatchObject({ code: 'ASR_ENGINE_NOT_INITIALIZED' });
  });
});
