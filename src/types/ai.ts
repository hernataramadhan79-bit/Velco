export type AICapability =
  | 'text_generation'
  | 'summarization'
  | 'classification'
  | 'tag_suggestion'
  | 'vision'
  | 'embeddings'
  | 'ocr'
  | 'speech_to_text';

export type AIProviderType = 'ollama' | 'lmstudio' | 'openai_compatible' | 'none';

export interface AIModelInfo {
  id: string;
  name: string;
  capabilities?: AICapability[];
  isLocal?: boolean;
  isFree?: boolean;
  contextLength?: number;
  description?: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isLocal?: boolean;
}

export interface AISummarizeOptions {
  maxLength?: number;
  format?: 'bullet_points' | 'concise' | 'executive';
}

export interface AIClassificationResult {
  category: string;
  confidence: number;
  suggestedTags: string[];
}
