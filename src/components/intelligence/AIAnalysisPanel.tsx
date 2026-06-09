import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Brain,
  Building2,
  Users,
  Lightbulb,
  LayoutGrid,
  Copy,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useIntelligenceAI, AnalysisType } from '@/hooks/useIntelligenceAI';
import { UnifiedActivity } from '@/hooks/useUnifiedWorkAnalytics';

interface AIAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activities: UnifiedActivity[];
  date: string;
}

const analysisTypes: { type: AnalysisType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: 'overview', label: 'Overview', icon: <LayoutGrid className="w-4 h-4" />, description: 'Organization-wide summary' },
  { type: 'department', label: 'Departments', icon: <Building2 className="w-4 h-4" />, description: 'Department breakdown' },
  { type: 'individuals', label: 'Individuals', icon: <Users className="w-4 h-4" />, description: 'Top & bottom performers' },
  { type: 'recommendations', label: 'Actions', icon: <Lightbulb className="w-4 h-4" />, description: 'Improvement suggestions' },
];

export function AIAnalysisPanel({ isOpen, onClose, activities, date }: AIAnalysisPanelProps) {
  const [activeType, setActiveType] = useState<AnalysisType>('overview');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { response, isLoading, loadingStage, error, analyze, clearResponse } = useIntelligenceAI();

  // Auto-analyze on open
  useEffect(() => {
    if (isOpen && activities.length > 0 && !response && !isLoading) {
      analyze(activities, 'overview', date);
    }
  }, [isOpen, activities, date]);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current && response) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response]);

  const handleAnalysisTypeChange = (type: AnalysisType) => {
    if (type !== activeType) {
      setActiveType(type);
      clearResponse();
      analyze(activities, type, date);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">AI Analysis</h2>
                  <p className="text-xs text-muted-foreground">{activities.length} employees analyzed</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Analysis Type Tabs */}
            <div className="p-3 border-b border-border">
              <div className="grid grid-cols-4 gap-2">
                {analysisTypes.map(({ type, label, icon }) => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAnalysisTypeChange(type)}
                    disabled={isLoading}
                    className={cn(
                      'flex flex-col gap-1 h-auto py-2 rounded-lg transition-all',
                      activeType === type
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    {icon}
                    <span className="text-[10px] font-medium">{label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {error && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  {error}
                </div>
              )}

              {isLoading && !response && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm">{loadingStage || 'Analyzing...'}</span>
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              )}

              {response && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="prose prose-sm prose-invert max-w-none"
                >
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mb-3">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h3>,
                      p: ({ children }) => <p className="text-muted-foreground mb-2 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-muted-foreground">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-muted-foreground">{children}</ol>,
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-3">
                          <table className="w-full text-sm border-collapse">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-muted/30">{children}</thead>,
                      th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold text-foreground">{children}</th>,
                      td: ({ children }) => <td className="border border-border px-3 py-2 text-muted-foreground">{children}</td>,
                      code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary">{children}</code>,
                    }}
                  >
                    {response}
                  </ReactMarkdown>
                  
                  {isLoading && (
                    <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                  )}
                </motion.div>
              )}

              {!isLoading && !response && !error && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Ready to Analyze</h3>
                  <p className="text-sm text-muted-foreground">Select an analysis type above to get AI-powered insights</p>
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            {response && !isLoading && (
              <div className="p-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="w-full gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-primary" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Analysis
                    </>
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
