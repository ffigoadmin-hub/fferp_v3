import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    X,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Lightbulb,
    Sparkles,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useAINudges, AINudge } from '@/hooks/useAINudges';
import { cn } from '@/lib/utils';

const nudgeConfig = {
    reminder: {
        icon: Clock,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
        label: 'Reminder',
    },
    motivation: {
        icon: Sparkles,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        label: 'Keep it up!',
    },
    alert: {
        icon: AlertTriangle,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        label: 'Attention',
    },
    coaching: {
        icon: Lightbulb,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20',
        label: 'Tip',
    },
};

interface NudgeItemProps {
    nudge: AINudge;
    onRead: (id: string) => void;
    onDismiss: (id: string) => void;
}

function NudgeItem({ nudge, onRead, onDismiss }: NudgeItemProps) {
    const config = nudgeConfig[nudge.nudge_type] || nudgeConfig.reminder;
    const Icon = config.icon;
    const isUnread = !nudge.read_at;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer group",
                config.bgColor,
                config.borderColor,
                isUnread && "ring-2 ring-primary/20"
            )}
            onClick={() => onRead(nudge.id)}
        >
            <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-full", config.bgColor)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn("text-[10px]", config.color, config.borderColor)}>
                            {config.label}
                        </Badge>
                        {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                            {nudge.hour_of_day}:00
                        </span>
                    </div>

                    <p className="text-sm leading-relaxed">
                        {nudge.message}
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-1">
                        Score: {nudge.ai_score_at_trigger}/100 • {nudge.trigger_reason}
                    </p>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(nudge.id);
                    }}
                >
                    <X className="w-3 h-3" />
                </Button>
            </div>
        </motion.div>
    );
}

export function NudgeBell() {
    const [open, setOpen] = useState(false);
    const { nudges, unreadCount, markAsRead, dismissNudge } = useAINudges();

    const activeNudges = nudges.filter(n => !n.dismissed_at);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-full hover:bg-primary/10"
                >
                    <Bell className={cn(
                        "w-5 h-5 transition-colors",
                        unreadCount > 0 ? "text-primary" : "text-muted-foreground"
                    )} />

                    <AnimatePresence>
                        {unreadCount > 0 && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
                            >
                                <span className="text-[10px] font-bold text-primary-foreground">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Button>
            </PopoverTrigger>

            <PopoverContent
                className="w-[380px] p-0 bg-card/95 backdrop-blur-xl border-border/50"
                align="end"
                sideOffset={8}
            >
                <div className="p-4 border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            AI Nudges
                        </h3>
                        {unreadCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                                {unreadCount} new
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Smart reminders to help you stay on track
                    </p>
                </div>

                <ScrollArea className="h-[300px]">
                    <div className="p-3 space-y-2">
                        <AnimatePresence mode="popLayout">
                            {activeNudges.length > 0 ? (
                                activeNudges.map((nudge) => (
                                    <NudgeItem
                                        key={nudge.id}
                                        nudge={nudge}
                                        onRead={markAsRead}
                                        onDismiss={dismissNudge}
                                    />
                                ))
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-center py-8"
                                >
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        All caught up! No nudges right now.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </ScrollArea>

                {activeNudges.length > 0 && (
                    <div className="p-3 border-t border-border/50">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs justify-between hover:bg-primary/10"
                            onClick={() => setOpen(false)}
                        >
                            View all in Intelligence Hub
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
