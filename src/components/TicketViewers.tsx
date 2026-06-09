import { Eye, Loader2, Users } from 'lucide-react';
import { useTicketViews } from '@/hooks/useTicketViews';
import { formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TicketViewersProps {
    ticketId: string;
    ticketType: 'escalation' | 'critical' | 'site_visit';
    className?: string;
    compact?: boolean;
}

export function TicketViewers({ ticketId, ticketType, className, compact = false }: TicketViewersProps) {
    const { views, isLoading } = useTicketViews(ticketId, ticketType);

    if (isLoading) {
        return (
            <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading views...</span>
            </div>
        );
    }

    if (!views || views.length === 0) {
        return null;
    }

    const viewCount = views.length;
    const recentViewers = views.slice(0, 3);

    if (compact) {
        return (
            <Popover>
                <PopoverTrigger asChild>
                    <button className={cn(
                        "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors",
                        className
                    )}>
                        <Eye className="w-3 h-3" />
                        <span>{viewCount} {viewCount === 1 ? 'view' : 'views'}</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 bg-[#1A1A1D] border-white/10" align="end">
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
                            <Users className="w-4 h-4 text-primary" />
                            <h4 className="font-semibold text-sm">Viewed By ({viewCount})</h4>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-auto">
                            {views.map((view) => {
                                const initials = view.profiles?.name
                                    ?.split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .substring(0, 2)
                                    .toUpperCase() || '??';

                                return (
                                    <div key={view.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                                            {initials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">
                                                {view.profiles?.name || 'Unknown User'}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-white/10">
                                                    {view.profiles?.role?.toUpperCase() || 'N/A'}
                                                </Badge>
                                                <span>•</span>
                                                <span>{formatDistanceToNow(new Date(view.viewed_at), { addSuffix: true })}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="w-3.5 h-3.5" />
                <span className="font-medium">Seen by {viewCount} {viewCount === 1 ? 'person' : 'people'}</span>
            </div>

            <div className="flex items-center gap-2">
                {recentViewers.map((view) => {
                    const initials = view.profiles?.name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase() || '??';

                    return (
                        <div
                            key={view.id}
                            className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[9px] font-bold text-primary"
                            title={`${view.profiles?.name} - ${formatDistanceToNow(new Date(view.viewed_at), { addSuffix: true })}`}
                        >
                            {initials}
                        </div>
                    );
                })}

                {viewCount > 3 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[9px] font-bold text-muted-foreground hover:bg-white/20 transition-colors">
                                +{viewCount - 3}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 bg-[#1A1A1D] border-white/10" align="start">
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
                                    <Users className="w-4 h-4 text-primary" />
                                    <h4 className="font-semibold text-sm">All Viewers ({viewCount})</h4>
                                </div>
                                <div className="space-y-2 max-h-64 overflow-auto">
                                    {views.map((view) => {
                                        const initials = view.profiles?.name
                                            ?.split(' ')
                                            .map((n) => n[0])
                                            .join('')
                                            .substring(0, 2)
                                            .toUpperCase() || '??';

                                        return (
                                            <div key={view.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                                                    {initials}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">
                                                        {view.profiles?.name || 'Unknown User'}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-white/10">
                                                            {view.profiles?.role?.toUpperCase() || 'N/A'}
                                                        </Badge>
                                                        <span>•</span>
                                                        <span>{formatDistanceToNow(new Date(view.viewed_at), { addSuffix: true })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    );
}
