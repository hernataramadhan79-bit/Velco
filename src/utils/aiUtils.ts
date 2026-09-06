import { AppSettings } from '../types/settings';
import { LlmProviderConfig } from '../types/ai';

/**
 * Derives the active LlmProviderConfig from AppSettings.
 * Matches Rust LlmProviderConfig contract.
 */
export function getLlmProviderConfig(settings: AppSettings): LlmProviderConfig {
  const isLocal = ['ollama', 'lmstudio'].includes(settings.aiProvider);

  if (isLocal) {
    if (settings.aiProvider === 'ollama') {
      return {
        type: 'Ollama',
        config: {
          base_url: settings.ollamaUrl || 'http://localhost:11434',
          model: settings.ollamaModel || 'qwen2.5:latest',
        },
      };
    } else {
      // LM Studio uses OpenAiCompatible endpoint
      const baseUrl = settings.lmstudioUrl || 'http://localhost:1234/v1';
      return {
        type: 'OpenAiCompatible',
        config: {
          base_url: baseUrl,
          api_key: '',
          model: settings.lmstudioModel || 'qwen2.5-coder-7b-instruct',
        },
      };
    }
  }

  // Cloud / OpenAI-compatible
  let baseUrl = 'https://openrouter.ai/api/v1';
  let apiKey = settings.openrouterApiKey || '';
  let model = settings.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free';

  if (settings.aiProvider === 'openai') {
    baseUrl = 'https://api.openai.com/v1';
    apiKey = settings.openaiApiKey || '';
    model = settings.openaiModel || 'gpt-4o-mini';
  } else if (settings.aiProvider === 'gemini') {
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
    apiKey = settings.geminiApiKey || '';
    model = settings.geminiModel || 'gemini-1.5-flash';
  } else if (settings.aiProvider === 'anthropic') {
    baseUrl = 'https://api.anthropic.com/v1';
    apiKey = settings.anthropicApiKey || '';
    model = settings.anthropicModel || 'claude-3-5-haiku-20241022';
  } else if (settings.aiProvider === 'custom') {
    baseUrl = settings.customApiUrl || '';
    apiKey = settings.customApiKey || '';
    model = settings.customModel || 'default';
  }

  return {
    type: 'OpenAiCompatible',
    config: {
      base_url: baseUrl,
      api_key: apiKey,
      model,
    },
  };
}

/**
 * Returns human-readable display details for the active AI Provider and Model.
 */
export function getProviderDisplayName(settings: AppSettings): {
  providerName: string;
  modelName: string;
  isLocal: boolean;
  hasKey: boolean;
} {
  const isLocal = ['ollama', 'lmstudio'].includes(settings.aiProvider);

  if (isLocal) {
    if (settings.aiProvider === 'ollama') {
      return {
        providerName: 'Ollama',
        modelName: settings.ollamaModel || 'qwen2.5:latest',
        isLocal: true,
        hasKey: true,
      };
    }
    return {
      providerName: 'LM Studio',
      modelName: settings.lmstudioModel || 'qwen2.5-coder-7b-instruct',
      isLocal: true,
      hasKey: true,
    };
  }

  let providerName = 'OpenRouter';
  let modelName = settings.openrouterModel || 'meta-llama/llama-3.3-70b-instruct:free';
  let hasKey = Boolean(settings.openrouterApiKey);

  if (settings.aiProvider === 'openai') {
    providerName = 'OpenAI';
    modelName = settings.openaiModel || 'gpt-4o-mini';
    hasKey = Boolean(settings.openaiApiKey);
  } else if (settings.aiProvider === 'gemini') {
    providerName = 'Google Gemini';
    modelName = settings.geminiModel || 'gemini-1.5-flash';
    hasKey = Boolean(settings.geminiApiKey);
  } else if (settings.aiProvider === 'anthropic') {
    providerName = 'Anthropic Claude';
    modelName = settings.anthropicModel || 'claude-3-5-haiku-20241022';
    hasKey = Boolean(settings.anthropicApiKey);
  } else if (settings.aiProvider === 'custom') {
    providerName = 'Custom Endpoint';
    modelName = settings.customModel || 'custom-model';
    hasKey = Boolean(settings.customApiUrl);
  }

  return {
    providerName,
    modelName,
    isLocal: false,
    hasKey,
  };
}
