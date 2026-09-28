# Voxcribe

Privacy-first local voice-to-text desktop application.

Speak, and Voxcribe turns your voice into text **on your device**. No cloud transcription, no Python sidecar, no backend server: the Electron main process is the backend.

## Stack

- **Electron**: desktop shell. The main process is the app backend.
- **React + TypeScript + Vite** (via [electron-vite](https://electron-vite.org)): UI.
- **Tailwind CSS v4**, shadcn/ui-style components and Lucide icons.
- **Zustand**: renderer state, driven by an explicit state machine.
- **whisper.cpp** (`whisper-cli`): the first local ASR runtime.
- **Vitest** for tests, **ESLint** for linting, **electron-builder** for packaging.

## Development

```bash
npm install
npm run whisper:build   # once: builds whisper-cli and copies a sample WAV (needs cmake, git, a C++ compiler)
npm run dev
```

The app starts with no model. Open **Settings → Speech Recognition** and download one (see [Model management](#model-management)).

Optional: `cp .env.example .env` and set `MAIN_VITE_ASR_ENGINE=mock`. That swaps whisper.cpp for canned transcripts, which is useful for UI work without a model. Models must still be installed for transcription to start.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts Vite and Electron with hot reload |
| `npm run build` | Runs the typecheck, then writes a production build to `out/` |
| `npm run typecheck` | Runs strict `tsc` on the node side (main/preload/core) and the web side (renderer) |
| `npm run lint` | Runs ESLint |
| `npm run test` | Runs the unit tests (no network, no model, no binary needed) |
| `npm run test:integration` | Runs the real download → verify → whisper-cli → WAV test (see below) |
| `npm run whisper:build` | Builds `whisper-cli` into `resources/binaries/whisper.cpp/linux-x64/` |
| `npm run package` | Builds, then creates installers in `dist/` with electron-builder |
| `npm run package:dir` | Builds, then creates an unpacked app in `dist/` (fast smoke test) |

> **Troubleshooting:** if Electron starts as plain Node (`Cannot read properties of undefined (reading 'isPackaged')`), your shell has `ELECTRON_RUN_AS_NODE=1` set. Some editor-integrated tools set it. Run `unset ELECTRON_RUN_AS_NODE` and try again.

### whisper.cpp binary

Voxcribe runs whisper.cpp's `whisper-cli` as a child process from the Electron main process. It never uses a shell, and it only runs the binary at this application-controlled path:

```
resources/binaries/whisper.cpp/<platform>-<arch>/whisper-cli
```

Only **Linux x64** is supported in this phase. The binary is not committed to Git. Build it with:

```bash
sudo apt install cmake build-essential git    # or your distro's equivalent
npm run whisper:build
```

[`scripts/build-whisper-cpp.sh`](scripts/build-whisper-cpp.sh) does the following:

1. Clones whisper.cpp at a pinned tag (`v1.9.4`) into `.cache/`.
2. Builds a statically linked `whisper-cli` (CPU; `GGML_NATIVE=ON` by default).
3. Installs `whisper-cli` into `resources/binaries/whisper.cpp/linux-x64/`.
4. Copies `samples/jfk.wav` to `test-audio/sample.wav`.

These environment variables change its behaviour:

- `WHISPER_CPP_VERSION`: build a different tag.
- `WHISPER_CPP_NATIVE=OFF`: portable build, for binaries you plan to distribute.
- `CMAKE=/path/to/cmake`: use a cmake that is not on `PATH`.

The binary still links the system `libgomp`, `libstdc++` and `libc`.

`npm run package` bundles everything under `resources/binaries/` into the app (`process.resourcesPath/binaries`).

## Model management

- **Models are optional downloads.** Nothing is downloaded at startup. The user picks a model in Settings and clicks **Download**.
- **Hugging Face is the distribution source.** Voxcribe fetches whisper.cpp-ready GGML files from [`ggerganov/whisper.cpp`](https://huggingface.co/ggerganov/whisper.cpp). The URLs are pinned to commit `5359861c739e955e79d9a303bcbc70fb988958b1`, so the content never changes under a fixed checksum.
- **Downloads are checked.**
  - Downloads run only in the main process and stream to `<file>.part`.
  - Every redirect hop must be HTTPS on `huggingface.co` / `*.hf.co`.
  - The size must match the registry exactly.
  - The file is then hashed with SHA-256 and compared with the checksum pinned in [`ModelRegistry.ts`](src/core/models/ModelRegistry.ts).
  - Only a match is renamed to the final file name. On a mismatch, failure or cancel, the `.part` file is deleted. Leftovers from a crash are removed at the next start.
- **Models are stored locally** in Electron's user-data folder, never in the project:

  ```
  <userData>/models/whisper/ggml-base.bin
                            ggml-small.bin
                            ggml-large-v3-turbo.bin
  ```

  On Linux this is `~/.config/Voxcribe/models/`. The path comes from `app.getPath("userData")`.
- **Models are not committed to Git.** `.gitignore` excludes `*.bin`, `*.gguf` and everything in `resources/models/`.
- **Inference is local.** After the download, nothing leaves the machine.

### Supported models

| Id | Name | File | Size (bytes) | SHA-256 |
| --- | --- | --- | --- | --- |
| `whisper-base` | Whisper Base (fast) | `ggml-base.bin` | 147,951,465 | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` |
| `whisper-small` | Whisper Small (balanced) | `ggml-small.bin` | 487,601,967 | `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` |
| `whisper-large-v3-turbo` | Whisper Large V3 Turbo (high accuracy) | `ggml-large-v3-turbo.bin` | 1,624,555,275 | `1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69` |
| `parakeet-tdt-0.6b-v3` | Parakeet TDT 0.6B v3 | — | — | planned (NeMo-Speech.cpp) |

The checksums are the Git LFS SHA-256 values of the pinned commit. To add a model, add one entry to the registry. The Settings UI lists it automatically.

### Testing the whole flow

```
Model download → Model verification → whisper.cpp → sample.wav → Transcript
```

**In the app**

1. `npm run whisper:build`, then `npm run dev`.
2. In **Settings → Speech Recognition**, click **Download** next to **Whisper Small**. The progress bar runs, then shows "Verifying", then "✓ Installed". The first installed model becomes active. Use **Use Model** to switch models.
3. On **Home → Transcribe a file**, click **Choose WAV…** and pick `test-audio/sample.wav`, then click **Transcribe**.
4. The transcript appears below: *"And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country."* It is also added to **History**.

**Headless**

```bash
npm run test:integration
```

This test downloads Whisper Small into `~/.config/Voxcribe/models` if it isn't there, verifies it, and runs `whisper-cli` on `test-audio/sample.wav`. It then checks the transcript.

Override the defaults with:

- `VOXCRIBE_MODEL`: the model id.
- `VOXCRIBE_MODELS_DIR`: the models folder.
- `VOXCRIBE_AUDIO`: the WAV file.

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
│   DictationPipeline: AudioRecorder/WAV file → VAD → ASRManager → Storage       │
│   ASRManager ── ASREngine ─┬─ WhisperCppEngine ── ProcessRunner → whisper-cli  │
│                            │    └─ WhisperCliOutputParser                      │
│                            ├─ ParakeetEngine (planned, NeMo-Speech.cpp)        │
│                            └─ MockASREngine (dev/tests)                        │
│   ModelManager ─┬─ ModelRegistry (pinned URLs + SHA-256)                       │
│                 ├─ ModelDownloader (HTTPS, host allowlist, .part files)        │
│                 └─ ModelVerifier (SHA-256) → <userData>/models/<engine>/       │
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
- **State machine.** `idle → recording → processing → transcribing → [cleaning] → [inserting] → idle`. File transcription enters at `idle → processing`. Any active state can move to `error`. The allowed transitions are in `src/shared/stateMachine.ts`, and the store rejects all others.
- **Errors.** Subsystems throw `ASRError`, `ModelError`, `AudioError`, `StorageError` or `NativeRuntimeError`, each with a code such as `MODEL_CHECKSUM_MISMATCH`. IPC returns them as data. The renderer turns them into friendly text with `toUserMessage()`.

### Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`.
- Strict CSP in `index.html`. Navigation and new windows are blocked. All permission requests are denied.
- IPC accepts only the fixed channel list. Every handler checks that the sender is the main window's main frame and validates its arguments.
- An ESLint rule stops the renderer from importing `electron`, Node built-ins or `core/`.
- The renderer can't download, read files or run binaries. Model ids are checked against the registry in main, and only registry models can be downloaded. Audio files are picked with the native dialog in main, and the renderer only receives an opaque id, never a path it could substitute.

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
scripts/      generate-icons.mjs, build-whisper-cpp.sh
test-audio/   local WAV files for testing (git-ignored)
tests/        Vitest specs (unit + opt-in integration)
```

## Planned Features

- [x] Project foundation
- [x] Model download + SHA-256 verification
- [x] Whisper integration (whisper-cli, WAV files, Linux x64)
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
