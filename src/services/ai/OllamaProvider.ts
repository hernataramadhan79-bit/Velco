import { AIProvider } from './AIProvider';
import { AICapability, AIClassificationResult, AIChatMessage, AIModelInfo } from '../../types/ai';
import { invoke } from '@tauri-apps/api/core';

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  readonly isLocal = true;

  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  getCapabilities(): AICapability[] {
    return ['text_generation', 'summarization', 'classification', 'tag_suggestion'];
  }

  async isAvailable(): Promise<boolean> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<boolean>('check_ollama_status', { baseUrl: this.baseUrl });
      } catch {
        // Fallback to fetch
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 600);
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getDetailedModels(): Promise<AIModelInfo[]> {
    if (isTauriEnvironment()) {
      try {
        const rawList = await invoke<any[]>('list_ai_models_detailed', {
          baseUrl: this.baseUrl,
          provider: this.id,
        });
        if (rawList && rawList.length > 0) {
          return rawList.map((m) => ({
            id: m.id,
            name: m.name || m.id,
            isFree: true,
            contextLength: m.context_length,
            description: m.description,
          }));
        }
      } catch {
        // fall back
      }
    }

    const simple = await this.getModels();
    return simple.map((id) => ({
      id,
      name: id,
      isFree: true,
      description: 'Local Ollama model',
    }));
  }

  async getModels(): Promise<string[]> {
    if (isTauriEnvironment()) {
      try {
        const models = await invoke<string[]>('list_ollama_models', { baseUrl: this.baseUrl });
        if (models && models.length > 0) {
          return models;
        }
      } catch {
        // Fallback to fetch
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => m.name);
    } catch {
      return [];
    }
  }

  private async generate(prompt: string, model: string = 'qwen2.5:latest'): Promise<string> {
    if (isTauriEnvironment()) {
      try {
        return await invoke<string>('generate_ai_completion', {
          baseUrl: this.baseUrl,
          model,
          prompt,
        });
      } catch (err: any) {
        throw new Error(
          `AI request failed: ${err || 'Make sure Ollama is running at ' + this.baseUrl}`
        );
      }
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama returned HTTP ${res.status}`);
      }

      const data = await res.json();
      return data.response || '';
    } catch (err: any) {
      throw new Error(
        `Ollama connection failed: ${err.message || 'Make sure Ollama is running at ' + this.baseUrl}`
      );
    }
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
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
          suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : ['inbox'],
        };
      }
    } catch {
      // Fallback
    }

    return {
      category: 'General',
      confidence: 0.7,
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
