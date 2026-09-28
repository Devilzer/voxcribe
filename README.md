# Voxcribe

Privacy-first local voice-to-text desktop application.

Speak, and Voxcribe turns your voice into text **on your device**. No cloud transcription, no Python sidecar, no backend server: the Electron main process is the backend.

## Stack

- **Electron**: desktop shell. The main process is the app backend.
- **React + TypeScript + Vite** (via [electron-vite](https://electron-vite.org)): UI.
- **Tailwind CSS v4**, shadcn/ui-style components and Lucide icons.
- **Zustand**: renderer state, driven by an explicit state machine.
- **whisper.cpp**: the first local ASR runtime (integration not started yet).
- **Vitest** for tests, **ESLint** for linting, **electron-builder** for packaging.

## Development

```bash
npm install
npm run dev
```

Optional: `cp .env.example .env` and set `MAIN_VITE_ASR_ENGINE=mock`. The UI then gets canned transcripts until whisper.cpp is integrated. Without this setting, the real `WhisperCppEngine` is used. It reports "Whisper Small isn't installed yet…" because no model has been downloaded.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts Vite and Electron with hot reload |
| `npm run build` | Runs the typecheck, then writes a production build to `out/` |
| `npm run typecheck` | Runs strict `tsc` on the node side (main/preload/core) and the web side (renderer) |
| `npm run lint` | Runs ESLint |
| `npm run test` | Runs the Vitest suite |
| `npm run package` | Builds, then creates installers in `dist/` with electron-builder |
| `npm run package:dir` | Builds, then creates an unpacked app in `dist/` (fast smoke test) |

> **Troubleshooting:** if Electron starts as plain Node (`Cannot read properties of undefined (reading 'isPackaged')`), your shell has `ELECTRON_RUN_AS_NODE=1` set. Some editor-integrated tools set it. Run `unset ELECTRON_RUN_AS_NODE` and try again.

## Architecture

```
┌──────────────────────── Renderer (sandboxed, no Node) ─────────────────────────┐
│  React pages ── Zustand store (state machine) ── services/api.ts (unwrap)      │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │ window.voxcribe  (contextBridge, typed)
┌───────────────────────────────▼──── Preload ───────────────────────────────────┐
│  Fixed list of typed methods over IPC_CHANNELS. ipcRenderer is never exposed.  │
└───────────────────────────────┬────────────────────────────────────────────────┘
                                │ ipcRenderer.invoke → IpcResult<T> envelope
┌───────────────────────────────▼──── Main process ──────────────────────────────┐
│  ipc/  sender check → argument validation → handler → typed error payload      │
│  tray/  shortcuts/  windows/  services/container.ts (composition root)         │
│                                                                                │
│  core/ (Electron-free, unit-tested)                                            │
│   DictationPipeline: AudioRecorder → VAD → ASRManager → Storage                │
│   ASRManager ── ASREngine ─┬─ WhisperCppEngine ── NativeRuntimeLocator         │
│                            ├─ ParakeetEngine (planned, NeMo-Speech.cpp)        │
│                            └─ MockASREngine (dev/tests)                        │
│   ModelRegistry (metadata) ── LocalModelManager (<userData>/models/<engine>/)  │
│   TextModel (local LLM cleanup, planned) · Logger · typed errors              │
└────────────────────────────────────────────────────────────────────────────────┘
```

Target pipeline:

```
Microphone → AudioRecorder → AudioInput → VAD → ASREngine → Transcript → [TextModel cleanup] → Clipboard / text insertion
```

### Key ideas

- **Engines are pluggable.** Code outside `core/asr/engines/` talks only to `ASRManager`. The manager uses `ModelInfo.engine` to pick the engine for a model. To add Parakeet, write one `ParakeetEngine`, register it in `services/container.ts`, and change the registry entry's `availability` to `"available"`. The UI needs no changes.
- **Models are metadata.** `core/models/ModelRegistry.ts` holds the catalog. The UI renders whatever the registry returns. Downloaded models live in `app.getPath("userData")/models/<engine>/`, never in the source tree.
- **Native binaries** are resolved from `resources/binaries/<runtime>/<platform>-<arch>/<exe>`, for example `resources/binaries/whisper.cpp/linux-x64/whisper-cli`. When packaged, electron-builder copies them to `process.resourcesPath/binaries`. Only the main process runs them.
- **State machine.** `idle → recording → processing → transcribing → [cleaning] → [inserting] → idle`. Any active state can move to `error`. The allowed transitions are in `src/shared/stateMachine.ts`, and the store rejects all others.
- **Errors.** Subsystems throw `ASRError`, `ModelError`, `AudioError`, `StorageError` or `NativeRuntimeError`, each with a code such as `WHISPER_MODEL_NOT_FOUND`. IPC returns them as data. The renderer turns them into friendly text with `toUserMessage()`.

### Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`.
- Strict CSP in `index.html`. Navigation and new windows are blocked. All permission requests are denied.
- IPC accepts only the fixed channel list. Every handler checks that the sender is the main window's main frame and validates its arguments.
- An ESLint rule stops the renderer from importing `electron`, Node built-ins or `core/`.

### Layout

```
src/
  main/       Electron main process (window, tray, shortcuts, IPC, composition root)
  preload/    contextBridge API + its types
  renderer/   React app (pages, components, store, hooks, services)
  core/       Electron-free domain: asr, audio, vad, models, runtime, llm, storage, settings, pipeline, logging
  shared/     Types, constants, IPC contract, errors, state machine (used by every process)
  styles/     Tailwind entry
resources/    icons, binaries/ (native runtimes, git-ignored), models/ (placeholder only)
scripts/      generate-icons.mjs
tests/        Vitest specs
```

## Planned Features

- [x] Project foundation
- [ ] Whisper integration
- [ ] Microphone recording
- [ ] VAD
- [ ] Streaming transcription
- [ ] Global dictation (hold-to-talk + automatic text insertion)
- [ ] Local LLM cleanup
- [ ] Parakeet support (multiple ASR engines)
- [ ] Persistent transcript history (SQLite)
- [ ] Semantic search

## License

[MIT](LICENSE)
