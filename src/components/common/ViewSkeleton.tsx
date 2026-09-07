import React from 'react';

/**
 * Shimmer skeleton placeholder shown while views are being lazy-loaded.
 * Used as the Suspense fallback for code-split view components.
 */
export const ViewSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto px-8 py-6 space-y-6 view-enter">
      {/* Title skeleton */}
      <div className="space-y-3">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>

      {/* Card skeleton rows */}
      <div className="space-y-3 pt-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white/50 dark:bg-[#141418]/40"
          >
            <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-3/5" />
              <div className="skeleton h-3 w-2/5" />
            </div>
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
};
