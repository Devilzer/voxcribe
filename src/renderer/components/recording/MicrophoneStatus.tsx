import { Mic, MicOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useAppStore } from '../../store/appStore';

export function MicrophoneStatus() {
  const devices = useAppStore((state) => state.devices);
  const selectedMicrophone = useAppStore((state) => state.selectedMicrophone);
  const isRecording = useAppStore((state) => state.currentState === 'recording');

  const device = devices.find((candidate) =>
    selectedMicrophone === null ? candidate.isDefault : candidate.id === selectedMicrophone,
  );

  if (!device) {
    return (
      <Badge variant="destructive">
        <MicOff className="size-3" /> No microphone
      </Badge>
    );
  }
  return (
    <Badge variant={isRecording ? 'destructive' : 'success'} title={device.label}>
      <Mic className="size-3" /> {isRecording ? 'Live' : device.label}
    </Badge>
  );
}
