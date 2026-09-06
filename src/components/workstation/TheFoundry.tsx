import React, { useState, useMemo } from 'react';
import {
  Zap,
  CheckSquare,
  Tag,
  FileText,
  Sparkles,
  Play,
  X,
  Copy,
  Check,
  Cpu,
  Globe,
  AlertCircle,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  Link2,
  FileIcon,
  Maximize2,
  Minimize2,
  Settings as SettingsIcon,
  ListTodo,
  GitCompare,
  BookmarkPlus,
  Loader2,
  Sliders,
  FolderSync,
} from 'lucide-react';
import { useContextStore } from '../../stores/contextStore';
import { useSettings } from '../../stores/settingsStore';
import { useItemStore } from '../../stores/itemStore';
import { aiService } from '../../services/ai';
import { db } from '../../services/database';
import { RecipeOutput, RecipeType, LlmProviderConfig } from '../../types/ai';
import { PriorityLevel, formatTaskBatchSource, Tag as TagType } from '../../types/item';
import { Badge } from '../common/Badge';
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
  color: string;
  bgLight: string;
  bgDark: string;
}

const FORGE_RECIPES: ForgeRecipeConfig[] = [
  {
    id: 'synthesize',
    label: 'Executive Synthesis & Brief',
    tagline: 'Melt multiple items into an executive overview, core themes, and key takeaways.',
    icon: Sparkles,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50/70 hover:bg-indigo-100/60',
    bgDark: 'dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50',
  },
  {
    id: 'extract_tasks',
    label: 'Collective Task Miner',
    tagline: 'Scan all staged items to extract discrete, actionable tasks into a structured batch.',
    icon: ListTodo,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50/70 hover:bg-emerald-100/60',
    bgDark: 'dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50',
  },
  {
    id: 'cross_analyze',
    label: 'Cross-Analysis & Gap Detection',
    tagline: 'Compare items to uncover contradictions, overlapping ideas, and missing context.',
    icon: GitCompare,
    color: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-50/70 hover:bg-blue-100/60',
    bgDark: 'dark:bg-blue-950/40 dark:hover:bg-blue-900/50',
  },
  {
    id: 'triage',
    label: 'Batch Taxonomy & Auto-Tag',
    tagline: 'Analyze collection themes to propose unified tags and organizational structure.',
    icon: Tag,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50/70 hover:bg-amber-100/60',
    bgDark: 'dark:bg-amber-950/40 dark:hover:bg-amber-900/50',
  },
  {
    id: 'custom',
    label: 'Custom Instruction Forge',
    tagline: 'Provide your own bespoke instructions to guide the multi-item synthesis.',
    icon: Sliders,
    color: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-50/70 hover:bg-purple-100/60',
    bgDark: 'dark:bg-purple-950/40 dark:hover:bg-purple-900/50',
  },
];

export const TheFoundry: React.FC<TheFoundryProps> = ({
  onClose,
  onArtifactsApplied,
  isExpanded,
  onToggleExpand,
  onArtifactCreated,
  onOpenSettings,
}) => {
  const { stagedItems, unstageItem, clearStage, totalTokens, contextLimit } = useContextStore();
  const { settings, updateSettings } = useSettings();

  const isLocalMode = ['ollama', 'lmstudio'].includes(settings.aiProvider);

  const activeLocalModel =
    settings.aiProvider === 'ollama'
      ? (settings.ollamaModel || 'qwen2.5:latest')
      : (settings.lmstudioModel || 'qwen2.5-coder-7b-instruct');

  const cloudProviderName =
    settings.aiProvider === 'openai' ? 'OpenAI' :
    settings.aiProvider === 'gemini' ? 'Google Gemini' :
    settings.aiProvider === 'anthropic' ? 'Claude' :
    settings.aiProvider === 'custom' ? 'Custom' :
    'OpenRouter';

  const activeCloudModel =
    settings.aiProvider === 'openai' ? (settings.openaiModel || 'gpt-4o-mini') :
    settings.aiProvider === 'gemini' ? (settings.geminiModel || 'gemini-1.5-flash') :
    settings.aiProvider === 'anthropic' ? (settings.anthropicModel || 'claude-3-5-haiku-20241022') :
    settings.aiProvider === 'custom' ? (settings.customModel || 'custom-model') :
    (settings.openrouterModel || 'openai/gpt-4o-mini');

  const activeModelName = isLocalMode ? activeLocalModel : activeCloudModel;
  const activeProviderName = isLocalMode
    ? (settings.aiProvider === 'ollama' ? 'Ollama' : 'LM Studio')
    : cloudProviderName;

  const [selectedRecipe, setSelectedRecipe] = useState<ForgeRecipeKey>('synthesize');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<RecipeOutput | null>(null);
  const [isCommitted, setIsCommitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStagedTrayExpanded, setIsStagedTrayExpanded] = useState(true);

  // Quick Action feedback states
  const [savedNoteSuccess, setSavedNoteSuccess] = useState(false);
  const [savedTasksSuccess, setSavedTasksSuccess] = useState(false);
  const [isApplyingTags, setIsApplyingTags] = useState(false);
  const [savedTagsSuccess, setSavedTagsSuccess] = useState(false);

  // Review Dialog for Extracted Tasks
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [modalTasks, setModalTasks] = useState<StructuredTaskItem[]>([]);

  const tokens = totalTokens();
  const tokenPercentage = Math.min(100, Math.round((tokens / contextLimit) * 100));

  const getMeterColor = () => {
    if (tokenPercentage > 85) return 'bg-rose-500';
    if (tokenPercentage > 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getProviderConfig = (): LlmProviderConfig => {
    return getLlmProviderConfig(settings);
  };

  const handleRunForge = async () => {
    if (stagedItems.length === 0) {
      setError('Please stage at least one item into the Context Cart.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsCommitted(false);
    setSavedNoteSuccess(false);
    setSavedTasksSuccess(false);
    setSavedTagsSuccess(false);

    try {
      const config = getProviderConfig();
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
      setError(typeof err === 'string' ? err : err.message || 'Forging execution failed');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Save synthesized markdown as a new Note
  const handleSaveAsNewNote = async () => {
    if (!output?.markdown_content) return;
    try {
      const title =
        output.summary?.slice(0, 60) ||
        `Synthesized Note (${new Date().toLocaleDateString()})`;

      await db.createItem({
        type: 'note',
        title,
        content: output.markdown_content,
        source: 'foundry_synthesis',
      });

      await useItemStore.getState().refreshItems();
      await useItemStore.getState().refreshCounts();

      setSavedNoteSuccess(true);
      setTimeout(() => setSavedNoteSuccess(false), 3000);

      if (onArtifactCreated) {
        onArtifactCreated(`Created note: "${title}"`);
      }
    } catch (err: any) {
      setError('Failed to save synthesized note to database');
    }
  };

  // 2. Open Extracted Tasks in Task Review Dialog
  const handleOpenTaskReviewDialog = () => {
    if (!output?.extracted_tasks || output.extracted_tasks.length === 0) return;

    const mapped: StructuredTaskItem[] = output.extracted_tasks.map((t) => ({
      id: crypto.randomUUID(),
      title: t.title,
      priority: (t.priority as PriorityLevel) || 'medium',
      dueDate: t.due_date || null,
      selected: true,
    }));

    setModalTasks(mapped);
    setIsTaskModalOpen(true);
  };

  // 3. Confirm Extracted Tasks from Review Dialog
  const handleConfirmModalTasks = async (tasksToCreate: StructuredTaskItem[]) => {
    if (tasksToCreate.length === 0) return;
    try {
      const batchId = `foundry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const batchTitle =
        output?.summary?.slice(0, 50) || `Foundry Batch (${stagedItems.length} Items)`;

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
      setError('Failed to save tasks batch from The Foundry');
    }
  };

  // 4. Batch Apply Tags across all staged items
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

      // Attach to all staged items
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

  // 5. Global Commit All to DB (Rust backend apply_recipe_artifacts)
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
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'link':
        return <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case 'file':
        return <FileIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'note':
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/70 dark:bg-slate-900/70 border-l border-slate-200 dark:border-slate-800 select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
              The Foundry
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold tracking-wider">
                Workstation
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Context Synthesis &amp; Multi-Item Forge
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse panel width' : 'Expand panel width for comfortable reading'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close The Foundry"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Scrollable Workspace Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Zone 1: Context Cart & Memory Budget */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Context Cart</span>
              <span className="text-[11px] font-normal text-slate-500">
                ({stagedItems.length} {stagedItems.length === 1 ? 'item' : 'items'})
              </span>
            </div>

            {stagedItems.length > 0 && (
              <button
                type="button"
                onClick={clearStage}
                className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-medium transition-colors cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Token Meter Bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span>{tokens.toLocaleString()} tokens</span>
              <span>{tokenPercentage}% of {(contextLimit / 1000).toFixed(0)}k limit</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${getMeterColor()}`}
                style={{ width: `${tokenPercentage}%` }}
              />
            </div>
          </div>

          {/* Staged Items Pills / Collapsible Tray */}
          {stagedItems.length > 0 ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsStagedTrayExpanded(!isStagedTrayExpanded)}
                className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium py-0.5 cursor-pointer"
              >
                <span>Staged Items ({stagedItems.length})</span>
                {isStagedTrayExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {isStagedTrayExpanded && (
                <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {stagedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getItemIcon(item.type)}
                        <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">
                          ~{item.estimatedTokens}t
                        </span>
                        <button
                          type="button"
                          onClick={() => unstageItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                          title="Unstage item"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-2 px-1 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Context is empty.</span> Check the &ldquo;Stage&rdquo; box on any card in Velco to load notes, files, or tasks into this forging bench.
            </div>
          )}
        </div>

        {/* Zone 2: Engine Indicator Pill */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {isLocalMode ? (
              <Cpu className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            )}
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
              {activeProviderName}
            </span>
            <span className="text-slate-400 text-[10px] font-mono truncate max-w-[140px]">
              ({activeModelName})
            </span>
          </div>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 font-medium cursor-pointer"
            >
              Configure
            </button>
          )}
        </div>

        {/* Zone 3: The Forging Deck (Tool Recipes) */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            Select Forging Tool
          </label>

          <div className="grid grid-cols-1 gap-2">
            {FORGE_RECIPES.map((recipe) => {
              const Icon = recipe.icon;
              const isSelected = selectedRecipe === recipe.id;

              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => setSelectedRecipe(recipe.id)}
                  className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/30 shadow-xs'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${recipe.bgLight} ${recipe.bgDark} ${recipe.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                      <span>{recipe.label}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" />
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {recipe.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedRecipe === 'custom' && (
            <div className="pt-1">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., Compare requirements in Note A with technical specs in File B, and draft an executive briefing..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Forge Action Execution Button */}
        <button
          type="button"
          onClick={handleRunForge}
          disabled={isLoading || stagedItems.length === 0}
          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Forging Artifacts in Rust...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Forge Artifacts ({stagedItems.length} Staged)</span>
            </>
          )}
        </button>

        {/* Error Callout */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1 break-words">{error}</div>
            </div>
            {onOpenSettings && (
              <div className="pt-1 border-t border-rose-200/60 dark:border-rose-800/60 flex justify-end">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="text-[11px] font-semibold underline hover:text-rose-900 dark:hover:text-rose-100 cursor-pointer"
                >
                  Verify Settings &amp; API Keys
                </button>
              </div>
            )}
          </div>
        )}

        {/* Zone 4: Forged Artifact Studio (Output Cards) */}
        {output && (
          <div className="pt-2 space-y-3.5 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Forged Studio Artifacts</span>
              </h3>

              {isCommitted ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All Committed
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleCommitAllArtifacts}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="Commit all artifacts to SQLite database at once"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Commit All to DB</span>
                </button>
              )}
            </div>

            {/* Artifact 1: Executive Summary */}
            {output.summary && (
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Executive Overview
                </span>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <MarkdownViewer content={output.summary} />
                </div>
              </div>
            )}

            {/* Artifact 2: Synthesized Markdown Document */}
            {output.markdown_content && (
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-indigo-500" />
                    Synthesized Document
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyMarkdown}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveAsNewNote}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        savedNoteSuccess
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                      }`}
                    >
                      {savedNoteSuccess ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Saved to Notes!</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3 h-3" />
                          <span>Save as Note</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 max-h-72 overflow-y-auto leading-relaxed text-xs">
                  <MarkdownViewer content={output.markdown_content} />
                </div>
              </div>
            )}

            {/* Artifact 3: Collective Extracted Tasks */}
            {output.extracted_tasks && output.extracted_tasks.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <CheckSquare className="w-3 h-3 text-emerald-500" />
                    Mined Tasks ({output.extracted_tasks.length})
                  </span>

                  <button
                    type="button"
                    onClick={handleOpenTaskReviewDialog}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      savedTasksSuccess
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                    }`}
                  >
                    {savedTasksSuccess ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Tasks Saved!</span>
                      </>
                    ) : (
                      <>
                        <ListTodo className="w-3.5 h-3.5" />
                        <span>Review &amp; Commit Tasks</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {output.extracted_tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs"
                    >
                      <span className="text-slate-800 dark:text-slate-200 font-medium flex-1">
                        {task.title}
                      </span>
                      <Badge
                        variant={
                          task.priority === 'high'
                            ? 'red'
                            : task.priority === 'medium'
                            ? 'amber'
                            : 'gray'
                        }
                        size="sm"
                      >
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Artifact 4: Suggested Taxonomy Tags */}
            {output.tags && output.tags.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-500" />
                    Suggested Taxonomy Tags
                  </span>

                  <button
                    type="button"
                    onClick={handleApplyTagsToStagedItems}
                    disabled={isApplyingTags || stagedItems.length === 0}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      savedTagsSuccess
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {isApplyingTags ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Applying...</span>
                      </>
                    ) : savedTagsSuccess ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Tags Applied!</span>
                      </>
                    ) : (
                      <>
                        <FolderSync className="w-3 h-3" />
                        <span>Apply to {stagedItems.length} Staged Items</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {output.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold"
                    >
                      #{t.replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Extraction Modal for Reviewing Mined Tasks */}
      <TaskExtractionModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        tasks={modalTasks}
        sourceTitle="The Foundry Synthesis"
        onConfirm={handleConfirmModalTasks}
      />
    </div>
  );
};
