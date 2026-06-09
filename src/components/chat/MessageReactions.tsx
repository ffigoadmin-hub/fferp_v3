import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Reaction = {
    id: string;
    emoji: string;
    user_id: string;
    profiles?: { name: string };
};

type MessageReactionsProps = {
    messageId: string;
    reactions: Reaction[];
    onToggleReaction: (emoji: string) => void;
};

const PRESET_REACTIONS = ['✅', '👀', '❓', '🚀', '❌', '👍'];

export function MessageReactions({ messageId, reactions, onToggleReaction }: MessageReactionsProps) {
    const { user } = useAuth();

    if (!reactions || reactions.length === 0) return null;

    // Group by emoji
    const grouped = reactions.reduce<Record<string, { count: number; users: string[]; hasMe: boolean }>>((acc, r) => {
        if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], hasMe: false };
        acc[r.emoji].count++;
        acc[r.emoji].users.push(r.profiles?.name || 'Unknown');
        if (r.user_id === user?.id) acc[r.emoji].hasMe = true;
        return acc;
    }, {});

    return (
        <div className="flex items-center gap-1 flex-wrap mt-0.5 px-1">
            {Object.entries(grouped).map(([emoji, data]) => (
                <button
                    key={emoji}
                    className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all',
                        'border hover:scale-105 active:scale-95',
                        data.hasMe
                            ? 'bg-primary/15 border-primary/30 text-primary'
                            : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/60'
                    )}
                    title={data.users.join(', ')}
                    onClick={() => onToggleReaction(emoji)}
                >
                    <span className="text-sm leading-none">{emoji}</span>
                    {data.count > 1 && (
                        <span className="text-[10px] font-bold">{data.count}</span>
                    )}
                </button>
            ))}
        </div>
    );
}
