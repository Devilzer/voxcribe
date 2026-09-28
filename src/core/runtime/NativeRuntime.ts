import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NativeRuntimeError } from '../errors';

/** A native executable the main process can run (whisper.cpp, NeMo-Speech.cpp, ...). */
export interface NativeRuntime {
  id: string;
  name: string;
  /** Absolute path, set only when the binary exists on disk. */
  executablePath?: string;
  version?: string;
}

export interface NativeRuntimeDefinition {
  id: string;
  name: string;
  /** Executable name without extension; `.exe` is appended on Windows. */
  executableName: string;
  /** Pinned upstream version we build/ship. */
  version?: string;
}

export interface NativeRuntimeLocatorOptions {
  /** `resources/binaries` in dev, `process.resourcesPath/binaries` when packaged. */
  binariesDir: string;
  definitions: readonly NativeRuntimeDefinition[];
  platform?: NodeJS.Platform;
  arch?: string;
  fileExists?: (path: string) => boolean;
}

/**
 * Resolves native runtime binaries. Expected layout:
 *
 *   <binariesDir>/<runtime-id>/<platform>-<arch>/<executable>
 *   e.g. resources/binaries/whisper.cpp/linux-x64/whisper-cli
 */
export class NativeRuntimeLocator {
  private readonly platform: NodeJS.Platform;
  private readonly arch: string;
  private readonly fileExists: (path: string) => boolean;

  constructor(private readonly options: NativeRuntimeLocatorOptions) {
    this.platform = options.platform ?? process.platform;
    this.arch = options.arch ?? process.arch;
    this.fileExists = options.fileExists ?? existsSync;
  }

  list(): NativeRuntime[] {
    return this.options.definitions.map((definition) => this.locate(definition.id));
  }

  getExpectedPath(id: string): string {
    const definition = this.getDefinition(id);
    const executable =
      this.platform === 'win32' ? `${definition.executableName}.exe` : definition.executableName;
    return join(this.options.binariesDir, definition.id, `${this.platform}-${this.arch}`, executable);
  }

  locate(id: string): NativeRuntime {
    const definition = this.getDefinition(id);
    const expectedPath = this.getExpectedPath(id);
    return {
      id: definition.id,
      name: definition.name,
      version: definition.version,
      executablePath: this.fileExists(expectedPath) ? expectedPath : undefined,
    };
  }

  /** Like `locate` but throws when the binary is missing. */
  require(id: string): NativeRuntime & { executablePath: string } {
    const runtime = this.locate(id);
    if (!runtime.executablePath) {
      throw new NativeRuntimeError('NATIVE_RUNTIME_NOT_FOUND', `Missing ${id} binary at ${this.getExpectedPath(id)}`, {
        details: { runtimeName: runtime.name, expectedPath: this.getExpectedPath(id) },
      });
    }
    return { ...runtime, executablePath: runtime.executablePath };
  }

  private getDefinition(id: string): NativeRuntimeDefinition {
    const definition = this.options.definitions.find((candidate) => candidate.id === id);
    if (!definition) {
      throw new NativeRuntimeError('NATIVE_RUNTIME_NOT_FOUND', `Unknown native runtime "${id}"`, {
        details: { runtimeName: id },
      });
    }
    return definition;
  }
}
