import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettings } from '../../../stores/settingsStore';
import { aiService } from '../../../services/ai';
import { AIProviderType } from '../../../types/settings';
import { AIModelInfo } from '../../../types/ai';
import { DynamicModelSelector } from '../DynamicModelSelector';
import { AiUsageDashboard } from './AiUsageDashboard';
import { CloudConsentModal } from '../../../components/ai/CloudConsentModal';
import {
  Cpu,
  Eye,
  EyeOff,
  ExternalLink,
  Key,
  Globe,
  Server,
  Lock,
  Search,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sliders,
  Check,
  ShieldCheck,
} from 'lucide-react';

function formatContextLength(ctx?: number): string | null {
  if (!ctx || ctx <= 0) return null;
  if (ctx >= 1000000) {
    const m = (ctx / 1000000).toFixed(ctx % 1000000 === 0 ? 0 : 1);
    return `${m}M ctx`;
  }
  if (ctx >= 1000) {
    return `${Math.round(ctx / 1000)}k ctx`;
  }
  return `${ctx} ctx`;
}

const CURATED_OPENROUTER_FREE_MODELS: AIModelInfo[] = [
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Google: Gemini 2.0 Flash Exp (free)',
    isFree: true,
    contextLength: 1048576,
    description: 'Multimodal, high speed, 1M token context window',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Meta: Llama 3.3 70B Instruct (free)',
    isFree: true,
    contextLength: 131072,
    description: 'Flagship 70B open weights model with 128k context',
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek: DeepSeek R1 (free)',
    isFree: true,
    contextLength: 64000,
    description: 'State-of-the-art open reasoning model',
  },
  {
    id: 'deepseek/deepseek-chat:free',
    name: 'DeepSeek: DeepSeek V3 (free)',
    isFree: true,
    contextLength: 64000,
    description: 'Flagship general purpose chat model',
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen: Qwen 2.5 Coder 32B (free)',
    isFree: true,
    contextLength: 32768,
    description: 'Top open-source code reasoning model',
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral: Mistral 7B Instruct (free)',
    isFree: true,
    contextLength: 32768,
    description: 'Fast, efficient general instruction model',
  },
];

const PROVIDER_FALLBACK_MODELS: Record<string, AIModelInfo[]> = {
  openrouter: CURATED_OPENROUTER_FREE_MODELS,
  gemini: [
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      isFree: true,
      contextLength: 1048576,
      description: 'Next-gen high speed multimodal model (Recommended)',
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: 'Gemini 2.0 Flash-Lite',
      isFree: true,
      contextLength: 1048576,
      description: 'Cost-effective ultra-fast multimodal model',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      isFree: true,
      contextLength: 1048576,
      description: 'Fast and versatile multimodal model (Free Tier available)',
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      isFree: true,
      contextLength: 2097152,
      description: 'High-intelligence model with 2M token context window',
    },
  ],
  openai: [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      isFree: false,
      contextLength: 128000,
      description: 'Fast, lightweight flagship mini model (Recommended)',
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      isFree: false,
      contextLength: 128000,
      description: 'High-intelligence multimodal flagship model',
    },
    {
      id: 'o3-mini',
      name: 'o3-mini',
      isFree: false,
      contextLength: 128000,
      description: 'Latest high-speed reasoning model',
    },
    {
      id: 'o1-mini',
      name: 'o1-mini',
      isFree: false,
      contextLength: 128000,
      description: 'Fast reasoning model specialized in STEM & code',
    },
  ],
  anthropic: [
    {
      id: 'claude-3-7-sonnet-20250219',
      name: 'Claude 3.7 Sonnet',
      isFree: false,
      contextLength: 200000,
      description: 'Hybrid reasoning & coding state-of-the-art model (Recommended)',
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      isFree: false,
      contextLength: 200000,
      description: 'Industry-leading intelligence and coding performance',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      isFree: false,
      contextLength: 200000,
      description: 'Fast, responsive, and highly cost-effective',
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      isFree: false,
      contextLength: 200000,
      description: 'Deep reasoning on complex analysis tasks',
    },
  ],
  ollama: [
    {
      id: 'qwen2.5:latest',
      name: 'Qwen 2.5',
      isFree: true,
      description: 'Standard high-capability local model',
    },
    {
      id: 'llama3.2:latest',
      name: 'Llama 3.2',
      isFree: true,
      description: 'Lightweight efficient local model',
    },
  ],
  lmstudio: [
    {
      id: 'qwen2.5-coder-7b-instruct',
      name: 'Qwen 2.5 Coder 7B',
      isFree: true,
      description: 'Local code reasoning model',
    },
  ],
};

export const AiSection: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  // Connection state
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    models?: string[];
  } | null>(null);

  // Live real-time models catalog
  const [detailedModels, setDetailedModels] = useState<AIModelInfo[]>(() =>
    PROVIDER_FALLBACK_MODELS[settings.aiProvider] || []
  );
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFilter, setModelFilter] = useState<'all' | 'free'>('free');
  const [modelSearch, setModelSearch] = useState('');
  const [pendingCloudProvider, setPendingCloudProvider] = useState<AIProviderType | null>(null);

  const handleSelectProvider = (providerId: AIProviderType) => {
    const isCloud = ['openrouter', 'gemini', 'openai', 'anthropic', 'custom'].includes(providerId);
    if (isCloud && settings.askBeforeCloudSend) {
      setPendingCloudProvider(providerId);
    } else {
      updateSettings({ aiProvider: providerId });
    }
  };

  const getProviderModel = useCallback((): string => {
    switch (settings.aiProvider) {
      case 'ollama': return settings.ollamaModel || 'qwen2.5:latest';
      case 'lmstudio': return settings.lmstudioModel || 'qwen2.5-coder-7b-instruct';
      case 'openai': return settings.openaiModel || 'gpt-4o-mini';
      case 'gemini': return settings.geminiModel || 'gemini-1.5-flash';
      case 'anthropic': return settings.anthropicModel || 'claude-3-5-haiku-20241022';
      case 'openrouter': return settings.openrouterModel || 'openai/gpt-4o-mini';
      case 'custom': return settings.customModel || '';
      default: return '';
    }
  }, [
    settings.aiProvider,
    settings.ollamaModel,
    settings.lmstudioModel,
    settings.openaiModel,
    settings.geminiModel,
    settings.anthropicModel,
    settings.openrouterModel,
    settings.customModel,
  ]);

  const getProviderBaseUrl = useCallback((): string => {
    switch (settings.aiProvider) {
      case 'ollama': return settings.ollamaUrl || 'http://localhost:11434';
      case 'lmstudio': return settings.lmstudioUrl || 'http://localhost:1234/v1';
      case 'openai': return 'https://api.openai.com/v1';
      case 'gemini': return 'https://generativelanguage.googleapis.com/v1beta/openai';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      case 'openrouter': return 'https://openrouter.ai/api/v1';
      case 'custom': return settings.customApiUrl || '';
      default: return '';
    }
  }, [settings.aiProvider, settings.ollamaUrl, settings.lmstudioUrl, settings.customApiUrl]);

  const getProviderApiKey = useCallback((): string | undefined => {
    switch (settings.aiProvider) {
      case 'openai': return settings.openaiApiKey || undefined;
      case 'gemini': return settings.geminiApiKey || undefined;
      case 'anthropic': return settings.anthropicApiKey || undefined;
      case 'openrouter': return settings.openrouterApiKey || undefined;
      case 'custom': return settings.customApiKey || undefined;
      default: return undefined;
    }
  }, [
    settings.aiProvider,
    settings.openaiApiKey,
    settings.geminiApiKey,
    settings.anthropicApiKey,
    settings.openrouterApiKey,
    settings.customApiKey,
  ]);

  const fetchLiveModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const baseUrl = getProviderBaseUrl();
      const apiKey = getProviderApiKey();

      try {
        const detailed = await aiService.listDetailedModels(
          baseUrl,
          apiKey,
          settings.aiProvider
        );
        if (detailed && detailed.length > 0) {
          const normalized: AIModelInfo[] = detailed.map((m: any) => {
            const isFree =
              m.isFree === true ||
              m.is_free === true ||
              (typeof m.id === 'string' && (m.id.endsWith(':free') || m.id.includes(':free')));
            return {
              id: m.id,
              name: m.name || m.id,
              isFree,
              contextLength: m.contextLength ?? m.context_length,
              description: m.description,
            };
          });
          setDetailedModels(normalized);
          return;
        }
      } catch (errDetailed) {
        console.warn('listDetailedModels failed, trying testConnection fallback:', errDetailed);
      }

      const result = await aiService.testConnection(
        baseUrl,
        apiKey,
        settings.aiProvider,
        getProviderModel()
      );
      if (result.models && result.models.length > 0) {
        const mapped: AIModelInfo[] = result.models.map((m: any) => {
          const id = typeof m === 'string' ? m : m.id || '';
          const name = typeof m === 'string' ? m : m.name || id;
          const isFree =
            m.isFree === true ||
            m.is_free === true ||
            id.endsWith(':free') ||
            id.includes(':free');
          return {
            id,
            name,
            isFree,
            contextLength: m.contextLength ?? m.context_length,
            description: m.description,
          };
        });
        setDetailedModels(mapped);
        return;
      }

      const fallback = PROVIDER_FALLBACK_MODELS[settings.aiProvider] || [];
      if (fallback.length > 0) {
        setDetailedModels(fallback);
      }
    } catch (err) {
      console.warn('Failed to fetch live models:', err);
      const fallback = PROVIDER_FALLBACK_MODELS[settings.aiProvider] || [];
      if (fallback.length > 0) {
        setDetailedModels(fallback);
      }
    } finally {
      setIsLoadingModels(false);
    }
  }, [getProviderBaseUrl, getProviderApiKey, settings.aiProvider, getProviderModel]);

  const testAiConnection = async () => {
    setIsTestingAi(true);
    setTestResult(null);
    try {
      const baseUrl = getProviderBaseUrl();
      const apiKey = getProviderApiKey();

      if (!baseUrl && !['ollama', 'lmstudio'].includes(settings.aiProvider)) {
        setTestResult({ success: false, message: 'No AI provider base URL configured.' });
        return;
      }

      const result = await aiService.testConnection(
        baseUrl,
        apiKey,
        settings.aiProvider,
        getProviderModel()
      );
      setTestResult(result);
      if (result.success) {
        fetchLiveModels();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed.',
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  useEffect(() => {
    let active = true;
    const initialFallback = PROVIDER_FALLBACK_MODELS[settings.aiProvider] || [];
    setDetailedModels(initialFallback);

    if (settings.aiEnabled) {
      const timer = setTimeout(() => {
        if (active) {
          fetchLiveModels();
        }
      }, 300);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }
  }, [
    settings.aiProvider,
    settings.aiEnabled,
    fetchLiveModels,
    settings.geminiApiKey,
    settings.openaiApiKey,
    settings.anthropicApiKey,
    settings.customApiUrl,
    settings.customApiKey,
    settings.ollamaUrl,
    settings.lmstudioUrl,
  ]);

  const isModelFree = useCallback((m: AIModelInfo): boolean => {
    return (
      m.isFree === true ||
      (m as any).is_free === true ||
      (typeof m.id === 'string' && (m.id.endsWith(':free') || m.id.includes(':free')))
    );
  }, []);

  const filteredOpenRouterModels = useMemo(() => {
    return detailedModels.filter((m) => {
      const free = isModelFree(m);
      if (modelFilter === 'free' && !free) return false;
      if (!modelSearch.trim()) return true;
      const q = modelSearch.toLowerCase().trim();
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    });
  }, [detailedModels, modelFilter, modelSearch, isModelFree]);

  const totalOpenRouterCount = detailedModels.length;
  const freeOpenRouterCount = useMemo(
    () => detailedModels.filter(isModelFree).length,
    [detailedModels, isModelFree]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-100">
      {/* Master Switch Card */}
      <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Enable AI Features</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Powers Workbench synthesis recipes, auto-tagging, and contextual summarization.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.aiEnabled}
            onChange={(e) => updateSettings({ aiEnabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/[0.1] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-transparent peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {settings.aiEnabled ? (
        <>
          {/* AI Usage Dashboard */}
          <AiUsageDashboard />

          {/* Select Engine Card */}
          <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-4">
            <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              Select AI Engine
            </div>

            {/* Local vs Cloud Engine selection */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" />
                <span>Local Offline Engines (Air-Gapped &amp; Free)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'lmstudio', name: 'LM Studio / Local OpenAI', port: 'port 1234' },
                  { id: 'ollama', name: 'Ollama Daemon', port: 'port 11434' },
                ].map((p) => {
                  const isSelected = settings.aiProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateSettings({ aiProvider: p.id as AIProviderType })}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/30 shadow-2xs'
                          : 'border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#101014] text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-white/[0.14]'
                      }`}
                    >
                      <div className="font-semibold text-xs">{p.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono mt-0.5">{p.port}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
              <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>Cloud AI Platforms (Requires API Key &amp; Explicit Consent)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'openrouter', name: 'OpenRouter', badge: 'FREE OPTIONS' },
                  { id: 'gemini', name: 'Google Gemini', badge: 'FREE TIER' },
                  { id: 'openai', name: 'OpenAI' },
                  { id: 'anthropic', name: 'Anthropic Claude' },
                  { id: 'custom', name: 'Custom' },
                ].map((p) => {
                  const isSelected = settings.aiProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProvider(p.id as AIProviderType)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-950 dark:text-blue-100 ring-1 ring-blue-500/30 shadow-2xs'
                          : 'border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#101014] text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-white/[0.14]'
                      }`}
                    >
                      {p.badge && (
                        <span className="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded text-[8px] font-bold font-mono bg-emerald-600 text-white">
                          {p.badge}
                        </span>
                      )}
                      <div className="font-semibold text-xs">{p.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cloud Data Transmission Policy Note */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.06] flex items-start gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Privacy &amp; Data Control: </span>
                Velco is local-first. Offline models (Ollama, LM Studio) process everything locally without internet traffic. When using cloud models, only context items explicitly attached to a recipe or chat are transmitted.
              </div>
            </div>
          </div>

          {/* Active Provider Config */}
          <div className="bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] p-5 shadow-2xs space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Configure {settings.aiProvider}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Active Provider
              </span>
            </div>

            {/* OpenRouter */}
            {settings.aiProvider === 'openrouter' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <label className="font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-slate-400" />
                      <span>OpenRouter API Key</span>
                    </label>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      Get Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.openrouterApiKey}
                      onChange={(e) => updateSettings({ openrouterApiKey: e.target.value })}
                      placeholder="sk-or-v1-..."
                      className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Live Models Browser */}
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.07] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      <span>Live Models Catalog</span>
                    </span>
                    <button
                      type="button"
                      onClick={fetchLiveModels}
                      disabled={isLoadingModels}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                      <span>{isLoadingModels ? 'Fetching...' : 'Refresh'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white dark:bg-[#141418] p-0.5 rounded-md border border-slate-200 dark:border-white/[0.08] text-xs">
                      <button
                        type="button"
                        onClick={() => setModelFilter('free')}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                          modelFilter === 'free'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                            : 'text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        Free ({freeOpenRouterCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setModelFilter('all')}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer ${
                          modelFilter === 'all'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                            : 'text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        All ({totalOpenRouterCount})
                      </button>
                    </div>

                    <div className="relative flex-1">
                      <Search className="w-3 h-3 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Filter models by name or id..."
                        className="w-full pl-7 pr-2 py-1 text-xs rounded-md bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto overflow-x-hidden space-y-1 pr-1 custom-scrollbar">
                    {filteredOpenRouterModels.map((m) => {
                      const isSelected = settings.openrouterModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateSettings({ openrouterModel: m.id })}
                          className={`w-full text-left p-2 rounded-md border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
                              : 'border-slate-200 dark:border-white/[0.06] bg-white dark:bg-[#141418] hover:border-slate-300 dark:hover:border-white/[0.12]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs text-slate-900 dark:text-zinc-100 truncate">
                                {m.name}
                              </span>
                              {isModelFree(m) && (
                                <span className="px-1 py-0.2 rounded text-[8px] font-bold font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  FREE
                                </span>
                              )}
                              {formatContextLength(m.contextLength) && (
                                <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500">
                                  {formatContextLength(m.contextLength)}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 truncate">
                              {m.id}
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={settings.openrouterModel}
                      onChange={(e) => updateSettings({ openrouterModel: e.target.value })}
                      placeholder="Custom Model ID"
                      className="w-full px-2.5 py-1 text-xs rounded-md bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.08] font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ollama */}
            {settings.aiProvider === 'ollama' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                    Ollama URL
                  </label>
                  <input
                    type="text"
                    value={settings.ollamaUrl}
                    onChange={(e) => updateSettings({ ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <DynamicModelSelector
                  providerLabel="Ollama"
                  selectedModel={settings.ollamaModel}
                  onSelectModel={(m) => updateSettings({ ollamaModel: m })}
                  models={detailedModels}
                  isLoading={isLoadingModels}
                  onRefresh={fetchLiveModels}
                  hasApiKeyOrUrl={Boolean(settings.ollamaUrl)}
                  apiKeyHelpText="Ensure Ollama is running locally at the URL above to detect installed models."
                />
              </div>
            )}

            {/* LM Studio */}
            {settings.aiProvider === 'lmstudio' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                    LM Studio URL
                  </label>
                  <input
                    type="text"
                    value={settings.lmstudioUrl}
                    onChange={(e) => updateSettings({ lmstudioUrl: e.target.value })}
                    placeholder="http://localhost:1234/v1"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <DynamicModelSelector
                  providerLabel="LM Studio"
                  selectedModel={settings.lmstudioModel}
                  onSelectModel={(m) => updateSettings({ lmstudioModel: m })}
                  models={detailedModels}
                  isLoading={isLoadingModels}
                  onRefresh={fetchLiveModels}
                  hasApiKeyOrUrl={Boolean(settings.lmstudioUrl)}
                  apiKeyHelpText="Ensure LM Studio local server is started (port 1234) to detect loaded models."
                />
              </div>
            )}

            {/* Gemini */}
            {settings.aiProvider === 'gemini' && (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-zinc-300">
                      Google Gemini API Key
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
                    >
                      Get Free Key
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.geminiApiKey}
                      onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] font-mono text-slate-900 dark:text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <DynamicModelSelector
                  providerLabel="Google Gemini"
                  selectedModel={settings.geminiModel}
                  onSelectModel={(m) => updateSettings({ geminiModel: m })}
                  models={detailedModels}
                  isLoading={isLoadingModels}
                  onRefresh={fetchLiveModels}
                  hasApiKeyOrUrl={Boolean(settings.geminiApiKey)}
                  apiKeyHelpText="Enter your Gemini API key above to load live models directly from Google AI Studio."
                />
              </div>
            )}

            {/* OpenAI */}
            {settings.aiProvider === 'openai' && (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-zinc-300">
                      OpenAI API Key
                    </label>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
                    >
                      Get Key
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.openaiApiKey}
                      onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] font-mono text-slate-900 dark:text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <DynamicModelSelector
                  providerLabel="OpenAI"
                  selectedModel={settings.openaiModel}
                  onSelectModel={(m) => updateSettings({ openaiModel: m })}
                  models={detailedModels}
                  isLoading={isLoadingModels}
                  onRefresh={fetchLiveModels}
                  hasApiKeyOrUrl={Boolean(settings.openaiApiKey)}
                  apiKeyHelpText="Enter your OpenAI API key above to load live models from your account."
                />
              </div>
            )}

            {/* Anthropic */}
            {settings.aiProvider === 'anthropic' && (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-zinc-300">
                      Anthropic API Key
                    </label>
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
                    >
                      Get Key
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.anthropicApiKey}
                      onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
                      placeholder="sk-ant-api03-..."
                      className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] font-mono text-slate-900 dark:text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <DynamicModelSelector
                  providerLabel="Anthropic Claude"
                  selectedModel={settings.anthropicModel}
                  onSelectModel={(m) => updateSettings({ anthropicModel: m })}
                  models={detailedModels}
                  isLoading={isLoadingModels}
                  onRefresh={fetchLiveModels}
                  hasApiKeyOrUrl={Boolean(settings.anthropicApiKey)}
                  apiKeyHelpText="Enter your Anthropic API key above to load live Claude models."
                />
              </div>
            )}

            {/* Custom */}
            {settings.aiProvider === 'custom' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                      Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={settings.customApiUrl}
                      onChange={(e) => updateSettings({ customApiUrl: e.target.value })}
                      placeholder="https://api.groq.com/openai/v1"
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] font-mono text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 dark:text-zinc-300 block mb-1">
                      API Key (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.customApiKey}
                        onChange={(e) => updateSettings({ customApiKey: e.target.value })}
                        placeholder="Bearer key if required..."
                        className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-50 dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] font-mono text-slate-900 dark:text-zinc-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <DynamicModelSelector
                  providerLabel="Custom API"
                  selectedModel={settings.customModel}
                  onSelectModel={(m) => updateSettings({ customModel: m })}
                  models={detailedModels}
                  isLoading={isLoadingModels}
                  onRefresh={fetchLiveModels}
                  hasApiKeyOrUrl={Boolean(settings.customApiUrl)}
                  apiKeyHelpText="Enter your custom OpenAI-compatible endpoint URL above to discover available models."
                />
              </div>
            )}

            {/* Connection Test Action */}
            <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <button
                type="button"
                onClick={testAiConnection}
                disabled={isTestingAi}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingAi ? 'animate-spin' : ''}`} />
                <span>{isTestingAi ? 'Testing...' : 'Test Connection'}</span>
              </button>
              <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-500" />
                <span>Keys stored locally</span>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg flex items-start gap-2 text-xs ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800/50'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">
                    {testResult.success ? 'Operational' : 'Failed'}
                  </div>
                  <div className="text-[11px] opacity-90">{testResult.message}</div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.07] space-y-2">
          <Cpu className="w-8 h-8 text-slate-400 dark:text-zinc-600 mx-auto" />
          <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            AI Features Disabled
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 max-w-xs mx-auto">
            Enable the switch above to connect local offline models or cloud frontier APIs.
          </p>
        </div>
      )}

      {/* Cloud Data Transmission Consent Modal */}
      <CloudConsentModal
        isOpen={pendingCloudProvider !== null}
        provider={pendingCloudProvider || ''}
        onConfirm={() => {
          if (pendingCloudProvider) {
            updateSettings({ aiProvider: pendingCloudProvider });
            setPendingCloudProvider(null);
          }
        }}
        onCancel={() => setPendingCloudProvider(null)}
      />
    </div>
  );
};
