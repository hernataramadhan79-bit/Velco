import { aiService } from './index';
import { PriorityLevel, Tag } from '../../types/item';

export interface StructuredTaskItem {
  id: string;
  title: string;
  priority: PriorityLevel;
  dueDate?: string | null;
  description?: string;
  selected: boolean;
}

export interface TagRecommendation {
  name: string;
  category: string;
  reason: string;
  isExisting: boolean;
  existingTagId?: string;
  color?: string;
  selected: boolean;
}

/**
 * Extracts JSON array substring from raw LLM output.
 */
function extractJsonArray(raw: string): any[] | null {
  const trimmed = raw.trim();

  // Strip markdown code fences if present
  let clean = trimmed;
  if (clean.includes('```')) {
    clean = clean.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  }

  // Find first '[' and last ']'
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
    const arrayStr = clean.slice(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(arrayStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // JSON parse failed, will attempt fallback
    }
  }

  return null;
}

/**
 * Fallback parser for extracting task bullets when LLM returns markdown list instead of strict JSON.
 */
function fallbackParseTasks(raw: string): StructuredTaskItem[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const tasks: StructuredTaskItem[] = [];

  for (const line of lines) {
    // Match bullet points like "- [ ] Task", "1. Task", "* Task", "- Task"
    const match = line.match(/^(?:[-*•]|\d+\.|\- \[[ x]\])\s+(.+)$/i);
    if (match && match[1]) {
      const text = match[1].trim();
      if (text.length > 3 && text.length < 150) {
        let priority: PriorityLevel = 'medium';
        if (/urgent|segera|asap|critical/i.test(text)) priority = 'urgent';
        else if (/high|penting|priority/i.test(text)) priority = 'high';
        else if (/low|santai|minor/i.test(text)) priority = 'low';

        tasks.push({
          id: crypto.randomUUID(),
          title: text.replace(/^\[[ x]\]\s*/i, '').trim(),
          priority,
          dueDate: null,
          description: undefined,
          selected: true,
        });
      }
    }
  }

  return tasks;
}

/**
 * Extracts structured, discrete tasks from any text content (notes, documents, or AI chat responses).
 */
export async function extractStructuredTasks(
  content: string,
  model: string,
  baseUrl?: string,
  apiKey?: string
): Promise<StructuredTaskItem[]> {
  const prompt = `You are an expert task extraction and project planning engine.
Carefully read the following content and extract discrete, concrete, actionable tasks from it.
Break complex ideas down into distinct individual steps.

For each task:
- "title": A clear, concise, action-oriented task title (e.g. "Draft architecture diagram", "Update database adapter").
- "priority": one of "urgent", "high", "medium", "low".
- "dueDate": an ISO 8601 date string (YYYY-MM-DD) if a specific deadline, day, or timeframe is mentioned, otherwise null.
- "description": A short 1-sentence note detailing what needs to be done, or null.

Return ONLY a valid JSON array of objects. Do not include introductory text or markdown formatting.
Example format:
[
  { "title": "Review security audit results", "priority": "high", "dueDate": null, "description": "Address any open CSP or API key findings." },
  { "title": "Configure automated backups", "priority": "medium", "dueDate": null, "description": null }
]

Content to analyze:
${content}`;

  const raw = await aiService.generateCompletion(prompt, model, baseUrl, apiKey);
  const parsedArray = extractJsonArray(raw);

  if (parsedArray && parsedArray.length > 0) {
    return parsedArray
      .filter((item) => item && typeof item.title === 'string' && item.title.trim().length > 0)
      .map((item) => {
        let priority: PriorityLevel = 'medium';
        const p = String(item.priority || '').toLowerCase();
        if (p === 'urgent' || p === 'high' || p === 'low' || p === 'medium') {
          priority = p;
        }

        let dueDate: string | null = null;
        if (typeof item.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.dueDate)) {
          dueDate = item.dueDate.slice(0, 10);
        }

        return {
          id: crypto.randomUUID(),
          title: String(item.title).trim(),
          priority,
          dueDate,
          description: item.description ? String(item.description).trim() : undefined,
          selected: true,
        };
      });
  }

  // Graceful fallback if JSON parsing failed
  const fallback = fallbackParseTasks(raw);
  if (fallback.length > 0) return fallback;

  // If even fallback didn't find bullets, create a single task from summary
  return [
    {
      id: crypto.randomUUID(),
      title: raw.split('\n')[0].replace(/^[#*-]\s*/, '').slice(0, 80) || 'Action item from context',
      priority: 'medium',
      dueDate: null,
      description: raw.slice(0, 200),
      selected: true,
    },
  ];
}

/**
 * Recommends organized, categorized tags with rationale and checks against existing user tags.
 */
export async function recommendCategorizedTags(
  content: string,
  existingTags: Tag[],
  model: string,
  baseUrl?: string,
  apiKey?: string
): Promise<TagRecommendation[]> {
  const existingTagNames = existingTags.map((t) => t.name);

  const prompt = `You are a taxonomy and knowledge organization specialist.
Analyze the following content and recommend 3 to 6 highly relevant, specific tags for organizing this item.
Existing user tags in their library: [${existingTagNames.join(', ')}]

For each recommended tag, provide:
- "name": Concise tag name (1-3 words, no '#' symbol). If an existing tag fits well, prioritize reusing it.
- "category": General category (e.g. "Project", "Topic", "Status", "Reference", "Action").
- "reason": A short 3-6 word explanation of why this tag fits.

Return ONLY a valid JSON array of objects.
Example:
[
  { "name": "Frontend", "category": "Topic", "reason": "Focuses on UI components and layouts" },
  { "name": "Security", "category": "Topic", "reason": "Mentions CSP and credentials" }
]

Content to analyze:
${content}`;

  const raw = await aiService.generateCompletion(prompt, model, baseUrl, apiKey);
  const parsedArray = extractJsonArray(raw);

  const existingMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));

  if (parsedArray && parsedArray.length > 0) {
    return parsedArray
      .filter((item) => item && typeof item.name === 'string' && item.name.trim().length > 0)
      .map((item, index) => {
        const cleanName = String(item.name).trim().replace(/^#/, '');
        const existing = existingMap.get(cleanName.toLowerCase());

        return {
          name: existing ? existing.name : cleanName,
          category: String(item.category || 'Topic').trim(),
          reason: String(item.reason || 'Relevant to note context').trim(),
          isExisting: Boolean(existing),
          existingTagId: existing?.id,
          color: existing?.color,
          // Select the first 3 by default, let user customize
          selected: index < 3,
        };
      });
  }

  // Fallback if JSON format failed: split commas
  const fallbackNames = raw
    .split(/[,;\n]/)
    .map((s) => s.trim().replace(/^[-*#\d.]\s*/, ''))
    .filter((s) => s.length > 1 && s.length < 30)
    .slice(0, 5);

  return fallbackNames.map((name, index) => {
    const existing = existingMap.get(name.toLowerCase());
    return {
      name: existing ? existing.name : name,
      category: 'General',
      reason: 'Extracted from content keywords',
      isExisting: Boolean(existing),
      existingTagId: existing?.id,
      color: existing?.color,
      selected: index < 3,
    };
  });
}
