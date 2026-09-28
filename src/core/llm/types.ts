export type TextModelProvider = 'ollama' | 'lm-studio' | 'llama.cpp';

export interface TextGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stop?: string[];
  signal?: AbortSignal;
}

export interface TextModelConfig {
  provider: TextModelProvider;
  /** Model name as the provider knows it, e.g. "llama3.2:3b". */
  model: string;
  /** Local endpoint, e.g. http://127.0.0.1:11434 for Ollama. Must stay on localhost. */
  baseUrl?: string;
}
