import { Bot, Loader2, Database, Brain, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LoadingStage } from '@/hooks/useERPIntelligence';

interface TypingIndicatorProps {
  stage?: LoadingStage;
}

const stageConfig = {
  idle: { text: '', icon: Loader2 },
  connecting: { text: 'Connecting to AI...', icon: Zap },
  analyzing: { text: 'Analyzing your query...', icon: Brain },
  fetching: { text: 'Fetching ERP data...', icon: Database },
  generating: { text: 'Generating response...', icon: Loader2 }
};

export function TypingIndicator({ stage = 'generating' }: TypingIndicatorProps) {
  const config = stageConfig[stage] || stageConfig.generating;
  const StageIcon = config.icon;

  return (
    <div className="flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <StageIcon className={cn(
            "h-4 w-4 text-primary",
            stage !== 'idle' && "animate-spin"
          )} />
          <span className="text-sm text-muted-foreground">{config.text}</span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span 
                key={i}
                className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-muted flex-shrink-0" />
      <div className="flex-1 space-y-2 max-w-[70%]">
        <div className="h-4 bg-muted rounded-lg w-3/4" />
        <div className="h-4 bg-muted rounded-lg w-1/2" />
        <div className="h-4 bg-muted rounded-lg w-5/6" />
      </div>
    </div>
  );
}
