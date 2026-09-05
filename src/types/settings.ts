export type ThemePreference = 'system' | 'light' | 'dark';

export type AIProviderType =
  | 'lmstudio'
  | 'ollama'
  | 'openai'
  | 'gemini'
  | 'anthropic'
  | 'openrouter'
  | 'custom'
  | 'none';

export interface AppSettings {
  storageDir: string;
  theme: ThemePreference;
  aiEnabled: boolean; // default OFF (Section 18)
  aiProvider: AIProviderType;

  // Local AI configuration
  ollamaUrl: string;
  ollamaModel: string;
  lmstudioUrl: string;
  lmstudioModel: string;

  // Cloud AI: OpenAI
  openaiApiKey: string;
  openaiModel: string;

  // Cloud AI: Google Gemini
  geminiApiKey: string;
  geminiModel: string;

  // Cloud AI: Anthropic Claude
  anthropicApiKey: string;
  anthropicModel: string;

  // Cloud AI: OpenRouter
  openrouterApiKey: string;
  openrouterModel: string;

  // Custom OpenAI-Compatible
  customApiUrl: string;
  customApiKey: string;
  customModel: string;

  askBeforeCloudSend: boolean;
  autoProcessAI: boolean; // default false (Section 18)
  defaultTaskPriority: 'low' | 'medium' | 'high' | 'urgent';
}

export const DEFAULT_SETTINGS: AppSettings = {
  storageDir: 'Velco',
  theme: 'system',
  aiEnabled: false,
  aiProvider: 'lmstudio',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:latest',
  lmstudioUrl: 'http://localhost:1234/v1',
  lmstudioModel: 'qwen2.5-coder-7b-instruct',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-haiku-20241022',
  openrouterApiKey: '',
  openrouterModel: 'openai/gpt-4o-mini',
  customApiUrl: '',
  customApiKey: '',
  customModel: '',
  askBeforeCloudSend: true,
  autoProcessAI: false,
  defaultTaskPriority: 'medium',
};
