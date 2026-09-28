import { useState } from 'react';
import { SUPPORTED_LANGUAGES } from '@shared/constants';
import type { AppSettings } from '@shared/types';
import { PageHeader } from '../components/layout/AppShell';
import { ModelList } from '../components/settings/ModelList';
import { SettingsSection } from '../components/settings/SettingsSection';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { updateSettings } from '../services/settings';
import { useAppStore } from '../store/appStore';
import type { UiError } from '../types';

export function Settings() {
  const settings = useAppStore((state) => state.settings);
  const models = useAppStore((state) => state.models);
  const devices = useAppStore((state) => state.devices);
  const [error, setError] = useState<UiError | null>(null);

  if (!settings) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  const save = async (patch: Partial<AppSettings>) => setError(await updateSettings(patch));

  return (
    <>
      <PageHeader title="Settings" />
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </p>
      )}

      <SettingsSection title="Transcription Model" description="Models run locally. Downloads are coming soon.">
        <ModelList
          models={models}
          selectedModelId={settings.selectedModelId}
          onSelect={(selectedModelId) => void save({ selectedModelId })}
        />
      </SettingsSection>

      <SettingsSection title="Microphone">
        <Select
          value={settings.microphoneId ?? ''}
          onChange={(event) => void save({ microphoneId: event.target.value === '' ? null : event.target.value })}
        >
          <option value="">System default</option>
          {devices
            .filter((device) => !device.isDefault)
            .map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
        </Select>
      </SettingsSection>

      <SettingsSection title="Language">
        <Select value={settings.language} onChange={(event) => void save({ language: event.target.value })}>
          {SUPPORTED_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </Select>
      </SettingsSection>

      <SettingsSection title="Global Shortcut" description="Electron accelerator, e.g. CommandOrControl+Shift+Space.">
        {/* Keyed so the draft resets whenever the saved shortcut changes. */}
        <ShortcutForm key={settings.shortcut} shortcut={settings.shortcut} onSave={(shortcut) => void save({ shortcut })} />
      </SettingsSection>

      <SettingsSection title="Post-processing" description="Clean up transcripts with a local LLM (Ollama, LM Studio, llama.cpp).">
        <label className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            Enable local LLM cleanup <Badge variant="outline">Coming soon</Badge>
          </span>
          <input type="checkbox" disabled checked={settings.postProcessing.enabled} readOnly />
        </label>
      </SettingsSection>

      <SettingsSection title="Storage" description="History is kept in memory for now; SQLite persistence is planned.">
        <label className="flex items-center justify-between text-sm">
          Save transcript history
          <input
            type="checkbox"
            checked={settings.storage.saveHistory}
            onChange={(event) => void save({ storage: { saveHistory: event.target.checked } })}
          />
        </label>
      </SettingsSection>
    </>
  );
}

function ShortcutForm({ shortcut, onSave }: { shortcut: string; onSave: (shortcut: string) => void }) {
  const [draft, setDraft] = useState(shortcut);
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft.trim());
      }}
    >
      <Input value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} />
      <Button type="submit" variant="secondary" disabled={draft.trim() === shortcut}>
        Save
      </Button>
    </form>
  );
}
