import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Brain,
    Sparkles,
    Loader2,
    Send,
    Bot,
    MessageSquare,
    ShieldCheck,
    Zap,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    History,
    Lightbulb,
    User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
    role: 'assistant' | 'user';
    content: string;
}

interface IntelligenceHubProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string;
    ticketTitle: string;
    ticketDescription: string;
    timeline: any[];
}

export function IntelligenceHub({
    isOpen,
    onClose,
    ticketId,
    ticketTitle,
    ticketDescription,
    timeline
}: IntelligenceHubProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial Analysis
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            handleInitialAnalysis();
        }
    }, [isOpen]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages, isTyping]);

    const handleInitialAnalysis = async () => {
        setIsTyping(true);
        setMessages([{
            role: 'assistant',
            content: `### 🧠 Intelligence Analysis Initialized\n\nI am analyzing escalation **#${ticketId.slice(0, 8)}**...\n\n**Issue:** ${ticketTitle}\n\nAnalyzing patterns, SLA risks, and historical context...`
        }]);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escalation-ai-intelligence`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        ticketId,
                        title: ticketTitle,
                        description: ticketDescription,
                        timeline,
                        action: 'initial_analysis'
                    }),
                }
            );

            if (!res.ok) throw new Error('AI analysis failed');

            const data = await res.json();
            setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: data.analysis }]);
        } catch (error) {
            console.error('AI Intelligence Error:', error);
            toast.error('AI Analysis failed to initialize');
            setMessages(prev => [...prev.slice(0, -1), {
                role: 'assistant',
                content: "### ⚠️ System Interruption\n\nI encountered an error while processing the analysis. Please try again or ask a specific question."
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = async () => {
        if (!input.trim() || isTyping) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsTyping(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escalation-ai-intelligence`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        ticketId,
                        title: ticketTitle,
                        description: ticketDescription,
                        timeline,
                        history: messages,
                        question: userMessage,
                        action: 'chat'
                    }),
                }
            );

            if (!res.ok) throw new Error('AI chat failed');

            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
        } catch (error) {
            console.error('AI Chat Error:', error);
            toast.error('AI failed to respond');
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I apologize, but I've lost connection to the intelligence neural network. Please check your connectivity and try again."
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0D0D0F] border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-[70] flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 bg-gradient-to-r from-primary/10 to-transparent border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                                    <Brain className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black uppercase tracking-widest text-white">Intelligence Hub</h2>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">AI Analysis Active</span>
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/5">
                                <X className="w-5 h-5 text-white/40" />
                            </Button>
                        </div>

                        {/* AI Predictions / Hot Insights (Optional Shortcut Bar) */}
                        <div className="px-6 py-3 bg-white/[0.02] border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
                            <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary cursor-pointer hover:bg-primary/10 transition-all whitespace-nowrap text-[9px] font-bold uppercase py-1">
                                <TrendingUp className="w-3 h-3 mr-1" /> Risk Score
                            </Badge>
                            <Badge variant="outline" className="bg-blue-500/5 border-blue-500/20 text-blue-400 cursor-pointer hover:bg-blue-500/10 transition-all whitespace-nowrap text-[9px] font-bold uppercase py-1">
                                <History className="w-3 h-3 mr-1" /> Peer Log
                            </Badge>
                            <Badge variant="outline" className="bg-green-500/5 border-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/10 transition-all whitespace-nowrap text-[9px] font-bold uppercase py-1">
                                <Lightbulb className="w-3 h-3 mr-1" /> Fix Suggestion
                            </Badge>
                        </div>

                        {/* Chat Area */}
                        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                            <div className="space-y-8 pb-4">
                                {messages.map((msg, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn(
                                            "flex gap-4",
                                            msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
                                            msg.role === 'user'
                                                ? "bg-white/10 text-white"
                                                : "bg-primary/20 text-primary border border-primary/20 shadow-sm"
                                        )}>
                                            {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                        </div>

                                        <div className={cn(
                                            "flex flex-col space-y-2 max-w-[85%]",
                                            msg.role === 'user' ? "items-end" : "items-start"
                                        )}>
                                            <div className={cn(
                                                "px-5 py-4 rounded-2xl text-sm leading-relaxed",
                                                msg.role === 'user'
                                                    ? "bg-white/10 text-white rounded-tr-none"
                                                    : "bg-white/[0.03] border border-white/10 text-white/90 rounded-tl-none shadow-sm"
                                            )}>
                                                <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                                </div>
                                            </div>
                                            <span className="text-[9px] text-muted-foreground font-mono uppercase opacity-50">
                                                {msg.role === 'user' ? 'Direct Query' : 'AI Processing'}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}

                                {isTyping && (
                                    <div className="flex gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/20">
                                            <Bot className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/10 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-6 bg-white/[0.02] border-t border-white/10">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                                <div className="relative bg-[#1A1A1D] border border-white/10 rounded-2xl overflow-hidden focus-within:border-primary/50 transition-colors">
                                    <Textarea
                                        placeholder="Ask about risks, patterns, or suggests..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        className="min-h-[100px] bg-transparent border-0 focus-visible:ring-0 resize-none text-sm p-4 placeholder:text-white/20"
                                    />
                                    <div className="p-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#FFF]/20">Smart Insights Ready</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={handleSendMessage}
                                            disabled={!input.trim() || isTyping}
                                            className="bg-primary hover:bg-primary/90 text-black font-black uppercase text-[10px] tracking-widest px-4 h-8"
                                        >
                                            <Send className="w-3 h-3 mr-2" />
                                            PROCESS
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-3 text-[9px] text-center text-muted-foreground uppercase tracking-widest">
                                AI can make mistakes. Verify critical actions with human oversight.
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
