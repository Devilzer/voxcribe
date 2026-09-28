import { Trash2 } from 'lucide-react';
import { formatDuration, wordCount } from '@shared/transcript';
import type { Transcript } from '@shared/types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { CopyButton } from './CopyButton';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function TranscriptListItem({ transcript, onDelete }: { transcript: Transcript; onDelete: (id: string) => void }) {
  return (
    <Card className="p-4">
      <p className="selectable text-sm leading-relaxed">{transcript.text}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {dateFormat.format(new Date(transcript.createdAt))} · {formatDuration((transcript.duration ?? 0) * 1000)} ·{' '}
          {wordCount(transcript)} words{transcript.modelId && ` · ${transcript.modelId}`}
        </p>
        <div className="flex gap-1">
          <CopyButton text={transcript.text} />
          <Button variant="ghost" size="sm" aria-label="Delete transcript" onClick={() => onDelete(transcript.id)}>
            <Trash2 />
          </Button>
        </div>
      </div>
    </Card>
  );
}
