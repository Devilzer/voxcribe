import { PageHeader } from '../components/layout/AppShell';
import { TranscriptListItem } from '../components/transcript/TranscriptListItem';
import { api, toUiError, unwrap } from '../services/api';
import { refreshHistory } from '../services/dictation';
import { useAppStore } from '../store/appStore';

export function History() {
  const history = useAppStore((state) => state.history);

  const onDelete = async (id: string) => {
    try {
      await unwrap(api.history.delete(id));
      await refreshHistory();
    } catch (error) {
      useAppStore.getState().fail(toUiError(error));
    }
  };

  return (
    <>
      <PageHeader title="History" description="Transcripts are stored only on this device." />
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transcripts yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((transcript) => (
            <TranscriptListItem key={transcript.id} transcript={transcript} onDelete={(id) => void onDelete(id)} />
          ))}
        </div>
      )}
    </>
  );
}
