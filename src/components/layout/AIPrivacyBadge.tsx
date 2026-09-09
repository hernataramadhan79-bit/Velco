import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '../../stores/settingsStore';
import { aiService } from '../../services/ai';

const getBaseUrl = (settings: any): string => {
  switch (settings.aiProvider) {
    case 'ollama':
      return settings.ollamaUrl || 'http://localhost:11434';
    case 'lmstudio':
      return settings.lmstudioUrl || 'http://localhost:1234/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta/openai';
    case 'anthropic':
      return 'https://api.anthropic.com/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'custom':
      return settings.customApiUrl || '';
    default:
      return '';
  }
};

const getApiKey = (settings: any): string | undefined => {
  switch (settings.aiProvider) {
    case 'openai':
      return settings.openaiApiKey || undefined;
    case 'gemini':
      return settings.geminiApiKey || undefined;
    case 'anthropic':
      return settings.anthropicApiKey || undefined;
    case 'openrouter':
      return settings.openrouterApiKey || undefined;
    case 'custom':
      return settings.customApiKey || undefined;
    default:
      return undefined;
  }
};

export const AIPrivacyBadge: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const inFlightRef = useRef(false);

  const isLocal = ['ollama', 'lmstudio'].includes(settings.aiProvider);
  const providerLabel =
    settings.aiProvider === 'none'
      ? 'None'
      : settings.aiProvider === 'ollama'
      ? 'Ollama'
      : settings.aiProvider === 'lmstudio'
      ? 'LM Studio'
      : settings.aiProvider.charAt(0).toUpperCase() + settings.aiProvider.slice(1);

  const activeModel = isLocal
    ? settings.aiProvider === 'ollama'
      ? settings.ollamaModel || 'qwen2.5:latest'
      : settings.lmstudioModel || 'qwen2.5-coder'
    : settings.aiProvider === 'openai'
    ? settings.openaiModel || 'gpt-4o-mini'
    : settings.aiProvider === 'gemini'
    ? settings.geminiModel || 'gemini-1.5-flash'
    : settings.aiProvider === 'openrouter'
    ? settings.openrouterModel || 'openai/gpt-4o-mini'
    : settings.customModel || 'custom-model';

  const checkConnection = useCallback(async () => {
    if (!settings.aiEnabled || settings.aiProvider === 'none') {
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const available = await aiService.checkStatus(getBaseUrl(settings), getApiKey(settings));
      setIsOnline(available);
    } catch {
      setIsOnline(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [settings]);

  useEffect(() => {
    if (!settings.aiEnabled || settings.aiProvider === 'none') {
      return;
    }

    const timer = setTimeout(() => {
      checkConnection();
    }, 0);

    if (isLocal) {
      const interval = setInterval(() => {
        if (!document.hidden) {
          checkConnection();
        }
      }, 3000);

      const handleFocus = () => checkConnection();
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
      };
    }

    return () => {
      clearTimeout(timer);
    };
  }, [checkConnection, settings.aiEnabled, isLocal, settings.aiProvider]);

  const handleToggle = () => {
    updateSettings({ aiEnabled: !settings.aiEnabled });
  };

  if (!settings.aiEnabled || settings.aiProvider === 'none') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 dark:bg-[#141418] dark:hover:bg-[#1a1a20] dark:text-zinc-500 dark:hover:text-zinc-300 border border-slate-200 dark:border-white/[0.07] transition-all cursor-pointer"
        title="AI engine is disabled. Click to turn ON."
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-600 shrink-0" />
        <span>AI Off</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
        isOnline === false
          ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 dark:bg-[#141418] dark:hover:bg-[#1a1a20] dark:text-rose-400 dark:border-rose-500/20'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#141418] dark:hover:bg-[#1a1a20] dark:text-zinc-300 border-slate-200 dark:border-white/[0.07]'
      }`}
      title={
        isOnline === false
          ? `AI Offline (${providerLabel}). Cannot connect to ${getBaseUrl(settings)}. Click to toggle.`
          : `Engine: ${providerLabel} • Model: ${activeModel} (${isLocal ? '100% Local Inference' : 'Cloud'}). Click to toggle.`
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          isOnline === false
            ? 'bg-rose-500'
            : isLocal
            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
            : 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]'
        }`}
      />
      <span className="text-slate-500 dark:text-zinc-400 truncate max-w-[70px] sm:max-w-[90px]">
        {providerLabel}:
      </span>
      <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[100px] sm:max-w-[140px]">
        {isOnline === false ? 'Offline' : activeModel}
      </span>
    </button>
  );
};
