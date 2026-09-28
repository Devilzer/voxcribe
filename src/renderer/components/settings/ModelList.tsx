import { formatBytes } from '@shared/transcript';
import type { ModelInfo } from '@shared/types';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

export interface ModelListProps {
  models: ModelInfo[];
  selectedModelId: string | undefined;
  onSelect: (modelId: string) => void;
}

/** Renders any model from the registry; no engine-specific UI. */
export function ModelList({ models, selectedModelId, onSelect }: ModelListProps) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {models.map((model) => {
        const planned = model.availability === 'planned';
        const selected = model.id === selectedModelId;
        return (
          <button
            key={model.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={planned}
            onClick={() => onSelect(model.id)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              selected ? 'border-primary bg-accent' : 'hover:bg-accent/50',
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{model.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {model.runtime}
                {model.sizeBytes !== undefined && ` · ${formatBytes(model.sizeBytes)}`}
                {model.description && ` · ${model.description}`}
              </p>
            </div>
            {planned ? (
              <Badge variant="outline">Coming soon</Badge>
            ) : model.installed ? (
              <Badge variant="success">Installed</Badge>
            ) : (
              <Badge variant="secondary">Not installed</Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
