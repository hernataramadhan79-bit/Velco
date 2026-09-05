import { AIProvider } from './AIProvider';
import { AICapability, AIClassificationResult, AIChatMessage, AIModelInfo } from '../../types/ai';
import { invoke } from '@tauri-apps/api/core';

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export interface ConnectionTestResponse {
  success: boolean;
  message: string;
  models: string[];
}

export class CloudAIProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly isLocal: boolean = false;

  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor(
    id: string,
    name: string,
    baseUrl: string,
    apiKey: string = '',
    defaultModel: string = 'gpt-4o-mini'
  ) {
    this.id = id;
    this.name = name;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey.trim();
    this.defaultModel = defaultModel.trim();
  }

  setApiKey(key: string) {
    this.apiKey = key.trim();
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  setDefaultModel(model: string) {
    this.defaultModel = model.trim();
  }

  getCapabilities(): AICapability[] {
    return ['text_generation', 'summarization', 'classification', 'tag_suggestion'];
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey && this.id !== 'custom') {
      return false;
    }

    if (isTauriEnvironment()) {
      try {
        const res = await invoke<ConnectionTestResponse>('test_ai_connection', {
          baseUrl: this.baseUrl || null,
          apiKey: this.apiKey || null,
          provider: this.id,
          model: this.defaultModel || null,
        });
        return res.success;
      } catch {
        return false;
      }
    }

    return Boolean(this.apiKey);
  }

  async testConnection(): Promise<ConnectionTestResponse> {
    if (!this.apiKey && this.id !== 'custom') {
      return {
        success: false,
        message: 'API Key is required. Please paste your key above.',
        models: [],
      };
    }

    if (isTauriEnvironment()) {
      try {
        return await invoke<ConnectionTestResponse>('test_ai_connection', {
          baseUrl: this.baseUrl || null,
          apiKey: this.apiKey || null,
          provider: this.id,
          model: this.defaultModel || null,
        });
      } catch (err: any) {
        return {
          success: false,
          message: err?.toString() || 'Connection failed.',
          models: [],
        };
      }
    }

    return {
      success: true,
      message: 'Browser environment: API key stored locally.',
      models: [this.defaultModel],
    };
  }

  async getModels(): Promise<string[]> {
    if (!this.apiKey && this.id !== 'custom') {
      return [];
    }

    if (isTauriEnvironment()) {
      try {
        const models = await invoke<string[]>('list_ollama_models', {
          baseUrl: this.baseUrl || null,
          apiKey: this.apiKey || null,
        });
        if (models && models.length > 0) {
          return models;
        }
      } catch {
        // fall through
      }
    }

    return [];
  }

  async getDetailedModels(): Promise<AIModelInfo[]> {
    if (isTauriEnvironment()) {
      try {
        const rawList = await invoke<any[]>('list_ai_models_detailed', {
          baseUrl: this.baseUrl || null,
          apiKey: this.apiKey || null,
          provider: this.id,
        });
        if (rawList && rawList.length > 0) {
          return rawList.map((m) => ({
            id: m.id,
            name: m.name || m.id,
            isFree: Boolean(m.is_free),
            contextLength: m.context_length,
            description: m.description,
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch detailed models via Tauri IPC:', err);
      }
    }

    // Direct Web fallback for OpenRouter (public CORS)
    if (this.id === 'openrouter' || this.baseUrl.includes('openrouter.ai')) {
      try {
        const headers: Record<string, string> = {
          'HTTP-Referer': 'https://lifeinbox.app',
          'X-Title': 'Life Inbox',
        };
        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            const models: AIModelInfo[] = json.data.map((m: any) => {
              const id = m.id || '';
              const isFreeById = id.endsWith(':free');
              const isFreeByPricing =
                m.pricing &&
                (m.pricing.prompt === '0' || m.pricing.prompt === 0) &&
                (m.pricing.completion === '0' || m.pricing.completion === 0);
              return {
                id,
                name: m.name || id,
                isFree: Boolean(isFreeById || isFreeByPricing),
                contextLength: m.context_length,
                description: m.description,
              };
            });

            // Sort: free models first, then alphabetical
            models.sort((a, b) => {
              if (a.isFree && !b.isFree) return -1;
              if (!a.isFree && b.isFree) return 1;
              return a.name.localeCompare(b.name);
            });

            return models;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch OpenRouter models via web:', err);
      }
    }

    return [];
  }

  private async generate(prompt: string, model?: string): Promise<string> {
    const targetModel = model || this.defaultModel;

    if (isTauriEnvironment()) {
      try {
        return await invoke<string>('generate_ai_completion', {
          baseUrl: this.baseUrl || null,
          model: targetModel,
          prompt,
          apiKey: this.apiKey || null,
        });
      } catch (err: any) {
        throw new Error(err || `AI request failed with ${this.name}`);
      }
    }

    // Web fallback for testing
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const endpoint = this.baseUrl.endsWith('/v1')
      ? `${this.baseUrl}/chat/completions`
      : `${this.baseUrl}/v1/chat/completions`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      throw new Error(`${this.name} error (HTTP ${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content) return content;
    throw new Error('No content returned by AI provider');
  }

  async summarize(text: string, model?: string): Promise<string> {
    const prompt = `Summarize the following text clearly and concisely in 2-3 sentences. Do not add conversational filler. Text:\n\n${text}`;
    return this.generate(prompt, model);
  }

  async classify(text: string, model?: string): Promise<AIClassificationResult> {
    const prompt = `Analyze this text and output a JSON object with:
"category" (one of: Project, Personal, Work, Finance, Idea, Reference, Task, General),
"confidence" (number 0 to 1),
"suggestedTags" (array of 2 to 4 single-word tags).
Output ONLY the raw JSON object, no explanation.
Text:
${text}`;

    try {
      const raw = await this.generate(prompt, model);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          category: parsed.category || 'General',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
          suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : ['inbox'],
        };
      }
    } catch {
      // Fallback
    }

    return {
      category: 'General',
      confidence: 0.75,
      suggestedTags: ['note', 'inbox'],
    };
  }

  async suggestTags(text: string, existingTags: string[] = [], model?: string): Promise<string[]> {
    const prompt = `Given this content, suggest 3 to 5 relevant concise tags (single words or kebab-case).
Existing tags in system: ${existingTags.join(', ')}.
Output ONLY a comma-separated list of tags.
Content:
${text}`;

    const raw = await this.generate(prompt, model);
    return raw
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''))
      .filter((t) => t.length > 1 && t.length < 25);
  }

  async askContext(
    contextText: string,
    history: AIChatMessage[],
    userQuestion: string,
    model?: string
  ): Promise<string> {
    const historyText = history
      .slice(-4)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `You are Life Inbox context assistant. Answer the user's question strictly using the provided item context below. Be direct, accurate, and concise.

CONTEXT:
${contextText}

${historyText ? `PREVIOUS CONVERSATION:\n${historyText}\n` : ''}
User: ${userQuestion}
Assistant:`;

    return this.generate(prompt, model);
  }
}
