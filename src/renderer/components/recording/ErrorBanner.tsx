import { AlertCircle, X } from 'lucide-react';
import { Button } from '../ui/button';
import { useAppStore } from '../../store/appStore';

export function ErrorBanner() {
  const error = useAppStore((state) => state.error);
  const dismissError = useAppStore((state) => state.dismissError);
  const setPage = useAppStore((state) => state.setPage);
  if (!error) return null;

  const pointsToSettings = /Settings/.test(error.message);

  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="flex-1">{error.message}</p>
      {pointsToSettings && (
        <Button size="sm" variant="outline" onClick={() => setPage('settings')}>
          Open Settings
        </Button>
      )}
      <Button size="icon" variant="ghost" className="size-7" aria-label="Dismiss" onClick={dismissError}>
        <X />
      </Button>
    </div>
  );
}
