import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, ShieldAlert, Shield, Globe } from 'lucide-react';
import { useSettings } from '../../stores/settingsStore';
import { aiService } from '../../services/ai';

const getBaseUrl = (settings: any): string => {
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
};

const getApiKey = (settings: any): string | undefined => {
  switch (settings.aiProvider) {
    case 'openai': return settings.openaiApiKey || undefined;
    case 'gemini': return settings.geminiApiKey || undefined;
    case 'anthropic': return settings.anthropicApiKey || undefined;
    case 'openrouter': return settings.openrouterApiKey || undefined;
    case 'custom': return settings.customApiKey || undefined;
    default: return undefined;
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
      : settings.aiProvider.charAt(0).toUpperCase() + settings.aiProvider.slice(1);

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
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 dark:bg-[#141418] dark:hover:bg-[#1a1a20] dark:text-zinc-500 dark:hover:text-zinc-400 border border-slate-200 dark:border-white/[0.06] transition-colors cursor-pointer"
        title="AI enhancement is disabled. Click to turn ON."
      >
        <Shield className="w-3 h-3 text-slate-400 dark:text-zinc-600 stroke-[1.75]" />
        <span>AI Disabled</span>
      </button>
    );
  }

  // Local AI telemetry
  if (isLocal) {
    if (isOnline) {
      return (
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#141418] dark:hover:bg-[#1a1a20] dark:text-zinc-300 border border-slate-200 dark:border-white/[0.07] transition-all cursor-pointer group"
          title={`100% on-device private inference via ${providerLabel}. No user notes or embeddings are transmitted to external servers. Click to toggle.`}
        >
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[1.75] shrink-0" />
          <span className="text-slate-600 group-hover:text-slate-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">100% Local Inference</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] shrink-0 ml-0.5" />
        </button>
      );
    }

    return (
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-[#141418] dark:hover:bg-[#1a1a20] dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 transition-all cursor-pointer"
        title={`Cannot reach ${providerLabel} at ${getBaseUrl(settings)}. Ensure local model engine is running. Click to toggle.`}
      >
        <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400 stroke-[1.75] shrink-0" />
        <span className="text-rose-600 dark:text-rose-400">AI Offline ({providerLabel})</span>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 ml-0.5" />
      </button>
    );
  }

  // Cloud AI telemetry
  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-slate-100 hover:bg-slate-200 dark:bg-[#141418] dark:hover:bg-[#1a1a20] border transition-all cursor-pointer group ${
        isOnline
          ? 'text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.07]'
          : 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/20 bg-amber-50 dark:bg-[#141418]'
      }`}
      title={
        isOnline
          ? `Cloud inference via ${providerLabel}. Click to toggle.`
          : `API key or connection required for ${providerLabel}. Click to toggle.`
      }
    >
      <Globe className="w-3 h-3 text-blue-600 dark:text-blue-400 stroke-[1.75] shrink-0" />
      <span className="text-slate-600 group-hover:text-slate-900 dark:text-zinc-400 dark:group-hover:text-zinc-200">Cloud AI: {providerLabel}</span>
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ml-0.5 ${
          isOnline
            ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]'
            : 'bg-amber-500'
        }`}
      />
    </button>
  );
};
