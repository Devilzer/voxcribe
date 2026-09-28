import type { NativeRuntimeDefinition } from './NativeRuntime';

export const WHISPER_CPP_RUNTIME_ID = 'whisper.cpp';
export const NEMO_SPEECH_CPP_RUNTIME_ID = 'nemo-speech-cpp';

export const NATIVE_RUNTIMES: readonly NativeRuntimeDefinition[] = [
  {
    id: WHISPER_CPP_RUNTIME_ID,
    name: 'whisper.cpp',
    executableName: 'whisper-cli',
    // Must match WHISPER_CPP_VERSION in scripts/build-whisper-cpp.sh.
    version: 'v1.9.4',
  },
  // TODO(parakeet): enable once NeMo-Speech.cpp binaries are built.
  // { id: NEMO_SPEECH_CPP_RUNTIME_ID, name: 'NeMo-Speech.cpp', executableName: 'nemo-speech' },
];
