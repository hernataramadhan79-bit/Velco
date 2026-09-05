// ============================================================================
// Velco AI Type Definitions
// ============================================================================

/** Structured task extracted from AI recipe processing. */
export interface ExtractedTaskPayload {
  title: string;
  priority: 'low' | 'medium' | 'high';
  due_date?: string | null;
}

/** Structured output contract for all AI recipe operations. */
export interface RecipeOutput {
  summary: string | null;
  tags: string[];
  extracted_tasks: ExtractedTaskPayload[];
  markdown_content: string | null;
}

/** LLM provider configuration — matches Rust LlmProviderConfig enum. */
export type LlmProviderConfig =
  | { type: 'Ollama'; config: { base_url: string; model: string } }
  | { type: 'OpenAiCompatible'; config: { base_url: string; api_key: string; model: string } };

/** AI model info returned from provider listing. */
export interface AIModelInfo {
  id: string;
  name: string;
  isFree?: boolean;
  contextLength?: number;
  description?: string;
}

/** Recipe types available in the Context Foundry. */
export type RecipeType = 'synthesize' | 'extract_tasks' | 'triage' | 'custom';
