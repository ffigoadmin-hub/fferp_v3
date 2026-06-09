import { useState, useRef, useEffect } from 'react';
import { useERPIntelligence, ChatPurpose } from '@/hooks/useERPIntelligence';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import {
  Trash2,
  Sparkles,
  Plus,
  MessageSquare,
  Settings,
  ShieldCheck,
  Users,
  Briefcase,
  Search,
  LayoutGrid
} from 'lucide-react';
import { MessageBubble } from '@/components/admin/erp-intelligence/MessageBubble';
import { TypingIndicator, MessageSkeleton } from '@/components/admin/erp-intelligence/TypingIndicator';
import { EmptyState } from '@/components/admin/erp-intelligence/EmptyState';
import { ChatInput } from '@/components/admin/erp-intelligence/ChatInput';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PURPOSE_CONFIG: Record<ChatPurpose, { label: string; icon: any; color: string; desc: string }> = {
  general: {
    label: 'General Assistant',
    icon: Sparkles,
    color: 'from-blue-500 to-indigo-600',
    desc: 'All-purpose ERP insights'
  },
  auditor: {
    label: 'Financial Auditor',
    icon: ShieldCheck,
    color: 'from-emerald-500 to-teal-600',
    desc: 'Audit payments & vendors'
  },
  operations: {
    label: 'HR & Ops Specialist',
    icon: Users,
    color: 'from-orange-500 to-red-600',
    desc: 'Attendance & compliance'
  },
  projects: {
    label: 'Project Orchestrator',
    icon: Briefcase,
    color: 'from-purple-500 to-pink-600',
    desc: 'Project health & tracking'
  }
};

export default function ERPIntelligencePage() {
  const {
    conversations,
    activeId,
    currentConversation,
    messages,
    isLoading,
    loadingStage,
    setActiveId,
    createConversation,
    deleteConversation,
    sendMessage
  } = useERPIntelligence();

  const [input, setInput] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => setIsInitialLoad(false), 300);
      return () => clearTimeout(timer);
    }
    setIsInitialLoad(false);
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading && activeId) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleCreateChat = (purpose: ChatPurpose) => {
    const title = `${PURPOSE_CONFIG[purpose].label} - ${new Date().toLocaleDateString()}`;
    createConversation(purpose, title);
  };

  const activePurpose = currentConversation?.purpose || 'general';
  const config = PURPOSE_CONFIG[activePurpose];

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-border/50 flex flex-col bg-muted/10">
        <div className="p-4 border-b border-border/50 bg-background/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-full gap-2 shadow-sm" size="default">
                <Plus className="h-4 w-4" />
                New Focused Chat
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-2">
              {(Object.keys(PURPOSE_CONFIG) as ChatPurpose[]).map((purpose) => {
                const item = PURPOSE_CONFIG[purpose];
                return (
                  <DropdownMenuItem
                    key={purpose}
                    onClick={() => handleCreateChat(purpose)}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <div className={cn("p-1.5 rounded-md bg-gradient-to-br text-white", item.color)}>
                        <item.icon className="h-3.5 w-3.5" />
                      </div>
                      {item.label}
                    </div>
                    <span className="text-xs text-muted-foreground pl-7">{item.desc}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            <h2 className="px-2 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Conversations
            </h2>
            {conversations.length === 0 ? (
              <div className="px-3 py-8 text-center bg-muted/5 rounded-lg border border-dashed border-border/50">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground italic">No conversations yet</p>
              </div>
            ) : (
              conversations.map((chat) => {
                const chatConfig = PURPOSE_CONFIG[chat.purpose];
                return (
                  <div key={chat.id} className="group relative flex items-center gap-1">
                    <button
                      onClick={() => setActiveId(chat.id)}
                      className={cn(
                        "flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm group-hover:bg-muted/80",
                        activeId === chat.id
                          ? "bg-primary/10 text-primary font-medium border border-primary/20"
                          : "text-muted-foreground"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        activeId === chat.id ? "bg-primary" : "bg-muted-foreground/30"
                      )} />
                      <div className="flex-1 text-left truncate">
                        {chat.title}
                        <div className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
                          <chatConfig.icon className="h-2.5 w-2.5" />
                          {chatConfig.label}
                        </div>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(chat.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-background/50">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/5 text-primary text-xs">
            <LayoutGrid className="h-4 w-4" />
            <span>Admin Control Center</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-background to-muted/20 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg transition-all duration-500",
              config.color
            )}>
              <config.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{config.label}</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{config.desc}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span className="text-xs text-primary/80 font-medium">Ready for insights</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted/80 border border-border/50 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              <span className="text-xs font-semibold">Gemini 3 Pro</span>
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 relative overflow-hidden">
          {!activeId ? (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <div className="max-w-md space-y-4 animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Welcome to ERP Intelligence</h2>
                <p className="text-muted-foreground">
                  Select a category to start a specialized data analysis or create a new general insight session.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-8">
                  <Button variant="outline" onClick={() => handleCreateChat('auditor')} className="h-auto py-4 flex flex-col gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <span>Audit Data</span>
                  </Button>
                  <Button variant="outline" onClick={() => handleCreateChat('operations')} className="h-auto py-4 flex flex-col gap-2">
                    <Users className="h-5 w-5 text-orange-500" />
                    <span>Staff Insights</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea ref={scrollRef} className="h-full">
              <div className="max-w-4xl mx-auto py-8 px-6">
                {messages.length === 0 && !isLoading ? (
                  <EmptyState
                    onQuickPrompt={(p) => sendMessage(p)}
                    disabled={isLoading}
                  />
                ) : isInitialLoad && messages.length > 0 ? (
                  <div className="space-y-6">
                    <MessageSkeleton />
                    <MessageSkeleton />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((message, index) => (
                      <MessageBubble key={`${activeId}-${index}`} message={message} />
                    ))}
                    {isLoading && (
                      <TypingIndicator stage={loadingStage} />
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input Area */}
        {activeId && (
          <div className="p-6 bg-gradient-to-t from-background via-background/95 to-transparent">
            <div className="max-w-4xl mx-auto">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
              <p className="text-[10px] text-center text-muted-foreground mt-3">
                AI may hallucinate. Verify critical financial data against official reports.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
