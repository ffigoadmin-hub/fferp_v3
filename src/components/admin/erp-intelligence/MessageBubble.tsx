import { cn } from '@/lib/utils';
import { Bot, User, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn(
      "flex gap-3 group animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
      isAssistant ? "justify-start" : "justify-end"
    )}>
      {isAssistant && (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 relative",
        isAssistant 
          ? "bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm" 
          : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
      )}>
        {isAssistant ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-3 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-3 text-foreground border-b border-border/50 pb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-2 text-foreground">{children}</h3>,
                code: ({ children, className }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-muted/80 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                  ) : (
                    <code className="block bg-muted/80 p-3 rounded-lg text-sm font-mono overflow-x-auto">{children}</code>
                  );
                },
                pre: ({ children }) => <pre className="bg-muted/80 p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-3 border-primary/50 pl-4 italic text-muted-foreground mb-3">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full border-collapse text-sm">{children}</table>
                  </div>
                ),
                th: ({ children }) => <th className="border border-border/50 px-3 py-2 bg-muted/50 font-semibold text-left">{children}</th>,
                td: ({ children }) => <td className="border border-border/50 px-3 py-2">{children}</td>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}
      </div>
      {!isAssistant && (
        <div className="w-9 h-9 rounded-xl bg-muted/80 flex items-center justify-center flex-shrink-0 ring-1 ring-border/50">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
