import { spawn } from 'node:child_process';

export interface ProcessRunOptions {
  /** Kill the process after this many ms. */
  timeoutMs?: number;
  signal?: AbortSignal;
  cwd?: string;
  /** Cap on captured stdout/stderr each; extra output is dropped. */
  maxOutputBytes?: number;
}

export interface ProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Runs a native executable with an argument array. No shell is ever involved,
 * so arguments cannot be interpreted as shell syntax.
 */
export interface ProcessRunner {
  run(executable: string, args: readonly string[], options?: ProcessRunOptions): Promise<ProcessResult>;
}

const DEFAULT_MAX_OUTPUT = 4 * 1024 * 1024;

export class NodeProcessRunner implements ProcessRunner {
  run(executable: string, args: readonly string[], options: ProcessRunOptions = {}): Promise<ProcessResult> {
    const maxOutput = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT;
    return new Promise((resolve, reject) => {
      const child = spawn(executable, [...args], {
        shell: false,
        windowsHide: true,
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        signal: options.signal,
      });

      const collect = () => {
        const chunks: Buffer[] = [];
        let size = 0;
        return {
          push(chunk: Buffer) {
            if (size >= maxOutput) return;
            chunks.push(chunk.subarray(0, maxOutput - size));
            size += chunk.length;
          },
          text: () => Buffer.concat(chunks).toString('utf8'),
        };
      };
      const stdout = collect();
      const stderr = collect();
      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

      let timedOut = false;
      const timer =
        options.timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              timedOut = true;
              child.kill('SIGKILL');
            }, options.timeoutMs);

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (exitCode, signal) => {
        clearTimeout(timer);
        resolve({ exitCode, signal, stdout: stdout.text(), stderr: stderr.text(), timedOut });
      });
    });
  }
}
