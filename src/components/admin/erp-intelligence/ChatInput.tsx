import { useRef, useEffect } from 'react';
import { Send, Loader2, Mic, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isLoading, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  return (
    <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm p-4">
      <div className="max-w-4xl mx-auto">
        <div className={cn(
          "relative flex items-end gap-2 p-2 rounded-2xl border bg-card/50 shadow-sm transition-all duration-200",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50"
        )}>
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about attendance, payments, escalations, projects..."
              className={cn(
                "min-h-[44px] max-h-[150px] resize-none border-0 bg-transparent shadow-none",
                "focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60",
                "py-3 px-2"
              )}
              rows={1}
              disabled={isLoading || disabled}
            />
          </div>
          
          <div className="flex items-center gap-1 pb-1">
            <Button 
              type="button" 
              size="icon" 
              variant="ghost"
              disabled={isLoading || disabled}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Mic className="h-4 w-4" />
            </Button>
            
            <Button 
              type="submit" 
              size="icon" 
              disabled={!value.trim() || isLoading || disabled}
              onClick={onSubmit}
              className={cn(
                "h-10 w-10 rounded-xl transition-all duration-200",
                value.trim() && !isLoading 
                  ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" 
                  : "bg-muted"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground/60">
          <Sparkles className="h-3 w-3" />
          <span>AI-powered insights • Read-only access • Your data stays secure</span>
        </div>
      </div>
    </div>
  );
}
