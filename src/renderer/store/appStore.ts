import { create } from 'zustand';
import { canTransition } from '@shared/stateMachine';
import type {
  AppPage,
  AppSettings,
  AppState,
  AudioDevice,
  ModelInfo,
  Transcript,
} from '@shared/types';
import type { UiError } from '../types';

export interface AppStoreState {
  currentState: AppState;
  /** Non-null only while `currentState === 'error'`. */
  error: UiError | null;
  page: AppPage;

  settings: AppSettings | null;
  models: ModelInfo[];
  devices: AudioDevice[];
  /** Derived from settings + models. */
  selectedModel: ModelInfo | null;
  /** Device id; `null` = system default. */
  selectedMicrophone: string | null;

  currentTranscript: Transcript | null;
  history: Transcript[];
  /** Milliseconds; only advances while recording. */
  recordingDuration: number;
  recordingStartedAt: number | null;
}

export interface AppStoreActions {
  /** Moves the state machine. Returns false (and changes nothing) for illegal moves. */
  transition(next: Exclude<AppState, 'error'>, now?: number): boolean;
  fail(error: UiError): void;
  dismissError(): void;
  tickRecording(now?: number): void;
  setPage(page: AppPage): void;
  setSettings(settings: AppSettings): void;
  setModels(models: ModelInfo[]): void;
  setDevices(devices: AudioDevice[]): void;
  setTranscript(transcript: Transcript | null): void;
  setHistory(history: Transcript[]): void;
}

export type AppStore = AppStoreState & AppStoreActions;

export const initialAppState: AppStoreState = {
  currentState: 'idle',
  error: null,
  page: 'home',
  settings: null,
  models: [],
  devices: [],
  selectedModel: null,
  selectedMicrophone: null,
  currentTranscript: null,
  history: [],
  recordingDuration: 0,
  recordingStartedAt: null,
};

function resolveModel(settings: AppSettings | null, models: ModelInfo[]): ModelInfo | null {
  if (!settings) return null;
  return models.find((model) => model.id === settings.selectedModelId) ?? null;
}

export const useAppStore = create<AppStore>()((set, get) => ({
  ...initialAppState,

  transition: (next, now = Date.now()) => {
    const { currentState } = get();
    if (!canTransition(currentState, next)) return false;
    set({
      currentState: next,
      error: null,
      ...(next === 'recording' ? { recordingStartedAt: now, recordingDuration: 0 } : { recordingStartedAt: null }),
    });
    return true;
  },

  fail: (error) => set({ currentState: 'error', error, recordingStartedAt: null }),

  dismissError: () => {
    if (get().currentState === 'error') set({ currentState: 'idle', error: null });
  },

  tickRecording: (now = Date.now()) => {
    const { currentState, recordingStartedAt } = get();
    if (currentState !== 'recording' || recordingStartedAt === null) return;
    set({ recordingDuration: Math.max(0, now - recordingStartedAt) });
  },

  setPage: (page) => set({ page }),

  setSettings: (settings) =>
    set((state) => ({
      settings,
      selectedModel: resolveModel(settings, state.models),
      selectedMicrophone: settings.microphoneId,
    })),

  setModels: (models) => set((state) => ({ models, selectedModel: resolveModel(state.settings, models) })),

  setDevices: (devices) => set({ devices }),

  setTranscript: (currentTranscript) => set({ currentTranscript }),

  setHistory: (history) => set({ history }),
}));
