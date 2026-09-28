import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { useAppStore } from '../../store/appStore';

export function NoModelBanner() {
  const models = useAppStore((state) => state.models);
  const setPage = useAppStore((state) => state.setPage);
  if (models.length === 0 || models.some((model) => model.installed)) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <div className="flex-1">
        <p className="font-medium">No transcription model installed.</p>
        <p className="text-muted-foreground">Download a model to start using Voxcribe.</p>
      </div>
      <Button size="sm" onClick={() => setPage('settings')}>
        <Download /> Get a model
      </Button>
    </div>
  );
}
