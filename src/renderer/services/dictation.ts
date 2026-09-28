import { useAppStore } from '../store/appStore';
import { api, toUiError, unwrap } from './api';
import { createRendererLogger } from './logger';

const logger = createRendererLogger('dictation');

export async function refreshHistory(): Promise<void> {
  try {
    useAppStore.getState().setHistory(await unwrap(api.history.list()));
  } catch (error) {
    logger.warn('Could not load history', error);
  }
}

export async function startDictation(): Promise<void> {
  const store = useAppStore.getState();
  if (!store.transition('recording')) return;
  try {
    await unwrap(api.recording.start());
  } catch (error) {
    store.fail(toUiError(error));
  }
}

export async function stopDictation(): Promise<void> {
  const store = useAppStore.getState();
  if (!store.transition('processing')) return;
  try {
    await unwrap(api.recording.stop());
    store.transition('transcribing');
    const transcript = await unwrap(api.transcription.transcribe());
    store.setTranscript(transcript);
    // TODO(llm): 'cleaning' step when post-processing is enabled.
    // TODO(insert): 'inserting' step to type into the focused app.
    store.transition('idle');
    void refreshHistory();
  } catch (error) {
    logger.warn('Dictation failed', error);
    store.fail(toUiError(error));
  }
}

export async function selectAudioFile(): Promise<void> {
  try {
    const file = await unwrap(api.files.selectAudio());
    if (file) useAppStore.getState().setSelectedAudioFile(file);
  } catch (error) {
    useAppStore.getState().fail(toUiError(error));
  }
}

/** Transcribes the selected WAV file with the active model. Uses the same state machine as dictation. */
export async function transcribeSelectedFile(): Promise<void> {
  const store = useAppStore.getState();
  const file = store.selectedAudioFile;
  if (!file) return;
  if (!store.transition('processing')) return;
  try {
    useAppStore.getState().transition('transcribing');
    const transcript = await unwrap(api.transcription.transcribeFile(file.id));
    useAppStore.getState().setTranscript(transcript);
    useAppStore.getState().transition('idle');
    void refreshHistory();
  } catch (error) {
    logger.warn('File transcription failed', error);
    useAppStore.getState().fail(toUiError(error));
  }
}

/** Shortcut, tray and the record button all call this. Ignored while busy. */
export async function toggleDictation(): Promise<void> {
  const { currentState } = useAppStore.getState();
  if (currentState === 'recording') return stopDictation();
  if (currentState === 'idle' || currentState === 'error') return startDictation();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await unwrap(api.clipboard.writeText(text));
    return true;
  } catch (error) {
    useAppStore.getState().fail(toUiError(error));
    return false;
  }
}
