import React from 'react';
import { LandingHeroAiChat } from '../../components/chat/LandingHeroAiChat';

interface PlaygroundViewProps {
  onOpenSettings?: () => void;
  onArtifactCreated?: (msg: string) => void;
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({
  onOpenSettings,
  onArtifactCreated,
}) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-12 min-w-0">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100 tracking-tight">
            Local Playground
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Interactive multi-turn LLM workspace with local context injection.
          </p>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
          Playground Canvas
        </span>
      </div>

      <LandingHeroAiChat
        onOpenSettings={onOpenSettings}
        onArtifactCreated={onArtifactCreated}
      />
    </div>
  );
};
