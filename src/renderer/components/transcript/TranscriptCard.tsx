import type { Transcript } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CopyButton } from './CopyButton';

export function TranscriptCard({ transcript }: { transcript: Transcript | null }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Current transcript</CardTitle>
        <CopyButton text={transcript?.text ?? ''} />
      </CardHeader>
      <CardContent>
        {transcript ? (
          <p className="selectable text-sm leading-relaxed">{transcript.text}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Your transcript will appear here.</p>
        )}
      </CardContent>
    </Card>
  );
}
