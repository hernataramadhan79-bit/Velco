import { aiService } from './index';
import { PriorityLevel, Tag } from '../../types/item';
import { getSettings } from '../../stores/settingsStore';

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
 * Strips reasoning scratchpads (<think>...</think>, <thought>...</thought>) and markdown code fences.
 */
export function stripReasoningAndFences(raw: string): string {
  if (!raw) return '';

  let clean = raw;

  // 1. Strip case-insensitive <think>...</think> and <thought>...</thought> blocks
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
  clean = clean.replace(/<thought>[\s\S]*?<\/thought>/gi, '');

  // If unclosed <think> tag exists (streaming/cutoff), strip from <think> to end
  const unclosedThink = clean.search(/<think>/i);
  if (unclosedThink !== -1) {
    clean = clean.slice(0, unclosedThink);
  }

  // 2. Strip markdown code block wrappers (```json ... ``` or ``` ... ```)
  clean = clean.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1');

  return clean.trim();
}

/**
 * Strips markdown asterisks, backticks, list bullets, and leading numbers from titles.
 */
export function sanitizeTitle(rawTitle: string): string {
  if (!rawTitle) return '';

  let title = rawTitle.trim();

  // Strip checkbox markdown: [ ] or [x]
  title = title.replace(/^\[[ xX]\]\s*/, '');

  // Strip leading list symbols and numbers: e.g. "1. ", "* ", "- ", "• "
  title = title.replace(/^(?:\d+[\.\)]|[-*•])\s+/, '');

  // Strip bold/italic markdown formatting: **title**, *title*, __title__, `title`
  title = title.replace(/\*\*(.*?)\*\*/g, '$1');
  title = title.replace(/\*(.*?)\*/g, '$1');
  title = title.replace(/__(.*?)__/g, '$1');
  title = title.replace(/_(.*?)_/g, '$1');
  title = title.replace(/`+(.*?)`+/g, '$1');

  // Strip trailing colons, dashes, or semicolons
  title = title.replace(/[:\-;]+\s*$/, '');

  // Remove excessive whitespace
  title = title.replace(/\s+/g, ' ').trim();

  // Truncate if overly long (preserve human readability)
  if (title.length > 120) {
    title = title.slice(0, 117).trim() + '...';
  }

  return title;
}

/**
 * Detects priority level from text using Indonesian and English keywords.
 */
export function detectPriority(text: string): PriorityLevel {
  const lower = text.toLowerCase();

  // Urgent: highest precedence
  if (
    /urgent|segera|darurat|kritis|critical|asap|p0|hari ini|today\b|secepatnya/i.test(
      lower
    )
  ) {
    return 'urgent';
  }

  // High: important / high priority
  if (
    /high|penting|utama|prioritas tinggi|priority|p1|wajib|must|crucial/i.test(
      lower
    )
  ) {
    return 'high';
  }

  // Low: nice to have / relaxed / minor
  if (
    /low|santai|rendah|minor|optional|opsional|nanti|later|p3|trivial/i.test(
      lower
    )
  ) {
    return 'low';
  }

  return 'medium';
}

/**
 * Extracts ISO date (YYYY-MM-DD) from text or relative expressions.
 */
export function detectDueDate(text: string): string | null {
  // 1. ISO 8601 format: YYYY-MM-DD
  const isoMatch = text.match(/\b(202\d-[01]\d-[0-3]\d)\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // 2. Common Indonesian/European date format: DD/MM/YYYY or DD-MM-YYYY
  const dmMatch = text.match(/\b([0-3]\d)[/-]([01]\d)[/-](202\d)\b/);
  if (dmMatch) {
    const [, day, month, year] = dmMatch;
    return `${year}-${month}-${day}`;
  }

  // 3. Relative date keywords
  const lower = text.toLowerCase();
  const now = new Date();

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (/\b(?:besok|tomorrow)\b/i.test(lower)) {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return formatDate(d);
  }

  if (/\b(?:lusa)\b/i.test(lower)) {
    const d = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return formatDate(d);
  }

  if (/\b(?:minggu depan|next week)\b/i.test(lower)) {
    const d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return formatDate(d);
  }

  return null;
}

/**
 * Multi-strategy JSON array extractor from raw LLM output.
 * Handles markdown fences, reasoning tags, object wrappers, and repair of common syntax defects.
 */
export function extractJsonArray<T = any>(raw: string): T[] | null {
  const clean = stripReasoningAndFences(raw);
  if (!clean) return null;

  // Strategy A: Direct parse
  try {
    const direct = JSON.parse(clean);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === 'object') {
      const arrayProp = Object.values(direct).find((v) => Array.isArray(v));
      if (Array.isArray(arrayProp)) return arrayProp as T[];
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy B: Array brackets extraction [...]
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
    let arrayStr = clean.slice(firstBracket, lastBracket + 1);

    // Repair common trailing commas: `[..., ]` or `{..., }`
    arrayStr = arrayStr.replace(/,\s*([\]}])/g, '$1');

    try {
      const parsed = JSON.parse(arrayStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy C: Object wrapper { "tasks": [ ... ] }
  const wrapperMatch = clean.match(
    /\{[\s\S]*?"(?:tasks|extracted_tasks|items|todo|tags|recommendations)"\s*:\s*(\[[\s\S]*?\])[\s\S]*?\}/i
  );
  if (wrapperMatch && wrapperMatch[1]) {
    try {
      const cleanedSub = wrapperMatch[1].replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(cleanedSub);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy D: Object-by-object regex recovery for truncated/streaming outputs
  const objectRegex = /\{[^{}]*?"(?:title|name)"[^{}]*?\}/g;
  const recovered: any[] = [];
  let m: RegExpExecArray | null;
  while ((m = objectRegex.exec(clean)) !== null) {
    try {
      const repaired = m[0].replace(/,\s*([\]}])/g, '$1');
      const obj = JSON.parse(repaired);
      if (obj && (obj.title || obj.name)) {
        recovered.push(obj);
      }
    } catch {
      // Skip defective single object
    }
  }

  if (recovered.length > 0) {
    return recovered;
  }

  return null;
}

/**
 * Intelligent bullet/list parser that cleanly separates Title and Description
 * without contaminating titles with markdown formatting or conversational filler.
 */
export function parseMarkdownTasks(raw: string): StructuredTaskItem[] {
  const clean = stripReasoningAndFences(raw);
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  const tasks: StructuredTaskItem[] = [];

  for (const line of lines) {
    // Ignore markdown headers or section dividers
    if (/^#{1,6}\s+/.test(line) || /^[-=_*]{3,}$/.test(line)) continue;

    // Ignore conversational greeting or signoff lines
    if (
      /^(?:tentu|berikut|here are|sure|certainly|catatan|note|kesimpulan|semoga)\b/i.test(
        line
      ) &&
      line.endsWith(':')
    ) {
      continue;
    }

    // Match list markers: "- ", "* ", "• ", "1. ", "1) ", "- [ ]", "- [x]"
    const listMatch = line.match(
      /^(?:[-*•]|\d+[\.\)]|\- \[[ xX]\])\s+(.+)$/i
    );
    if (!listMatch || !listMatch[1]) continue;

    const fullItemText = listMatch[1].trim();
    if (fullItemText.length < 3) continue;

    let rawTitle = fullItemText;
    let description: string | undefined = undefined;

    // Detect patterns like "**Title**: Description" or "**Title** - Description"
    const boldColonMatch = fullItemText.match(
      /^\*\*(.+?)\*\*[:\-—]\s*(.+)$/i
    );
    if (boldColonMatch) {
      rawTitle = boldColonMatch[1].trim();
      description = boldColonMatch[2].trim();
    } else {
      // Detect simple "Title: Description" or "Title - Description"
      const separatorMatch = fullItemText.match(/^([^:\-—]{4,60})[:\-—]\s*(.+)$/);
      if (separatorMatch) {
        rawTitle = separatorMatch[1].trim();
        description = separatorMatch[2].trim();
      }
    }

    const title = sanitizeTitle(rawTitle);
    if (!title || title.length < 3) continue;

    // Priority detection from title and description
    const combinedText = `${title} ${description || ''}`;
    const priority = detectPriority(combinedText);

    // Date detection
    const dueDate = detectDueDate(combinedText);

    // Clean description of markdown formatting
    let cleanDesc = description ? description.replace(/[`*_]/g, '').trim() : undefined;
    if (cleanDesc && cleanDesc.length > 250) {
      cleanDesc = cleanDesc.slice(0, 247) + '...';
    }

    tasks.push({
      id: crypto.randomUUID(),
      title,
      priority,
      dueDate,
      description: cleanDesc,
      selected: true,
    });
  }

  return tasks;
}

/**
 * Smart offline heuristic task extraction.
 * Extracts discrete tasks directly from note or chat content without needing an active LLM roundtrip.
 */
export function smartHeuristicTaskExtraction(content: string): StructuredTaskItem[] {
  // 1. Try list bullet parser first
  const bulletTasks = parseMarkdownTasks(content);
  if (bulletTasks.length > 0) {
    return bulletTasks;
  }

  // 2. If no bullet format, look for action verbs across sentences
  const clean = stripReasoningAndFences(content);
  const sentences = clean
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && s.length <= 150);

  const actionVerbRegex =
    /^(?:buat|bikin|perbaiki|analisa|atur|pasang|beli|update|review|kirim|jadwalkan|cek|desain|tulis|hapus|hubungi|kerjakan|selesaikan|create|build|fix|update|review|check|test|design|schedule|send|implement|setup|configure|prepare|draft)\b/i;

  const results: StructuredTaskItem[] = [];

  for (const sentence of sentences) {
    const stripped = sanitizeTitle(sentence);
    if (actionVerbRegex.test(stripped)) {
      results.push({
        id: crypto.randomUUID(),
        title: stripped,
        priority: detectPriority(sentence),
        dueDate: detectDueDate(sentence),
        description: undefined,
        selected: true,
      });
    }
  }

  if (results.length > 0) {
    return results;
  }

  // 3. Fallback: return a single clean actionable summary item
  const firstLine = clean.split('\n')[0] || '';
  const cleanFirst = sanitizeTitle(firstLine) || 'Action item from context';

  return [
    {
      id: crypto.randomUUID(),
      title: cleanFirst.slice(0, 80),
      priority: detectPriority(clean),
      dueDate: detectDueDate(clean),
      description: clean.length > 80 ? clean.slice(0, 200) + '...' : undefined,
      selected: true,
    },
  ];
}

/**
 * Generates a clean, professional batch title for grouped task imports.
 * Eliminates conversational preamble (e.g. "Berikut adalah beberapa task...").
 */
export function generateCleanBatchTitle(content: string, fallback: string = 'Tasks'): string {
  const clean = stripReasoningAndFences(content);
  if (!clean) return fallback;

  // 1. Check for markdown header: "# Sprint Planning" -> "Sprint Planning"
  const headerMatch = clean.match(/^#{1,4}\s+(.+)$/m);
  if (headerMatch && headerMatch[1]) {
    const title = sanitizeTitle(headerMatch[1]);
    if (title.length > 3 && title.length < 50) return title;
  }

  // 2. Check for bold title at start: "**Renovasi Rumah**" -> "Renovasi Rumah"
  const boldMatch = clean.match(/^\*\*([^*]+)\*\*/);
  if (boldMatch && boldMatch[1]) {
    const title = sanitizeTitle(boldMatch[1]);
    if (title.length > 3 && title.length < 50) return title;
  }

  // 3. Clean conversational phrases
  const firstLine = clean.split('\n')[0] || '';
  let candidate = firstLine
    .replace(/^(?:tentu,?\s*)?(?:ini|berikut)?\s*(?:adalah)?\s*(?:daftar|rangkuman|beberapa)?\s*(?:tugas|task|todo|to-do)?\s*(?:untuk|terkait)?\s*/i, '')
    .replace(/^(?:here are|sure, here are|these are|summary of)\s*(?:the)?\s*(?:tasks|action items|todos)?\s*(?:for|to)?\s*/i, '')
    .replace(/[:\-—]\s*$/, '')
    .trim();

  candidate = sanitizeTitle(candidate);

  if (candidate && candidate.length > 3 && candidate.length <= 50) {
    // Capitalize first letter
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  return fallback;
}

/**
 * Extracts structured, discrete tasks from any text content (notes, documents, or AI chat responses).
 * Guaranteed to never crash or leave the user stranded, gracefully falling back to offline heuristics.
 */
export async function extractStructuredTasks(
  content: string,
  model: string,
  baseUrl?: string,
  apiKey?: string
): Promise<StructuredTaskItem[]> {
  if (!content || !content.trim()) return [];

  // Offline heuristic fallback when AI is disabled
  if (!getSettings().aiEnabled) {
    return smartHeuristicTaskExtraction(content);
  }

  const prompt = `You are an expert task extraction and project planning engine.
Carefully read the following content and extract discrete, concrete, actionable tasks from it.
Break complex ideas down into distinct individual steps.

For each task provide:
- "title": A clear, concise, action-oriented task title (e.g. "Draft architecture diagram", "Configure SQLite schema"). Do NOT include markdown bold or numbering in the title.
- "priority": one of "urgent", "high", "medium", "low".
- "dueDate": an ISO 8601 date string (YYYY-MM-DD) if a specific deadline, day, or timeframe is mentioned, otherwise null.
- "description": A short 1-sentence note detailing what needs to be done, or null.

Return ONLY a valid JSON array of objects. Do not include introductory text, reasoning scratchpad, or markdown formatting.
Example format:
[
  { "title": "Review security audit results", "priority": "high", "dueDate": null, "description": "Address any open CSP or API key findings." },
  { "title": "Configure automated backups", "priority": "medium", "dueDate": null, "description": null }
]

Content to analyze:
${content}`;

  try {
    const raw = await aiService.generateCompletion(prompt, model, baseUrl, apiKey);
    const parsedArray = extractJsonArray<any>(raw);

    if (parsedArray && parsedArray.length > 0) {
      const validTasks: StructuredTaskItem[] = [];

      for (const item of parsedArray) {
        if (!item) continue;
        const rawTitle = String(item.title || item.name || item.task || '').trim();
        const title = sanitizeTitle(rawTitle);
        if (!title || title.length < 2) continue;

        let priority: PriorityLevel = 'medium';
        const p = String(item.priority || '').toLowerCase();
        if (p === 'urgent' || p === 'high' || p === 'low' || p === 'medium') {
          priority = p;
        } else {
          priority = detectPriority(`${title} ${item.description || ''}`);
        }

        let dueDate: string | null = null;
        if (typeof item.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.dueDate)) {
          dueDate = item.dueDate.slice(0, 10);
        } else if (typeof item.due_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.due_date)) {
          dueDate = item.due_date.slice(0, 10);
        } else {
          dueDate = detectDueDate(`${title} ${item.description || ''}`);
        }

        validTasks.push({
          id: crypto.randomUUID(),
          title,
          priority,
          dueDate,
          description: item.description ? String(item.description).replace(/[`*_]/g, '').trim() : undefined,
          selected: true,
        });
      }

      if (validTasks.length > 0) {
        return validTasks;
      }
    }

    // If JSON parsing yielded no items, parse markdown bullets from LLM response
    const markdownParsed = parseMarkdownTasks(raw);
    if (markdownParsed.length > 0) {
      return markdownParsed;
    }
  } catch (err) {
    console.warn('AI task extraction encountered an issue, falling back to smart heuristic extraction:', err);
  }

  // Graceful offline heuristic fallback on input content
  return smartHeuristicTaskExtraction(content);
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

Return ONLY a valid JSON array of objects. Do not include introductory text or reasoning blocks.
Example:
[
  { "name": "Frontend", "category": "Topic", "reason": "Focuses on UI components and layouts" },
  { "name": "Security", "category": "Topic", "reason": "Mentions CSP and credentials" }
]

Content to analyze:
${content}`;

  const existingMap = new Map(existingTags.map((t) => [t.name.toLowerCase(), t]));

  if (getSettings().aiEnabled) {
    try {
      const raw = await aiService.generateCompletion(prompt, model, baseUrl, apiKey);
      const parsedArray = extractJsonArray<any>(raw);

      if (parsedArray && parsedArray.length > 0) {
        const validRecs: TagRecommendation[] = [];

        parsedArray.forEach((item, index) => {
          if (!item) return;
          const cleanName = sanitizeTitle(String(item.name || item.tag || '')).replace(/^#/, '');
          if (!cleanName || cleanName.length < 2) return;

          const existing = existingMap.get(cleanName.toLowerCase());

          validRecs.push({
            name: existing ? existing.name : cleanName,
            category: String(item.category || 'Topic').trim(),
            reason: String(item.reason || 'Relevant to note context').trim(),
            isExisting: Boolean(existing),
            existingTagId: existing?.id,
            color: existing?.color,
            selected: index < 4,
          });
        });

        if (validRecs.length > 0) {
          return validRecs;
        }
      }

      // Parse list bullets from raw text
      const clean = stripReasoningAndFences(raw);
      const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
      const bulletRecs: TagRecommendation[] = [];

      for (const line of lines) {
        const match = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
        if (match && match[1]) {
          const nameMatch = match[1].match(/\*\*([^*]+)\*\*/);
          const name = sanitizeTitle(nameMatch ? nameMatch[1] : match[1]).replace(/^#/, '').split(/[:-]/)[0].trim();
          if (name && name.length >= 2 && name.length <= 25) {
            const existing = existingMap.get(name.toLowerCase());
            bulletRecs.push({
              name: existing ? existing.name : name,
              category: 'Topic',
              reason: 'Extracted from content highlights',
              isExisting: Boolean(existing),
              existingTagId: existing?.id,
              color: existing?.color,
              selected: bulletRecs.length < 4,
            });
          }
        }
      }

      if (bulletRecs.length > 0) {
        return bulletRecs;
      }
    } catch (err) {
      console.warn('AI tag recommendation failed, using keyword fallback:', err);
    }
  }

  // Fallback: match words from content with existing user tags
  const lowerContent = content.toLowerCase();
  const matchedExisting = existingTags
    .filter((t) => lowerContent.includes(t.name.toLowerCase()))
    .slice(0, 5)
    .map((t, idx) => ({
      name: t.name,
      category: 'Existing',
      reason: 'Matched existing tag from your library',
      isExisting: true,
      existingTagId: t.id,
      color: t.color,
      selected: idx < 3,
    }));

  if (matchedExisting.length > 0) {
    return matchedExisting;
  }

  return [
    {
      name: 'General',
      category: 'Topic',
      reason: 'Default general tag',
      isExisting: Boolean(existingMap.get('general')),
      selected: true,
    },
  ];
}
