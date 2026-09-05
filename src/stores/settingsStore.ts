import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';

import { useState, useEffect } from 'react';

const SETTINGS_KEY = 'velco_settings_v1';
const LEGACY_SETTINGS_KEY = 'lifeinbox_settings_v1';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        aiEnabled: typeof parsed.aiEnabled === 'boolean' ? parsed.aiEnabled : DEFAULT_SETTINGS.aiEnabled,
      };
    }
  } catch {
    // fallback
  }
  return DEFAULT_SETTINGS;
}

let currentSettings: AppSettings = loadSettings();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Settings listener error:', err);
    }
  });
}

export function saveSettings(settings: AppSettings) {
  try {
    currentSettings = settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    applyTheme(settings.theme);
    notifyListeners();
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

export function updateSettings(updates: Partial<AppSettings>) {
  const next = { ...currentSettings, ...updates };
  saveSettings(next);
  return next;
}

export function applyTheme(theme: 'system' | 'light' | 'dark') {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

// React Hook for settings — fully synchronized across all components in real-time
export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    setSettingsState(currentSettings);

    const handleChange = () => {
      setSettingsState(currentSettings);
    };
    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if (settings.theme === 'system') {
        applyTheme('system');
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [settings.theme]);

  return { settings, updateSettings };
}

