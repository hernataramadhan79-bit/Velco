import { AppSettings } from '../types/settings';
import { LlmProviderConfig } from '../types/ai';
import { z, ZodSchema } from 'zod';

/**
 * Parser defensif untuk respons AI yang mungkin mengandung teks non-JSON.
 * 1. Ekstrak blok JSON pertama menggunakan regex
 * 2. Bersihkan trailing comma dan karakter bermasalah
 * 3. Validasi struktur dengan Zod schema
 */
export function extractValidJson<T>(raw: string, schema: ZodSchema<T>): T {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Input tidak valid: bukan string');
  }

  // Cari blok JSON pertama: {} atau []
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  const arrayMatch = raw.match(/\[[\s\S]*\]/);

  let jsonStr: string | null = null;

  if (objectMatch && arrayMatch) {
    // Ambil yang muncul lebih awal
    jsonStr = objectMatch.index! <= arrayMatch.index! ? objectMatch[0] : arrayMatch[0];
  } else {
    jsonStr = objectMatch?.[0] ?? arrayMatch?.[0] ?? null;
  }

  if (!jsonStr) {
    throw new Error('Tidak ditemukan blok JSON valid dalam respons AI');
  }

  // Bersihkan trailing comma sebelum } atau ]
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

  // Bersihkan newline di dalam string literal (hanya yang di antara tanda kutip)
  jsonStr = jsonStr.replace(/"([^"]*?)\n([^"]*?)"/g, (_m, p1, p2) => `"${p1}\\n${p2}"`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Gagal parse JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Validasi dengan Zod
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join(', ');
    throw new Error(`Struktur JSON tidak sesuai schema: ${issues}`);
  }

  return result.data;
}

/** Zod schema untuk ExtractedTask dari AI */
export const ExtractedTaskSchema = z.object({
  title: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_date: z.string().nullable().optional(),
});

/** Zod schema untuk RecipeOutput dari AI */
export const RecipeOutputSchema = z.object({
  summary: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  extracted_tasks: z.array(ExtractedTaskSchema).default([]),
  markdown_content: z.string().nullable().optional(),
});

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
