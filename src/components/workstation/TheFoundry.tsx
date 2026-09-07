import React, { useState } from 'react';
import {
  Zap,
  CheckSquare,
  Tag,
  FileText,
  Sparkles,
  X,
  Copy,
  Check,
  Cpu,
  Globe,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  Link2,
  FileIcon,
  Maximize2,
  Minimize2,
  ListTodo,
  GitCompare,
  Loader2,
  Sliders,
  CornerDownLeft,
  ShieldAlert,
} from 'lucide-react';
import { useContextStore } from '../../stores/contextStore';
import { useSettings } from '../../stores/settingsStore';
import { useItemStore } from '../../stores/itemStore';
import { aiService } from '../../services/ai';
import { db } from '../../services/database';
import { RecipeOutput, RecipeType, LlmProviderConfig } from '../../types/ai';
import { formatTaskBatchSource, Tag as TagType } from '../../types/item';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { TaskExtractionModal } from '../tasks/TaskExtractionModal';
import { StructuredTaskItem } from '../../services/ai/taskExtractor';
import { getLlmProviderConfig } from '../../utils/aiUtils';

interface TheFoundryProps {
  onClose?: () => void;
  onArtifactsApplied?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onArtifactCreated?: (msg: string) => void;
  onOpenSettings?: () => void;
}

type ForgeRecipeKey = 'synthesize' | 'extract_tasks' | 'cross_analyze' | 'triage' | 'custom';

interface ForgeRecipeConfig {
  id: ForgeRecipeKey;
  label: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FORGE_RECIPES: ForgeRecipeConfig[] = [
  {
    id: 'synthesize',
    label: 'Executive Synthesis',
    tagline: 'Melt staged items into an executive overview, core themes, and key takeaways.',
    icon: Sparkles,
  },
  {
    id: 'extract_tasks',
    label: 'Collective Task Miner',
    tagline: 'Scan staged items to extract discrete, actionable tasks into a structured batch.',
    icon: ListTodo,
  },
  {
    id: 'cross_analyze',
    label: 'Cross-Analysis & Gaps',
    tagline: 'Compare items to uncover contradictions, overlapping ideas, and missing context.',
    icon: GitCompare,
  },
  {
    id: 'triage',
    label: 'Taxonomy & Auto-Tag',
    tagline: 'Analyze collection themes to propose unified tags and organizational structure.',
    icon: Tag,
  },
  {
    id: 'custom',
    label: 'Custom Instruction',
    tagline: 'Provide bespoke instructions to guide the multi-item local synthesis.',
    icon: Sliders,
  },
];

export const TheFoundry: React.FC<TheFoundryProps> = ({
  onClose,
  onArtifactsApplied,
  isExpanded = false,
  onToggleExpand,
  onArtifactCreated,
  onOpenSettings,
}) => {
  const { stagedItems, unstageItem, clearStage, totalTokens, contextLimit } = useContextStore();
  const { settings, updateSettings } = useSettings();

  const isLocalMode = ['ollama', 'lmstudio'].includes(settings.aiProvider);
  const activeModel = isLocalMode
    ? (settings.aiProvider === 'ollama' ? (settings.ollamaModel || 'qwen2.5:latest') : (settings.lmstudioModel || 'qwen2.5-coder'))
    : (settings.aiProvider === 'openai' ? (settings.openaiModel || 'gpt-4o-mini') :
       settings.aiProvider === 'gemini' ? (settings.geminiModel || 'gemini-1.5-flash') :
       settings.aiProvider === 'openrouter' ? (settings.openrouterModel || 'openai/gpt-4o-mini') :
       'cloud-model');

  const activeProvider = settings.aiProvider === 'none' ? 'None' :
    settings.aiProvider === 'ollama' ? 'Ollama' :
    settings.aiProvider === 'lmstudio' ? 'LM Studio' :
    settings.aiProvider.charAt(0).toUpperCase() + settings.aiProvider.slice(1);

  const [selectedRecipe, setSelectedRecipe] = useState<ForgeRecipeKey>('synthesize');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<RecipeOutput | null>(null);
  const [isCommitted, setIsCommitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStagedTrayExpanded, setIsStagedTrayExpanded] = useState(true);

  const [savedNoteSuccess, setSavedNoteSuccess] = useState(false);
  const [savedTasksSuccess, setSavedTasksSuccess] = useState(false);
  const [savedTagsSuccess, setSavedTagsSuccess] = useState(false);
  const [isApplyingTags, setIsApplyingTags] = useState(false);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [modalTasks, setModalTasks] = useState<StructuredTaskItem[]>([]);

  const tokens = totalTokens();
  const tokenPercentage = Math.min(100, Math.round((tokens / contextLimit) * 100));

  const getMeterColor = () => {
    if (tokenPercentage > 85) return 'bg-rose-500';
    if (tokenPercentage > 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const handleRunForge = async () => {
    if (!settings.aiEnabled) {
      setError('AI features are disabled in Settings. Enable AI to execute synthesis recipes.');
      return;
    }
    if (stagedItems.length === 0) {
      setError('Please stage at least one item into the Context Queue.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsCommitted(false);
    setSavedNoteSuccess(false);
    setSavedTasksSuccess(false);
    setSavedTagsSuccess(false);

    try {
      const config: LlmProviderConfig = getLlmProviderConfig(settings);
      const itemIds = stagedItems.map((i) => i.id);

      let rustRecipe: RecipeType = 'synthesize';
      let promptInstruction: string | undefined = undefined;

      if (selectedRecipe === 'extract_tasks') {
        rustRecipe = 'extract_tasks';
      } else if (selectedRecipe === 'triage') {
        rustRecipe = 'triage';
      } else if (selectedRecipe === 'cross_analyze') {
        rustRecipe = 'custom';
        promptInstruction =
          'Perform a rigorous cross-analysis and gap detection across all provided items. Identify points of synergy, potential contradictions, overlapping concepts, and critical missing details. Output structured findings in markdown_content with summary and tags.';
      } else if (selectedRecipe === 'custom') {
        rustRecipe = 'custom';
        promptInstruction = customPrompt;
      } else {
        rustRecipe = 'synthesize';
      }

      const res = await aiService.executeRecipe(itemIds, rustRecipe, promptInstruction, config);
      setOutput(res);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Workbench execution failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsNewNote = async () => {
    if (!output?.markdown_content) return;
    try {
      const title =
        output.summary?.slice(0, 60) ||
        `Workbench Synthesis (${new Date().toLocaleDateString()})`;

      await db.createItem({
        type: 'note',
        title,
        content: output.markdown_content,
        source: 'workbench_synthesis',
      });

      await useItemStore.getState().refreshItems();
      await useItemStore.getState().refreshCounts();

      setSavedNoteSuccess(true);
      setTimeout(() => setSavedNoteSuccess(false), 3000);

      if (onArtifactCreated) {
        onArtifactCreated(`Created note: "${title}"`);
      }
    } catch (err: any) {
      setError('Failed to save synthesized note');
    }
  };

  const handleReviewExtractedTasks = () => {
    if (!output?.extracted_tasks || output.extracted_tasks.length === 0) return;
    const structured: StructuredTaskItem[] = output.extracted_tasks.map((task, idx) => ({
      id: `foundry_task_${Date.now()}_${idx}`,
      title: task.title,
      priority: task.priority || 'medium',
      dueDate: task.due_date || null,
      selected: true,
    }));
    setModalTasks(structured);
    setIsTaskModalOpen(true);
  };

  const handleConfirmModalTasks = async (tasksToCreate: StructuredTaskItem[]) => {
    if (tasksToCreate.length === 0) return;
    try {
      const batchId = `forge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const batchTitle = output?.summary?.slice(0, 40) || 'Workbench Tasks';
      const batchSourceStr = formatTaskBatchSource({
        origin: 'ai_extract',
        batchId,
        batchTitle,
      });

      for (const t of tasksToCreate) {
        await db.createItem({
          type: 'task',
          title: t.title,
          content: t.description || '',
          source: batchSourceStr,
          task: {
            priority: t.priority || 'medium',
            completed: false,
            dueDate: t.dueDate,
          },
        });
      }

      await useItemStore.getState().refreshItems();
      await useItemStore.getState().refreshCounts();

      setIsTaskModalOpen(false);
      setSavedTasksSuccess(true);
      setTimeout(() => setSavedTasksSuccess(false), 3000);

      if (onArtifactCreated) {
        onArtifactCreated(
          `Created ${tasksToCreate.length} task${tasksToCreate.length > 1 ? 's' : ''}: "${batchTitle}"`
        );
      }
    } catch (err: any) {
      setError('Failed to save tasks batch from Workbench');
    }
  };

  const handleApplyTagsToStagedItems = async () => {
    if (!output?.tags || output.tags.length === 0 || stagedItems.length === 0) return;
    setIsApplyingTags(true);
    try {
      const allTags: TagType[] = await db.getTags();
      const tagsToAdd: TagType[] = [];

      for (const rawName of output.tags) {
        const cleanName = rawName.replace(/^#/, '').trim();
        if (!cleanName) continue;

        let found = allTags.find((t: TagType) => t.name.toLowerCase() === cleanName.toLowerCase());
        if (!found) {
          found = await db.createTag(cleanName);
          allTags.push(found);
        }
        if (found && !tagsToAdd.some((t: TagType) => t.id === found!.id)) {
          tagsToAdd.push(found);
        }
      }

      for (const staged of stagedItems) {
        const item = await db.getItem(staged.id);
        if (item) {
          const currentTags = item.tags || [];
          const merged = [...currentTags];
          for (const newTag of tagsToAdd) {
            if (!merged.some((t) => t.id === newTag.id)) {
              merged.push(newTag);
            }
          }
          await db.updateItem(staged.id, { tags: merged });
        }
      }

      await useItemStore.getState().refreshItems();
      setSavedTagsSuccess(true);
      setTimeout(() => setSavedTagsSuccess(false), 3000);

      if (onArtifactCreated) {
        onArtifactCreated(
          `Applied ${tagsToAdd.length} tags across ${stagedItems.length} staged items`
        );
      }
    } catch (err: any) {
      setError('Failed to apply tags to staged items');
    } finally {
      setIsApplyingTags(false);
    }
  };

  const handleCommitAllArtifacts = async () => {
    if (!output) return;
    setIsLoading(true);
    setError(null);

    try {
      await aiService.applyArtifacts(output);
      setIsCommitted(true);
      if (onArtifactsApplied) {
        onArtifactsApplied();
      }
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to commit artifacts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!output?.markdown_content) return;
    navigator.clipboard.writeText(output.markdown_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'link':
        return <Link2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'file':
        return <FileIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'note':
      default:
        return <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
    }
  };

  // Left Context Queue Subcomponent
  const renderContextQueue = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-800 dark:text-zinc-300">
          <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Context Queue</span>
          <span className="text-[11px] font-normal text-slate-500 dark:text-zinc-500">
            ({stagedItems.length})
          </span>
        </div>

        {stagedItems.length > 0 && (
          <button
            type="button"
            onClick={clearStage}
            className="text-[11px] font-mono text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Memory Budget Bar */}
      <div className="space-y-1 p-2.5 rounded-md bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.06]">
        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 dark:text-zinc-500">
          <span>{tokens.toLocaleString()} tokens</span>
          <span>{tokenPercentage}% of {(contextLimit / 1000).toFixed(0)}k</span>
        </div>
        <div className="h-1 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${getMeterColor()}`}
            style={{ width: `${tokenPercentage}%` }}
          />
        </div>
      </div>

      {/* Staged Items Tray */}
      {stagedItems.length > 0 ? (
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          {stagedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.06] text-xs shadow-2xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getItemIcon(item.type)}
                <span className="truncate text-slate-800 dark:text-zinc-300 font-medium text-[11px]">
                  {item.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                  ~{item.estimatedTokens}t
                </span>
                <button
                  type="button"
                  onClick={() => unstageItem(item.id)}
                  className="text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                  title="Unstage item"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 rounded-md bg-slate-50 dark:bg-[#101014] border border-dashed border-slate-200 dark:border-white/[0.06] text-[11px] text-slate-500 dark:text-zinc-500 leading-relaxed font-mono">
          Context is empty. Click &ldquo;Add to Workbench&rdquo; on any card or batch bar to load items for synthesis.
        </div>
      )}
    </div>
  );

  // Right Recipe Deck Subcomponent
  const renderRecipeDeck = () => (
    <div className="space-y-3.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
        Synthesis Recipe
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FORGE_RECIPES.map((recipe) => {
          const Icon = recipe.icon;
          const isSelected = selectedRecipe === recipe.id;

          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => setSelectedRecipe(recipe.id)}
              className={`flex items-start gap-2.5 p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-white/[0.08] dark:border-white/[0.18] dark:text-zinc-100 shadow-xs'
                  : 'bg-white dark:bg-[#141418] border-slate-200 dark:border-white/[0.06] hover:border-slate-300 dark:hover:border-white/[0.12] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-500'}`} />
              <div className="min-w-0">
                <div className="text-xs font-semibold leading-tight truncate">{recipe.label}</div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-500 leading-snug mt-0.5 line-clamp-2">
                  {recipe.tagline}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedRecipe === 'custom' && (
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-500 font-semibold">
            Custom Instructions
          </label>
          <textarea
            rows={2}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Specify synthesis instructions..."
            className="w-full bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] rounded-md p-2 text-xs text-slate-900 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-slate-400 dark:focus:border-white/[0.2] resize-none"
          />
        </div>
      )}

      {/* Execute Button */}
      {!settings.aiEnabled && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-mono text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>AI features are disabled</span>
          </div>
          <button
            type="button"
            onClick={() => updateSettings({ aiEnabled: true })}
            className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
          >
            Turn On AI
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleRunForge}
        disabled={isLoading || stagedItems.length === 0 || !settings.aiEnabled}
        title={!settings.aiEnabled ? 'AI features are disabled in Settings' : undefined}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Synthesizing Context...</span>
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Execute Synthesis</span>
          </>
        )}
      </button>

      {error && (
        <div className="p-2.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Synthesis Output Area */}
      {output && (
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
              Output Artifact
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                title="Copy markdown"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={handleSaveAsNewNote}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  savedNoteSuccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
                }`}
              >
                {savedNoteSuccess ? 'Saved Note' : 'Save as Note'}
              </button>
              {output.extracted_tasks && output.extracted_tasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleReviewExtractedTasks}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25 dark:border-blue-500/20 transition-colors cursor-pointer"
                >
                  Mine Tasks ({output.extracted_tasks.length})
                </button>
              )}
            </div>
          </div>

          <div className="p-3 rounded-md bg-white dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] max-h-72 overflow-y-auto text-xs text-slate-800 dark:text-zinc-200 leading-relaxed shadow-2xs">
            <MarkdownViewer content={output.markdown_content || ''} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0d0d10] border-l border-slate-200 dark:border-white/[0.07] select-none overflow-hidden text-slate-800 dark:text-zinc-100">
      {/* Header */}
      <div className="h-11 px-3.5 border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#0d0d10]">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 fill-current" />
          <span className="font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200 tracking-wider uppercase">
            Studio Workbench
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 bg-slate-100 dark:bg-white/[0.04] px-1.5 py-0.2 rounded border border-slate-200 dark:border-white/[0.05]">
            {settings.aiEnabled ? activeModel : 'AI Disabled'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse width' : 'Expand width'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="Close Workbench"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Dual-Pane if expanded, Stacked if normal */}
      <div className="flex-1 overflow-y-auto p-3.5">
        {isExpanded ? (
          <div className="grid grid-cols-12 gap-4 h-full">
            <div className="col-span-5 border-r border-slate-200 dark:border-white/[0.06] pr-4">
              {renderContextQueue()}
            </div>
            <div className="col-span-7">
              {renderRecipeDeck()}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {renderContextQueue()}
            <div className="border-t border-slate-200 dark:border-white/[0.06] pt-3">
              {renderRecipeDeck()}
            </div>
          </div>
        )}
      </div>

      {/* Review Dialog for Extracted Tasks */}
      <TaskExtractionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        tasks={modalTasks}
        sourceTitle="Workbench Task Batch"
        onConfirm={handleConfirmModalTasks}
      />
    </div>
  );
};
