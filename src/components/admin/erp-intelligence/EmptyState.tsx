import { Bot, Sparkles } from 'lucide-react';
import { QuickPrompts } from './QuickPrompts';

interface EmptyStateProps {
  onQuickPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function EmptyState({ onQuickPrompt, disabled }: EmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in fade-in-0 duration-500">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/20">
          <Bot className="h-10 w-10 text-primary" />
        </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </div>
      </div>
      
      <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
        ERP Intelligence Assistant
      </h2>
      <p className="text-muted-foreground mb-8 max-w-lg leading-relaxed">
        Ask me anything about your ERP data. I can provide attendance summaries, 
        payment insights, escalation statistics, project health, and software improvement recommendations.
      </p>
      
      <QuickPrompts onSelect={onQuickPrompt} disabled={disabled} />
      
      <p className="text-xs text-muted-foreground/70 mt-8">
        Powered by AI with read-only access to your ERP database
      </p>
    </div>
  );
}
