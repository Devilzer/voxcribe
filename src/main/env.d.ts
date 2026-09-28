interface ImportMetaEnv {
  readonly MAIN_VITE_ASR_ENGINE?: string;
  readonly MAIN_VITE_LOG_LEVEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
