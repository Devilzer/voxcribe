import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

/** Advances `recordingDuration` while recording. */
export function useRecordingTimer(intervalMs = 200): void {
  const isRecording = useAppStore((state) => state.currentState === 'recording');
  const tick = useAppStore((state) => state.tickRecording);

  useEffect(() => {
    if (!isRecording) return;
    const id = window.setInterval(() => tick(), intervalMs);
    return () => window.clearInterval(id);
  }, [isRecording, tick, intervalMs]);
}
