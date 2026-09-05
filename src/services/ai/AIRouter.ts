import { AIProvider } from './AIProvider';
import { OllamaProvider } from './OllamaProvider';
import { LMStudioProvider } from './LMStudioProvider';
import { CloudAIProvider } from './CloudAIProvider';
import { AICapability, AIModelInfo } from '../../types/ai';
import { AppSettings, AIProviderType } from '../../types/settings';

export interface ActiveAIInfo {
  provider: AIProvider;
  model: string;
  name: string;
  isLocal: boolean;
  endpoint: string;
}

export class AIRouter {
  private providers: Map<string, AIProvider> = new Map();
  private ollama: OllamaProvider;
  private lmstudio: LMStudioProvider;
  private openai: CloudAIProvider;
  private gemini: CloudAIProvider;
  private anthropic: CloudAIProvider;
  private openrouter: CloudAIProvider;
  private custom: CloudAIProvider;

  constructor(settings: AppSettings) {
    this.ollama = new OllamaProvider(settings.ollamaUrl || 'http://localhost:11434');
    this.lmstudio = new LMStudioProvider(settings.lmstudioUrl || 'http://localhost:1234/v1');

    this.openai = new CloudAIProvider(
      'openai',
      'OpenAI',
      'https://api.openai.com/v1',
      settings.openaiApiKey,
      settings.openaiModel || 'gpt-4o-mini'
    );

    this.gemini = new CloudAIProvider(
      'gemini',
      'Google Gemini',
      'https://generativelanguage.googleapis.com/v1beta/openai',
      settings.geminiApiKey,
      settings.geminiModel || 'gemini-1.5-flash'
    );

    this.anthropic = new CloudAIProvider(
      'anthropic',
      'Anthropic Claude',
      'https://api.anthropic.com/v1',
      settings.anthropicApiKey,
      settings.anthropicModel || 'claude-3-5-haiku-20241022'
    );

    this.openrouter = new CloudAIProvider(
      'openrouter',
      'OpenRouter',
      'https://openrouter.ai/api/v1',
      settings.openrouterApiKey,
      settings.openrouterModel || 'openai/gpt-4o-mini'
    );

    this.custom = new CloudAIProvider(
      'custom',
      'Custom AI',
      settings.customApiUrl || 'http://localhost:1234/v1',
      settings.customApiKey,
      settings.customModel || 'default'
    );

    this.providers.set('ollama', this.ollama);
    this.providers.set('lmstudio', this.lmstudio);
    this.providers.set('openai', this.openai);
    this.providers.set('gemini', this.gemini);
    this.providers.set('anthropic', this.anthropic);
    this.providers.set('openrouter', this.openrouter);
    this.providers.set('custom', this.custom);
  }

  updateSettings(settings: AppSettings) {
    this.ollama.setBaseUrl(settings.ollamaUrl || 'http://localhost:11434');
    this.lmstudio.setBaseUrl(settings.lmstudioUrl || 'http://localhost:1234/v1');

    this.openai.setApiKey(settings.openaiApiKey);
    this.openai.setDefaultModel(settings.openaiModel || 'gpt-4o-mini');

    this.gemini.setApiKey(settings.geminiApiKey);
    this.gemini.setDefaultModel(settings.geminiModel || 'gemini-1.5-flash');

    this.anthropic.setApiKey(settings.anthropicApiKey);
    this.anthropic.setDefaultModel(settings.anthropicModel || 'claude-3-5-haiku-20241022');

    this.openrouter.setApiKey(settings.openrouterApiKey);
    this.openrouter.setDefaultModel(settings.openrouterModel || 'openai/gpt-4o-mini');

    this.custom.setBaseUrl(settings.customApiUrl || '');
    this.custom.setApiKey(settings.customApiKey);
    this.custom.setDefaultModel(settings.customModel || '');
  }

  getActiveProvider(settings: AppSettings): AIProvider | null {
    if (!settings.aiEnabled) return null;
    return this.providers.get(settings.aiProvider) || this.providers.get('lmstudio') || null;
  }

  getActiveModel(settings: AppSettings): string {
    switch (settings.aiProvider) {
      case 'lmstudio':
        return settings.lmstudioModel || 'qwen2.5-coder-7b-instruct';
      case 'ollama':
        return settings.ollamaModel || 'qwen2.5:latest';
      case 'openai':
        return settings.openaiModel || 'gpt-4o-mini';
      case 'gemini':
        return settings.geminiModel || 'gemini-1.5-flash';
      case 'anthropic':
        return settings.anthropicModel || 'claude-3-5-haiku-20241022';
      case 'openrouter':
        return settings.openrouterModel || 'openai/gpt-4o-mini';
      case 'custom':
        return settings.customModel || 'default';
      default:
        return 'default';
    }
  }

  getActiveInfo(settings: AppSettings): ActiveAIInfo | null {
    const provider = this.getActiveProvider(settings);
    if (!provider) return null;

    let endpoint = '';
    switch (settings.aiProvider) {
      case 'lmstudio':
        endpoint = settings.lmstudioUrl || 'http://localhost:1234/v1';
        break;
      case 'ollama':
        endpoint = settings.ollamaUrl || 'http://localhost:11434';
        break;
      case 'openai':
        endpoint = 'https://api.openai.com/v1';
        break;
      case 'gemini':
        endpoint = 'https://generativelanguage.googleapis.com';
        break;
      case 'anthropic':
        endpoint = 'https://api.anthropic.com/v1';
        break;
      case 'openrouter':
        endpoint = 'https://openrouter.ai/api/v1';
        break;
      case 'custom':
        endpoint = settings.customApiUrl;
        break;
    }

    return {
      provider,
      model: this.getActiveModel(settings),
      name: provider.name,
      isLocal: provider.isLocal,
      endpoint,
    };
  }

  getPrivacyStatus(settings: AppSettings): {
    label: string;
    isLocal: boolean;
    enabled: boolean;
    color: 'green' | 'blue' | 'gray';
  } {
    if (!settings.aiEnabled) {
      return {
        label: 'AI Disabled (Offline Core)',
        isLocal: true,
        enabled: false,
        color: 'gray',
      };
    }

    const info = this.getActiveInfo(settings);
    if (!info) {
      return {
        label: 'No Provider Configured',
        isLocal: true,
        enabled: false,
        color: 'gray',
      };
    }

    if (info.isLocal) {
      return {
        label: `Local AI • ${info.name} (${info.model})`,
        isLocal: true,
        enabled: true,
        color: 'green',
      };
    }

    return {
      label: `Cloud AI • ${info.name} (${info.model})`,
      isLocal: false,
      enabled: true,
      color: 'blue',
    };
  }

  canHandleCapability(capability: AICapability, settings: AppSettings): boolean {
    const provider = this.getActiveProvider(settings);
    if (!provider) return false;
    return provider.getCapabilities().includes(capability);
  }

  async getDetailedModels(settings: AppSettings): Promise<AIModelInfo[]> {
    const provider = this.getActiveProvider(settings);
    if (!provider) return [];
    if (typeof provider.getDetailedModels === 'function') {
      return provider.getDetailedModels();
    }
    const simple = await provider.getModels();
    return simple.map((id) => ({
      id,
      name: id,
      isFree: provider.isLocal,
    }));
  }
}
