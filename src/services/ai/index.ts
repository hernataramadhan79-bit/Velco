import { invoke } from '@tauri-apps/api/core';
import { RecipeOutput, LlmProviderConfig, AIModelInfo } from '../../types/ai';
import { getSettings } from '../../stores/settingsStore';

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
  ) => {
    if (!getSettings().aiEnabled) {
      return Promise.reject(new Error('AI features are disabled in Settings.'));
    }
    return invoke<RecipeOutput>('execute_context_recipe', {
      itemIds,
      recipe,
      customPrompt: customPrompt || null,
      providerConfig: providerConfig || null,
    });
  },

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
  generateCompletion: (prompt: string, model: string, baseUrl?: string, apiKey?: string) => {
    if (!getSettings().aiEnabled) {
      return Promise.reject(new Error('AI features are disabled in Settings.'));
    }
    return invoke<string>('generate_ai_completion', {
      baseUrl: baseUrl || null,
      model,
      prompt,
      apiKey: apiKey || null,
    });
  },

  /** Execute streaming context chat against staged items. */
  executeChat: (
    requestId: string,
    messages: Array<{ role: string; content: string }>,
    itemIds: string[],
    providerConfig?: LlmProviderConfig,
  ) => {
    if (!getSettings().aiEnabled) {
      return Promise.reject(new Error('AI features are disabled in Settings.'));
    }
    return invoke<string>('execute_context_chat', {
      requestId,
      messages,
      itemIds,
      providerConfig: providerConfig || null,
    });
  },

  /** Securely store provider API secret in OS Keyring */
  setCredential: (provider: string, apiKey: string) =>
    invoke<void>('set_ai_credential', { provider, apiKey }),

  /** Retrieve provider API secret from OS Keyring */
  getCredential: (provider: string) =>
    invoke<string | null>('get_ai_credential', { provider }),

  /** Clear provider API secret from OS Keyring */
  deleteCredential: (provider: string) =>
    invoke<void>('delete_ai_credential', { provider }),
};
