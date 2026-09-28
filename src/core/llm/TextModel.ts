import type { TextGenerationOptions } from './types';

/**
 * Local LLM used for optional transcript cleanup (punctuation, filler removal, formatting).
 *
 * TODO(llm): implementations for Ollama, LM Studio and llama.cpp. All must run
 * against local endpoints/binaries only; no cloud providers.
 */
export interface TextModel {
  readonly id: string;
  readonly name: string;
  generate(prompt: string, options?: TextGenerationOptions): Promise<string>;
}
