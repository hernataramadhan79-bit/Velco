import React, { useState } from 'react';
import { aiService } from '../../services/ai';
import { ShieldAlert, Globe, Server, Check, X } from 'lucide-react';

interface CloudConsentModalProps {
  isOpen: boolean;
  provider: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CloudConsentModal: React.FC<CloudConsentModalProps> = ({
  isOpen,
  provider,
  onConfirm,
  onCancel,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await aiService.grantCloudConsent(provider.toLowerCase());
      onConfirm();
    } catch (err) {
      console.warn('Failed to record cloud consent:', err);
      onConfirm(); // Proceed anyway
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Cloud Data Transmission Consent
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                Target: {provider}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">
            You are about to route contextual items through an external cloud AI endpoint (<strong className="text-slate-900 dark:text-white capitalize">{provider}</strong>).
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                <Server className="w-3.5 h-3.5" />
                <span>Local AI (Offline)</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-tight">
                100% private. Staged items never leave your device.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-blue-800 dark:text-blue-300">
                <Globe className="w-3.5 h-3.5" />
                <span>Cloud AI (External)</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-tight">
                Transmits staged notes &amp; prompts over HTTPS to {provider}.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-600 dark:text-zinc-400 leading-normal">
              I understand that staged items will be sent to external third-party servers and grant consent for this session.
            </span>
          </label>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 dark:bg-[#101014] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel / Keep Local
          </button>
          <button
            type="button"
            disabled={!acknowledged || isSubmitting}
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>I Understand &amp; Consent</span>
          </button>
        </div>
      </div>
    </div>
  );
};
