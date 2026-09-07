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
  badgeIcon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  badgeIcon: BadgeIcon,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center view-enter select-none ${className}`}
    >
      {/* Icon Badge */}
      <div className="relative mb-3.5">
        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-500 dark:text-zinc-400 shadow-xs">
          <Icon className="w-5 h-5 stroke-[1.5]" />
        </div>
        {BadgeIcon && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.12] flex items-center justify-center text-slate-600 dark:text-zinc-300 shadow-xs">
            <BadgeIcon className="w-2.5 h-2.5" />
          </div>
        )}
        {!BadgeIcon && badge && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-[#141418] border border-slate-200 dark:border-white/[0.12] flex items-center justify-center text-slate-600 dark:text-zinc-300 shadow-xs">
            {badge}
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1 tracking-tight">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <div className="text-xs text-slate-500 dark:text-zinc-500 max-w-sm leading-relaxed font-mono">
          {description}
        </div>
      )}

      {/* Action CTA Button */}
      {action && (
        <div className="mt-4">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] dark:text-zinc-100 dark:border-white/[0.08] text-xs font-mono transition-all cursor-pointer shadow-xs"
          >
            {action.icon && <action.icon className="w-3 h-3 stroke-[1.5]" />}
            <span>{action.label}</span>
          </button>
        </div>
      )}
    </div>
  );
};
