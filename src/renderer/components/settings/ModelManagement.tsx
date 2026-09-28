import { useState } from 'react';
import { cancelDownload, deleteModel, downloadModel, setActiveModel } from '../../services/models';
import { useAppStore } from '../../store/appStore';
import type { UiError } from '../../types';
import { ModelCard } from './ModelCard';

export function ModelManagement() {
  const models = useAppStore((state) => state.models);
  const downloads = useAppStore((state) => state.downloads);
  const activeModelId = useAppStore((state) => state.settings?.activeModelId ?? null);
  const [error, setError] = useState<UiError | null>(null);

  const run = async (action: () => Promise<UiError | null | void>) => setError((await action()) ?? null);
  const hasInstalled = models.some((model) => model.installed);

  return (
    <div className="flex flex-col gap-2">
      {!hasInstalled && (
        <p className="rounded-md bg-muted p-3 text-sm">
          No transcription model installed.
          <br />
          <span className="text-muted-foreground">Download a model to start using Voxcribe.</span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
      {models.map((model) => (
        <ModelCard
          key={model.id}
          model={model}
          progress={downloads[model.id]}
          active={model.id === activeModelId}
          onDownload={() => void run(() => downloadModel(model.id))}
          onCancel={() => void run(() => cancelDownload(model.id))}
          onUse={() => void run(() => setActiveModel(model.id))}
          onDelete={() => {
            if (window.confirm(`Delete ${model.name} from this device?`)) void run(() => deleteModel(model.id));
          }}
        />
      ))}
    </div>
  );
}
