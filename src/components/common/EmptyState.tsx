import React from 'react';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
  badge?: string;
  className?: string;
}

/**
 * Polished, illustrated EmptyState component for clean onboarding and helpful UX guidance.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  badge = '✨',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center view-enter ${className}`}
    >
      {/* Illustrated Icon Badge */}
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-indigo-50/60 dark:from-slate-800/80 dark:to-indigo-950/40 flex items-center justify-center text-slate-400 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <Icon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
        </div>
        {badge && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-900 flex items-center justify-center shadow-xs">
            <span className="text-[10px] leading-none">{badge}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5 tracking-tight">
        {title}
      </h3>

      {/* Description / Instructions */}
      {description && (
        <div className="text-xs text-slate-400 dark:text-slate-400 max-w-sm leading-relaxed">
          {description}
        </div>
      )}

      {/* Optional Action CTA Button */}
      {action && (
        <div className="mt-4">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-98"
          >
            {action.icon && <action.icon className="w-3.5 h-3.5" />}
            <span>{action.label}</span>
          </button>
        </div>
      )}
    </div>
  );
};
