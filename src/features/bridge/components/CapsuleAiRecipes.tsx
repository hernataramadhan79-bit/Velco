import React from 'react';
import {
  Sparkles,
  CheckSquare,
  Layers,
  Save,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { MarkdownViewer } from '../../../components/common/MarkdownViewer';

interface CapsuleAiRecipesProps {
  capsuleItemsCount: number;
  aiEnabled: boolean;
  isGeneratingRecipe: boolean;
  activeRecipeKey: string | null;
  activeRecipeTitle: string;
  recipeOutput: string | null;
  copiedRecipe: boolean;
  onEnableAi: () => void;
  onRunRecipe: (recipeKey: 'synthesize' | 'matrix' | 'audit') => void;
  onSaveRecipeAsNote: () => void;
  onCopyRecipe: (text: string) => void;
}

export const CapsuleAiRecipes: React.FC<CapsuleAiRecipesProps> = ({
  capsuleItemsCount,
  aiEnabled,
  isGeneratingRecipe,
  activeRecipeKey,
  activeRecipeTitle,
  recipeOutput,
  copiedRecipe,
  onEnableAi,
  onRunRecipe,
  onSaveRecipeAsNote,
  onCopyRecipe,
}) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 space-y-5 max-w-4xl">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
          Capsule Intelligence
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Synthesize the {capsuleItemsCount} items in this capsule to produce structured overviews and action matrices.
        </p>
      </div>

      {!aiEnabled ? (
        <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Processing Disabled</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Enable AI in Settings or click below to enable local AI models for context processing.
          </p>
          <button
            onClick={onEnableAi}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Enable AI Features</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => onRunRecipe('synthesize')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer group ${
              activeRecipeKey === 'synthesize' && isGeneratingRecipe
                ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-500/20'
                : 'border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-blue-400'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Multi-Perspective Synthesis
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Synthesize tasks and briefs into a consolidated executive action plan.
            </p>
          </div>

          <div
            onClick={() => onRunRecipe('matrix')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer group ${
              activeRecipeKey === 'matrix' && isGeneratingRecipe
                ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-500/20'
                : 'border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-emerald-400'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
              <CheckSquare className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              Action &amp; Decision Matrix
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Extract structured decision tables, status, and owner impacts.
            </p>
          </div>

          <div
            onClick={() => onRunRecipe('audit')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer group ${
              activeRecipeKey === 'audit' && isGeneratingRecipe
                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20'
                : 'border-slate-200 dark:border-white/[0.07] bg-slate-50/50 dark:bg-[#141418] hover:border-indigo-400'
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              Integrity &amp; Risk Audit
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Detect contradictions between tasks, verify containment, and check completeness.
            </p>
          </div>
        </div>
      )}

      {/* Progress state */}
      {isGeneratingRecipe && (
        <div className="p-6 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 text-center space-y-2 animate-pulse">
          <Sparkles className="w-5 h-5 text-blue-500 mx-auto animate-spin" />
          <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Running {activeRecipeTitle}...
          </div>
        </div>
      )}

      {/* Output Result */}
      {recipeOutput && !isGeneratingRecipe && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#141418] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/[0.07]">
            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              {activeRecipeTitle || 'Analysis Result'}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={onSaveRecipeAsNote}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer"
                title="Save as Note in this Capsule"
              >
                <Save className="w-3 h-3" />
                <span>Save to Capsule</span>
              </button>

              <button
                onClick={() => onCopyRecipe(recipeOutput)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                {copiedRecipe ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
            <MarkdownViewer content={recipeOutput} />
          </div>
        </div>
      )}
    </div>
  );
};
