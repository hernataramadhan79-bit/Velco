import React, { useState } from 'react';
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
  MessageSquare,
  Maximize2,
  Minimize2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useContextStore } from '../../stores/contextStore';
import { useSettings } from '../../stores/settingsStore';
import { aiService } from '../../services/ai';
import { RecipeOutput, RecipeType, LlmProviderConfig } from '../../types/ai';
import { Badge } from '../common/Badge';
import { MarkdownViewer } from '../common/MarkdownViewer';
import { FoundryChat } from './FoundryChat';

interface TheFoundryProps {
  onClose?: () => void;
  onArtifactsApplied?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onArtifactCreated?: (msg: string) => void;
  onOpenSettings?: () => void;
}

export const TheFoundry: React.FC<TheFoundryProps> = ({
  onClose,
  onArtifactsApplied,
  isExpanded,
  onToggleExpand,
  onArtifactCreated,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'recipes' | 'chat'>('chat');
  const {
    stagedItems,
    unstageItem,
    clearStage,
    totalTokens,
    contextLimit,
  } = useContextStore();

  const { settings, updateSettings } = useSettings();

  // The true source of truth is settings.aiProvider
  const isLocalMode = ['ollama', 'lmstudio'].includes(settings.aiProvider);

  // Active local model and endpoint
  const activeLocalModel =
    settings.aiProvider === 'ollama'
      ? (settings.ollamaModel || 'qwen2.5:latest')
      : (settings.lmstudioModel || 'qwen2.5-coder-7b-instruct');

  const activeLocalUrl =
    settings.aiProvider === 'ollama'
      ? (settings.ollamaUrl || 'http://localhost:11434')
      : (settings.lmstudioUrl || 'http://localhost:1234/v1');

  const cloudProviderName =
    settings.aiProvider === 'openai' ? 'OpenAI' :
    settings.aiProvider === 'gemini' ? 'Google Gemini' :
    settings.aiProvider === 'anthropic' ? 'Anthropic Claude' :
    settings.aiProvider === 'custom' ? 'Custom Endpoint' :
    'OpenRouter';

  const activeCloudModel =
    settings.aiProvider === 'openai' ? (settings.openaiModel || 'gpt-4o-mini') :
    settings.aiProvider === 'gemini' ? (settings.geminiModel || 'gemini-1.5-flash') :
    settings.aiProvider === 'anthropic' ? (settings.anthropicModel || 'claude-3-5-haiku-20241022') :
    settings.aiProvider === 'custom' ? (settings.customModel || 'custom-model') :
    (settings.openrouterModel || 'openai/gpt-4o-mini');

  const activeProviderName = isLocalMode
    ? (settings.aiProvider === 'ollama' ? 'Ollama' : 'LM Studio')
    : cloudProviderName;

  const activeModelName = isLocalMode ? activeLocalModel : activeCloudModel;

  const [selectedRecipe, setSelectedRecipe] = useState<RecipeType>('synthesize');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<RecipeOutput | null>(null);
  const [isCommitted, setIsCommitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStagedTrayExpanded, setIsStagedTrayExpanded] = useState(false);

  const tokens = totalTokens();
  const tokenPercentage = Math.min(100, Math.round((tokens / contextLimit) * 100));

  const getMeterColor = () => {
    if (tokenPercentage > 85) return 'bg-rose-500';
    if (tokenPercentage > 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getProviderConfig = (): LlmProviderConfig => {
    if (isLocalMode) {
      if (settings.aiProvider === 'ollama') {
        return {
          type: 'Ollama',
          config: {
            base_url: activeLocalUrl,
            model: activeLocalModel,
          },
        };
      } else {
        // LM Studio or other local OpenAI-compatible server (default: port 1234)
        return {
          type: 'OpenAiCompatible',
          config: {
            base_url: activeLocalUrl,
            api_key: '',
            model: activeLocalModel,
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
  };

  const handleRunRecipe = async () => {
    if (stagedItems.length === 0) {
      setError('Please stage at least one item into the Context Cart.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsCommitted(false);

    try {
      const config = getProviderConfig();
      const itemIds = stagedItems.map((i) => i.id);
      const res = await aiService.executeRecipe(
        itemIds,
        selectedRecipe,
        selectedRecipe === 'custom' ? customPrompt : undefined,
        config
      );
      setOutput(res);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Recipe execution failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommitArtifacts = async () => {
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
      setError(typeof err === 'string' ? err : err.message || 'Failed to apply artifacts');
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Zap className="w-4 h-4 fill-indigo-600 dark:fill-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              The Foundry
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold tracking-wider">
                Workstation
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Context-Bound AI Recipes &amp; Chat</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse panel width' : 'Expand panel width for comfortable reading'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close The Foundry"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Workstation Mode Switcher Tabs */}
      <div className="px-4 py-2 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/40">
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'recipes'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${activeTab === 'recipes' ? 'fill-indigo-600 dark:fill-indigo-400' : ''}`} />
            <span>AI Recipes</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Context Chat</span>
          </button>
        </div>
      </div>

      {/* Tab Content Area */}
      {activeTab === 'chat' ? (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <FoundryChat
            providerConfig={getProviderConfig()}
            activeProviderName={activeProviderName}
            activeModelName={activeModelName}
            isLocal={isLocalMode}
            onArtifactCreated={(msg) => {
              if (onArtifactCreated) onArtifactCreated(msg);
              if (onArtifactsApplied) onArtifactsApplied();
            }}
            onOpenSettings={onOpenSettings}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Context Meter Card */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2.5">
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
                onClick={clearStage}
                className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-medium transition-colors"
              >
                Clear All
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

          {/* Staged Items Pills / Collapsible List */}
          {stagedItems.length > 0 ? (
            <div className="pt-1">
              <button
                onClick={() => setIsStagedTrayExpanded(!isStagedTrayExpanded)}
                className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium py-0.5"
              >
                <span>View Staged Items</span>
                {isStagedTrayExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {isStagedTrayExpanded && (
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {stagedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs"
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
                          onClick={() => unstageItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"
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
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
              No items staged. Check the &ldquo;Stage&rdquo; box on cards in your feed to assemble context.
            </p>
          )}
        </div>

        {/* Engine Switcher */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
              Execution Engine
            </label>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              {isLocalMode ? '100% Offline' : 'Cloud BYOK'}
            </span>
          </div>

          {/* Primary Mode: Local AI vs Cloud BYOK */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-900/80 text-xs font-medium">
            <button
              onClick={() => {
                const targetLocal = settings.aiProvider === 'ollama' ? 'ollama' : 'lmstudio';
                updateSettings({ aiProvider: targetLocal });
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all cursor-pointer ${
                isLocalMode
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Local AI</span>
            </button>
            <button
              onClick={() => {
                const targetCloud =
                  settings.geminiApiKey ? 'gemini' :
                  settings.openaiApiKey ? 'openai' :
                  settings.anthropicApiKey ? 'anthropic' :
                  settings.openrouterApiKey ? 'openrouter' :
                  'gemini';
                updateSettings({ aiProvider: targetCloud });
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all cursor-pointer ${
                !isLocalMode
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Cloud BYOK</span>
            </button>
          </div>

          {/* Engine & Model Details */}
          {isLocalMode ? (
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Local Engine:</span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg text-[10px] font-medium">
                  <button
                    type="button"
                    onClick={() => updateSettings({ aiProvider: 'lmstudio' })}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      settings.aiProvider === 'lmstudio'
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="LM Studio / Local OpenAI (default port 1234)"
                  >
                    LM Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ aiProvider: 'ollama' })}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      settings.aiProvider === 'ollama'
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                    title="Ollama local daemon (default port 11434)"
                  >
                    Ollama
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] px-0.5">
                <span className="text-slate-500 dark:text-slate-400">Model:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 font-medium truncate max-w-[190px]" title={activeLocalModel}>
                  {activeLocalModel}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] px-0.5 text-slate-400">
                <span>Endpoint:</span>
                <span className="font-mono truncate max-w-[190px]" title={activeLocalUrl}>
                  {activeLocalUrl}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Provider:</span>
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg text-[10px] font-medium">
                  {(['gemini', 'openrouter', 'openai', 'anthropic'] as const).map((p) => {
                    const label = p === 'gemini' ? 'Gemini' : p === 'openrouter' ? 'OpenRouter' : p === 'openai' ? 'OpenAI' : 'Claude';
                    const isCurrent = settings.aiProvider === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => updateSettings({ aiProvider: p })}
                        className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between px-0.5">
                <span className="text-slate-500 dark:text-slate-400">Model:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 font-medium truncate max-w-[190px]" title={activeCloudModel}>
                  {activeCloudModel}
                </span>
              </div>

              {onOpenSettings && (
                <div className="pt-0.5 flex justify-end">
                  <button
                    onClick={onOpenSettings}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <SettingsIcon className="w-3 h-3" />
                    <span>Configure API Keys in Settings</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recipe Deck */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            Select Recipe
          </label>

          <div className="grid grid-cols-1 gap-2">
            {/* 1. Synthesize */}
            <button
              onClick={() => setSelectedRecipe('synthesize')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                selectedRecipe === 'synthesize'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300'
              }`}
            >
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Synthesize &amp; Cross-Examine
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Correlate patterns, themes, and contradictions into a unified synthesized note.
                </p>
              </div>
            </button>

            {/* 2. Extract Tasks */}
            <button
              onClick={() => setSelectedRecipe('extract_tasks')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                selectedRecipe === 'extract_tasks'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300'
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Extract Actionable Tasks
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Mine the staged context for deliverables, follow-ups, priorities, and deadlines.
                </p>
              </div>
            </button>

            {/* 3. Triage & Tag */}
            <button
              onClick={() => setSelectedRecipe('triage')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                selectedRecipe === 'triage'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300'
              }`}
            >
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Triage &amp; Auto-Tag
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Suggest taxonomies, categorical tags, and structural organization.
                </p>
              </div>
            </button>

            {/* 4. Custom Prompt */}
            <button
              onClick={() => setSelectedRecipe('custom')}
              className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                selectedRecipe === 'custom'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300'
              }`}
            >
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Custom Prompt Instruction
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Provide custom instructions to guide synthesis across the staged items.
                </p>
              </div>
            </button>
          </div>

          {selectedRecipe === 'custom' && (
            <div className="pt-1">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="E.g., Compare the project requirements in note A with the budget in file B, and draft an executive briefing..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Run Button */}
        <button
          onClick={handleRunRecipe}
          disabled={isLoading || stagedItems.length === 0}
          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Forging Synthesis in Rust...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Execute Recipe ({stagedItems.length} Staged)</span>
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
            <div className="pt-1.5 border-t border-rose-200/60 dark:border-rose-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                {error.includes('1234')
                  ? 'Server LM Studio (port 1234) tidak aktif.'
                  : error.includes('11434')
                  ? 'Ollama (port 11434) tidak terhubung.'
                  : error.includes('401')
                  ? 'Autentikasi gagal / API key salah.'
                  : 'Periksa konfigurasi AI di Pengaturan.'}
              </span>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium cursor-pointer transition-colors shrink-0 ml-2 shadow-2xs"
                >
                  Buka Settings
                </button>
              )}
            </div>
          </div>
        )}

        {/* Artifact Output Viewer */}
        {output && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Recipe Artifacts</span>
              </h3>
              {isCommitted ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Committed to SQLite
                </span>
              ) : (
                <button
                  onClick={handleCommitArtifacts}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Commit to DB</span>
                </button>
              )}
            </div>

            {/* Summary */}
            {output.summary && (
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Summary
                </span>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <MarkdownViewer content={output.summary} />
                </div>
              </div>
            )}

            {/* Extracted Tasks */}
            {output.extracted_tasks && output.extracted_tasks.length > 0 && (
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <CheckSquare className="w-3 h-3 text-emerald-500" />
                    Extracted Tasks ({output.extracted_tasks.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {output.extracted_tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs"
                    >
                      <span className="text-slate-800 dark:text-slate-200 font-medium flex-1">
                        {task.title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {output.tags && output.tags.length > 0 && (
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                  <Tag className="w-3 h-3 text-amber-500" />
                  Suggested Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {output.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Markdown Synthesis Content */}
            {output.markdown_content && (
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-indigo-500" />
                    Synthesized Document
                  </span>
                  <button
                    onClick={handleCopyMarkdown}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 max-h-80 overflow-y-auto leading-relaxed">
                  <MarkdownViewer content={output.markdown_content} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
};
