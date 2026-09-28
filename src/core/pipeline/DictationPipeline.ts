import type { RecordingResult, Transcript } from '@shared/types';
import type { ASRManager } from '../asr/ASRManager';
import type { AudioInput } from '../asr/types';
import type { AudioRecorder } from '../audio/AudioRecorder';
import { readWavInfo } from '../audio/wav';
import { AudioError } from '../errors';
import type { Logger } from '../logging/Logger';
import type { SettingsStore } from '../settings/SettingsStore';
import type { Storage } from '../storage/Storage';
import type { VoiceActivityDetector } from '../vad/VAD';

export interface DictationPipelineDeps {
  recorder: AudioRecorder;
  vad: VoiceActivityDetector;
  asr: ASRManager;
  storage: Storage;
  settings: SettingsStore;
  logger: Logger;
}

/**
 * Microphone → AudioRecorder → VAD → ASREngine → Storage.
 * Files: WAV → ASREngine → Storage.
 *
 * TODO(llm): optional TextModel cleanup step after ASR.
 * TODO(insert): paste/type the result into the focused app.
 */
export class DictationPipeline {
  private pendingAudio: AudioInput | null = null;

  constructor(private readonly deps: DictationPipelineDeps) {}

  async startRecording(): Promise<void> {
    // Fail fast (e.g. "Whisper Small isn't installed") before capturing any audio.
    await this.deps.asr.assertReady();
    this.pendingAudio = null;
    await this.deps.recorder.start({ deviceId: this.deps.settings.get().microphoneId });
    this.deps.logger.info('Recording started');
  }

  async stopRecording(): Promise<RecordingResult> {
    const audio = await this.deps.recorder.stop();
    this.pendingAudio = audio;
    this.deps.logger.info('Recording stopped', { durationMs: audio.durationMs });
    return { durationMs: audio.durationMs };
  }

  async transcribePending(): Promise<Transcript> {
    const audio = this.pendingAudio;
    if (!audio) throw new AudioError('AUDIO_NO_RECORDING', 'No recorded audio to transcribe');
    this.pendingAudio = null;

    return this.run(audio);
  }

  /** Transcribes a WAV file chosen by the user (Phase 2 test path; no VAD/recorder). */
  async transcribeFile(path: string): Promise<Transcript> {
    const info = await readWavInfo(path);
    return this.run({ kind: 'file', path, format: 'wav', durationMs: info.durationMs });
  }

  private async run(audio: AudioInput): Promise<Transcript> {
    const settings = this.deps.settings.get();
    const vadResult = await this.deps.vad.process(audio);
    if (!vadResult.hasSpeech) throw new AudioError('AUDIO_NO_SPEECH', 'No speech detected');

    const transcript = await this.deps.asr.transcribe(vadResult.audio, { language: settings.language });
    if (transcript.text.length === 0) throw new AudioError('AUDIO_NO_SPEECH', 'Transcript is empty');
    if (settings.storage.saveHistory) await this.deps.storage.saveTranscript(transcript);
    return transcript;
  }
}
