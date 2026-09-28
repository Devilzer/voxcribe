import { Check, FileAudio, Loader2 } from 'lucide-react';
import { isBusy } from '@shared/stateMachine';
import { formatDuration } from '@shared/transcript';
import { selectAudioFile, transcribeSelectedFile } from '../../services/dictation';
import { useAppStore } from '../../store/appStore';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

/** Phase 2 test path: WAV file → active model → transcript. */
export function FileTranscriptionCard() {
  const activeModel = useAppStore((state) => state.activeModel);
  const file = useAppStore((state) => state.selectedAudioFile);
  const currentState = useAppStore((state) => state.currentState);
  const busy = isBusy(currentState) || currentState === 'recording';
  const working = currentState === 'processing' || currentState === 'transcribing';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcribe a file</CardTitle>
        <CardDescription>Run the active model on a WAV file.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-[5rem_1fr] items-center gap-y-2">
          <span className="text-muted-foreground">Model</span>
          <span className="flex items-center gap-2">
            {activeModel ? (
              <>
                {activeModel.name}
                {activeModel.installed ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check className="size-3" /> Installed
                  </span>
                ) : (
                  <span className="text-xs text-destructive">Not installed</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">None selected</span>
            )}
          </span>
          <span className="text-muted-foreground">Audio</span>
          <span className="flex items-center gap-2">
            <FileAudio className="size-4 text-muted-foreground" />
            {file ? (
              <span>
                {file.name}
                {file.durationSec !== undefined && (
                  <span className="text-muted-foreground"> · {formatDuration(file.durationSec * 1000)}</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">No file chosen</span>
            )}
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void selectAudioFile()}>
              Choose WAV…
            </Button>
          </span>
        </div>
        <Button className="self-start" disabled={!file || busy} onClick={() => void transcribeSelectedFile()}>
          {working && <Loader2 className="animate-spin" />}
          {working ? 'Transcribing…' : 'Transcribe'}
        </Button>
      </CardContent>
    </Card>
  );
}
