import { Cpu, Activity } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { STATE_LABELS } from './status';

export function StatusBar() {
  const currentState = useAppStore((state) => state.currentState);
  const selectedModel = useAppStore((state) => state.selectedModel);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Cpu className="size-3.5" /> Model: <span className="font-medium text-foreground">{selectedModel?.name ?? '—'}</span>
        {selectedModel && !selectedModel.installed && <span>(not installed)</span>}
      </span>
      <span className="flex items-center gap-1.5">
        <Activity className="size-3.5" /> Status: <span className="font-medium text-foreground">{STATE_LABELS[currentState]}</span>
      </span>
    </div>
  );
}
