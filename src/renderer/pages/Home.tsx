import { PageHeader } from '../components/layout/AppShell';
import { ErrorBanner } from '../components/recording/ErrorBanner';
import { MicrophoneStatus } from '../components/recording/MicrophoneStatus';
import { RecordButton } from '../components/recording/RecordButton';
import { StatusBar } from '../components/recording/StatusBar';
import { TranscriptCard } from '../components/transcript/TranscriptCard';
import { Card } from '../components/ui/card';
import { useAppStore } from '../store/appStore';

export function Home() {
  const currentTranscript = useAppStore((state) => state.currentTranscript);

  return (
    <>
      <PageHeader title="Voxcribe" description="Private, on-device dictation." actions={<MicrophoneStatus />} />
      <ErrorBanner />
      <Card>
        <RecordButton />
      </Card>
      <TranscriptCard transcript={currentTranscript} />
      <StatusBar />
    </>
  );
}
