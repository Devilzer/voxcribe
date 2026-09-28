import { beforeEach, describe, expect, it } from 'vitest';
import { initialAppState, useAppStore } from '@renderer/store/appStore';
import type { AppSettings, ModelInfo } from '@shared/types';

const settings: AppSettings = {
  selectedModelId: 'whisper-small',
  microphoneId: null,
  language: 'auto',
  shortcut: 'CommandOrControl+Shift+Space',
  postProcessing: { enabled: false, provider: 'none' },
  storage: { saveHistory: true },
};

const small = { id: 'whisper-small', name: 'Whisper Small' } as ModelInfo;

describe('appStore state machine', () => {
  beforeEach(() => useAppStore.setState(initialAppState));

  it('follows the dictation happy path', () => {
    const { transition } = useAppStore.getState();
    expect(transition('recording', 1_000)).toBe(true);
    useAppStore.getState().tickRecording(3_500);
    expect(useAppStore.getState().recordingDuration).toBe(2_500);

    expect(transition('processing')).toBe(true);
    expect(transition('transcribing')).toBe(true);
    expect(transition('idle')).toBe(true);
    expect(useAppStore.getState().currentState).toBe('idle');
    expect(useAppStore.getState().recordingStartedAt).toBeNull();
  });

  it('rejects impossible transitions', () => {
    const { transition } = useAppStore.getState();
    expect(transition('transcribing')).toBe(false);
    expect(transition('inserting')).toBe(false);
    expect(useAppStore.getState().currentState).toBe('idle');
  });

  it('only holds an error while in the error state', () => {
    const store = useAppStore.getState();
    store.transition('recording');
    store.fail({ code: 'AUDIO_NO_RECORDING', message: 'Nothing was recorded.' });
    expect(useAppStore.getState()).toMatchObject({ currentState: 'error', error: { code: 'AUDIO_NO_RECORDING' } });

    expect(useAppStore.getState().transition('recording')).toBe(true);
    expect(useAppStore.getState().error).toBeNull();
  });

  it('derives the selected model from settings and the model list', () => {
    const store = useAppStore.getState();
    store.setSettings(settings);
    expect(useAppStore.getState().selectedModel).toBeNull();
    store.setModels([small]);
    expect(useAppStore.getState().selectedModel?.name).toBe('Whisper Small');
  });
});
