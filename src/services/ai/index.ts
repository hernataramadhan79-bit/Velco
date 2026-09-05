import { invoke } from '@tauri-apps/api/core';
import { RecipeOutput, LlmProviderConfig, AIModelInfo } from '../../types/ai';

/**
 * AI service — thin IPC wrapper over Rust backend commands.
 * All LLM orchestration happens in Rust via reqwest.
 */
export const aiService = {
  /** Execute a structured recipe against staged context items. */
  executeRecipe: (
    itemIds: string[],
    recipe: string,
    customPrompt?: string,
    providerConfig?: LlmProviderConfig,
  ) =>
    invoke<RecipeOutput>('execute_context_recipe', {
      itemIds,
      recipe,
      customPrompt: customPrompt || null,
      providerConfig: providerConfig || null,
    }),

  /** Apply recipe output artifacts (tasks, tags, notes) to the database. */
  applyArtifacts: (output: RecipeOutput, targetItemId?: string) =>
    invoke<void>('apply_recipe_artifacts', {
      targetItemId: targetItemId || null,
      output,
    }),

  /** Check if an AI provider is reachable. */
  checkStatus: (baseUrl?: string, apiKey?: string) =>
    invoke<boolean>('check_ollama_status', { baseUrl, apiKey }),

  /** List available models from an AI provider (simple string IDs). */
  listModels: (baseUrl?: string, apiKey?: string) =>
    invoke<string[]>('list_ollama_models', { baseUrl, apiKey }),

  /** List models with rich capabilities, isFree status, contextLength, and description. */
  listDetailedModels: (baseUrl?: string, apiKey?: string, provider?: string) =>
    invoke<AIModelInfo[]>('list_ai_models_detailed', {
      baseUrl: baseUrl || null,
      apiKey: apiKey || null,
      provider: provider || null,
    }),

  /** Test AI provider connection. */
  testConnection: (baseUrl?: string, apiKey?: string, provider?: string, model?: string) =>
    invoke<{ success: boolean; message: string; models: string[] }>('test_ai_connection', {
      baseUrl,
      apiKey,
      provider,
      model,
    }),

  /** Generate raw AI completion. */
  generateCompletion: (prompt: string, model: string, baseUrl?: string, apiKey?: string) =>
    invoke<string>('generate_ai_completion', {
      baseUrl: baseUrl || null,
      model,
      prompt,
      apiKey: apiKey || null,
    }),
};
