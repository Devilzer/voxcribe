import { ASRManager } from '@core/asr/ASRManager';
import { MockASREngine } from '@core/asr/engines/MockASREngine';
import { WhisperCppEngine } from '@core/asr/engines/WhisperCppEngine';
import { MockAudioRecorder, type AudioRecorder } from '@core/audio/AudioRecorder';
import { createLogger, isLogLevel, type Logger } from '@core/logging/Logger';
import { LocalModelManager } from '@core/models/ModelManager';
import { ModelRegistry } from '@core/models/ModelRegistry';
import type { ModelManager } from '@core/models/types';
import { DictationPipeline } from '@core/pipeline/DictationPipeline';
import { NativeRuntimeLocator } from '@core/runtime/NativeRuntime';
import { NATIVE_RUNTIMES } from '@core/runtime/runtimes';
import { SettingsStore } from '@core/settings/SettingsStore';
import { InMemoryStorage, createMockTranscripts, type Storage } from '@core/storage/Storage';
import { PassthroughVAD } from '@core/vad/VAD';
import type { AppPaths } from '../paths';

export interface Services {
  logger: Logger;
  paths: AppPaths;
  settings: SettingsStore;
  models: ModelManager;
  runtimes: NativeRuntimeLocator;
  asr: ASRManager;
  recorder: AudioRecorder;
  storage: Storage;
  dictation: DictationPipeline;
}

const logLevel = import.meta.env.MAIN_VITE_LOG_LEVEL;

export const rootLogger = createLogger('main', { level: isLogLevel(logLevel) ? logLevel : 'info' });

/** Composition root: the only place concrete implementations are chosen. */
export async function createServices(paths: AppPaths): Promise<Services> {
  const logger = rootLogger;
  const settings = new SettingsStore();
  const runtimes = new NativeRuntimeLocator({ binariesDir: paths.binariesDir, definitions: NATIVE_RUNTIMES });
  const models = new LocalModelManager({
    registry: new ModelRegistry(),
    modelsDir: paths.modelsDir,
    logger: logger.child('models'),
  });

  const asr = new ASRManager({ modelManager: models, logger: logger.child('asr') });
  if (import.meta.env.MAIN_VITE_ASR_ENGINE === 'mock') {
    logger.warn('Using MockASREngine in place of whisper.cpp (MAIN_VITE_ASR_ENGINE=mock)');
    asr.registerEngine(new MockASREngine({ id: 'whisper', name: 'Mock Whisper', latencyMs: 600 }));
  } else {
    asr.registerEngine(new WhisperCppEngine({ runtimeLocator: runtimes, logger: logger.child('whisper.cpp') }));
  }
  // TODO(parakeet): asr.registerEngine(new ParakeetEngine({ runtimeLocator: runtimes, ... }));

  await asr.selectModel(settings.get().selectedModelId);
  settings.subscribe(async (next, previous) => {
    if (next.selectedModelId !== previous.selectedModelId) await asr.selectModel(next.selectedModelId);
  });

  const recorder = new MockAudioRecorder();
  const storage = new InMemoryStorage(createMockTranscripts());
  const dictation = new DictationPipeline({
    recorder,
    vad: new PassthroughVAD(),
    asr,
    storage,
    settings,
    logger: logger.child('dictation'),
  });

  logger.info('Services ready', { modelsDir: paths.modelsDir, binariesDir: paths.binariesDir });
  return { logger, paths, settings, models, runtimes, asr, recorder, storage, dictation };
}
