import { ASRManager } from '@core/asr/ASRManager';
import { MockASREngine } from '@core/asr/engines/MockASREngine';
import { WhisperCppEngine } from '@core/asr/engines/whisper/WhisperCppEngine';
import { MockAudioRecorder, type AudioRecorder } from '@core/audio/AudioRecorder';
import { createLogger, isLogLevel, type Logger } from '@core/logging/Logger';
import { HttpModelDownloader } from '@core/models/ModelDownloader';
import { LocalModelManager } from '@core/models/ModelManager';
import { ModelRegistry } from '@core/models/ModelRegistry';
import { Sha256ModelVerifier } from '@core/models/ModelVerifier';
import { DictationPipeline } from '@core/pipeline/DictationPipeline';
import { NodeProcessRunner } from '@core/process/ProcessRunner';
import { NativeRuntimeLocator } from '@core/runtime/NativeRuntime';
import { NATIVE_RUNTIMES } from '@core/runtime/runtimes';
import { SettingsStore } from '@core/settings/SettingsStore';
import { InMemoryStorage, createMockTranscripts, type Storage } from '@core/storage/Storage';
import { PassthroughVAD } from '@core/vad/VAD';
import { sanitizeStoredSettings } from '../ipc/validators';
import type { AppPaths } from '../paths';
import { AudioFileSelector } from './audioFiles';

export interface Services {
  logger: Logger;
  paths: AppPaths;
  settings: SettingsStore;
  registry: ModelRegistry;
  models: LocalModelManager;
  runtimes: NativeRuntimeLocator;
  asr: ASRManager;
  recorder: AudioRecorder;
  storage: Storage;
  dictation: DictationPipeline;
  audioFiles: AudioFileSelector;
}

const logLevel = import.meta.env.MAIN_VITE_LOG_LEVEL;
const useMockAsr = import.meta.env.MAIN_VITE_ASR_ENGINE === 'mock';

export const rootLogger = createLogger('main', { level: isLogLevel(logLevel) ? logLevel : 'info' });

/** Composition root: the only place concrete implementations are chosen. */
export async function createServices(paths: AppPaths): Promise<Services> {
  const logger = rootLogger;
  const registry = new ModelRegistry();
  const settings = await SettingsStore.load(paths.settingsFile, (raw) => sanitizeStoredSettings(raw, (id) => registry.has(id)), {
    onPersistError: (error) => logger.error('Could not save settings', error),
  });

  const runtimes = new NativeRuntimeLocator({ binariesDir: paths.binariesDir, definitions: NATIVE_RUNTIMES });
  const models = new LocalModelManager({
    registry,
    downloader: new HttpModelDownloader(),
    verifier: new Sha256ModelVerifier(),
    modelsDir: paths.modelsDir,
    logger: logger.child('models'),
  });
  await models.removeStalePartials();

  const asr = new ASRManager({ modelManager: models, logger: logger.child('asr') });
  if (useMockAsr) {
    logger.warn('Using MockASREngine in place of whisper.cpp (MAIN_VITE_ASR_ENGINE=mock)');
    asr.registerEngine(new MockASREngine({ id: 'whisper', name: 'Mock Whisper', latencyMs: 600 }));
  } else {
    asr.registerEngine(
      new WhisperCppEngine({
        runtimeLocator: runtimes,
        processRunner: new NodeProcessRunner(),
        tempDir: paths.tempDir,
        logger: logger.child('whisper.cpp'),
      }),
    );
  }
  // TODO(parakeet): asr.registerEngine(new ParakeetEngine({ runtimeLocator: runtimes, ... }));

  await asr.selectModel(settings.get().activeModelId).catch((error: unknown) => {
    logger.warn('Stored active model is not usable; clearing it', error);
    return settings.update({ activeModelId: null });
  });
  settings.subscribe(async (next, previous) => {
    if (next.activeModelId !== previous.activeModelId) await asr.selectModel(next.activeModelId);
  });

  const recorder = new MockAudioRecorder();
  const storage = new InMemoryStorage(useMockAsr ? createMockTranscripts() : []);
  const dictation = new DictationPipeline({
    recorder,
    vad: new PassthroughVAD(),
    asr,
    storage,
    settings,
    logger: logger.child('dictation'),
  });

  logger.info('Services ready', { modelsDir: paths.modelsDir, binariesDir: paths.binariesDir });
  return {
    logger,
    paths,
    settings,
    registry,
    models,
    runtimes,
    asr,
    recorder,
    storage,
    dictation,
    audioFiles: new AudioFileSelector(paths.audioDialogDir),
  };
}
