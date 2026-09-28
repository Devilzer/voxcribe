import { Check, Download, Loader2, Trash2, X } from 'lucide-react';
import { toUserMessage } from '@shared/errors';
import { formatBytes } from '@shared/transcript';
import { getModelDownloadState, type DownloadProgress, type ModelInfo } from '@shared/types';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export interface ModelCardProps {
  model: ModelInfo;
  progress: DownloadProgress | undefined;
  active: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onUse: () => void;
  onDelete: () => void;
}

/** One registry model. Knows nothing about engines, files or runtimes. */
export function ModelCard({ model, progress, active, onDownload, onCancel, onUse, onDelete }: ModelCardProps) {
  const state = getModelDownloadState(model, progress);
  const facts = [model.tagline, model.capabilities.multilingual ? 'Multilingual' : 'English'];
  if (model.sizeBytes !== undefined) facts.push(formatBytes(model.sizeBytes));

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border p-3', active && 'border-primary bg-accent/40', state === 'unavailable' && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            {model.name}
            {active && <Badge>Active</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">{facts.join(' · ')}</p>
          {model.description && <p className="mt-0.5 text-xs text-muted-foreground">{model.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {state === 'unavailable' && <Badge variant="outline">Coming soon</Badge>}
          {(state === 'not-installed' || state === 'error') && (
            <Button size="sm" onClick={onDownload}>
              <Download /> {state === 'error' ? 'Retry' : 'Download'}
            </Button>
          )}
          {state === 'downloading' && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              <X /> Cancel
            </Button>
          )}
          {state === 'verifying' && (
            <Badge variant="secondary">
              <Loader2 className="size-3 animate-spin" /> Verifying
            </Badge>
          )}
          {state === 'installed' && (
            <>
              <Badge variant="success">
                <Check className="size-3" /> Installed
              </Badge>
              {!active && (
                <Button size="sm" variant="secondary" onClick={onUse}>
                  Use Model
                </Button>
              )}
              <Button size="sm" variant="ghost" aria-label={`Delete ${model.name}`} onClick={onDelete}>
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </div>

      {(state === 'downloading' || state === 'verifying') && progress && (
        <div className="flex flex-col gap-1">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.percentage} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress.percentage}%` }} />
          </div>
          <p className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
            </span>
            <span>{state === 'verifying' ? 'Checking integrity…' : `${progress.percentage}%`}</span>
          </p>
        </div>
      )}

      {state === 'error' && progress?.error && <p className="text-xs text-destructive">{toUserMessage(progress.error)}</p>}
    </div>
  );
}
