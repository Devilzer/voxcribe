import { Loader2, Mic, Square } from 'lucide-react';
import { formatDuration } from '@shared/transcript';
import { isBusy } from '@shared/stateMachine';
import { cn, formatShortcut } from '../../lib/utils';
import { toggleDictation } from '../../services/dictation';
import { useAppStore } from '../../store/appStore';
import { STATE_LABELS } from './status';

export function RecordButton() {
  const currentState = useAppStore((state) => state.currentState);
  const recordingDuration = useAppStore((state) => state.recordingDuration);
  const shortcut = useAppStore((state) => state.settings?.shortcut);

  const recording = currentState === 'recording';
  const busy = isBusy(currentState);
  const Icon = busy ? Loader2 : recording ? Square : Mic;

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <button
        type="button"
        onClick={() => void toggleDictation()}
        disabled={busy}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        className={cn(
          'relative flex size-24 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-70',
          recording ? 'bg-destructive' : 'bg-primary hover:scale-105',
        )}
      >
        {recording && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />}
        <Icon className={cn('relative size-9', busy && 'animate-spin')} />
      </button>
      <div className="text-center">
        <p className="text-sm font-medium">
          {recording ? `${STATE_LABELS.recording} ${formatDuration(recordingDuration)}` : busy ? STATE_LABELS[currentState] : 'Hold shortcut and speak'}
        </p>
        {shortcut && (
          <p className="mt-1 text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{formatShortcut(shortcut)}</kbd>{' '}
            toggles dictation
          </p>
        )}
      </div>
    </div>
  );
}
