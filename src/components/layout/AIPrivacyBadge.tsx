import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '../../stores/settingsStore';
import { aiService } from '../../services/ai';

export const AIPrivacyBadge: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const inFlightRef = useRef(false);

  const isLocal = ['ollama', 'lmstudio'].includes(settings.aiProvider);
  const providerLabel = settings.aiProvider === 'none' ? 'None' : settings.aiProvider.charAt(0).toUpperCase() + settings.aiProvider.slice(1);

  const getBaseUrl = (): string => {
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

  const getApiKey = (): string | undefined => {
    switch (settings.aiProvider) {
      case 'openai': return settings.openaiApiKey || undefined;
      case 'gemini': return settings.geminiApiKey || undefined;
      case 'anthropic': return settings.anthropicApiKey || undefined;
      case 'openrouter': return settings.openrouterApiKey || undefined;
      case 'custom': return settings.customApiKey || undefined;
      default: return undefined;
    }
  };

  const checkConnection = useCallback(async () => {
    if (!settings.aiEnabled || settings.aiProvider === 'none') {
      setIsOnline(false);
      setIsChecking(false);
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsChecking(true);

    try {
      const available = await aiService.checkStatus(getBaseUrl(), getApiKey());
      setIsOnline(available);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
      inFlightRef.current = false;
    }
  }, [settings.aiEnabled, settings.aiProvider]);

  useEffect(() => {
    if (!settings.aiEnabled || settings.aiProvider === 'none') {
      setIsOnline(false);
      setIsChecking(false);
      return;
    }

    checkConnection();

    if (isLocal) {
      const interval = setInterval(() => {
        if (!document.hidden) {
          checkConnection();
        }
      }, 2500);

      const handleFocus = () => checkConnection();
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
      };
    }
  }, [checkConnection, settings.aiEnabled, isLocal, settings.aiProvider]);

  const handleToggle = () => {
    updateSettings({ aiEnabled: !settings.aiEnabled });
  };

  if (!settings.aiEnabled || settings.aiProvider === 'none') {
    return (
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 transition-colors cursor-pointer"
        title="AI enhancement is disabled. Click to turn ON."
      >
        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
        <span>AI: Disabled</span>
      </button>
    );
  }

  // Cloud AI styling
  if (!isLocal) {
    if (isChecking && isOnline === null) {
      return (
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 transition-colors cursor-pointer"
          title={`Validating ${providerLabel} credentials... Click to turn OFF.`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
          <span>Connecting {providerLabel}...</span>
        </button>
      );
    }

    if (isOnline) {
      return (
        <button
          onClick={handleToggle}
          className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 transition-colors cursor-pointer"
          title={`Cloud AI active (${providerLabel}). Click to turn OFF.`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)] shrink-0" />
          <span>Cloud AI: {providerLabel}</span>
        </button>
      );
    }

    return (
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors cursor-pointer"
        title={`API key required or authentication failed for ${providerLabel}. Click to toggle.`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
        <span>Cloud AI: Key Required</span>
      </button>
    );
  }

  // Local AI styling
  if (isChecking && isOnline === null) {
    return (
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
        title={`Connecting to ${providerLabel}... Click to turn OFF.`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
        <span>Connecting {providerLabel}...</span>
      </button>
    );
  }

  if (isOnline) {
    return (
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 transition-colors cursor-pointer"
        title={`Local AI connected (${providerLabel}). Click to turn OFF.`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] shrink-0" />
        <span>Local AI: {providerLabel}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50/60 hover:bg-rose-100/60 dark:bg-slate-900 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
      title={`Cannot reach ${providerLabel}. Ensure local engine is running.`}
    >
      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
      <span>AI Offline ({providerLabel})</span>
    </button>
  );
};
