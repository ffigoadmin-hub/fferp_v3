import { Phone, Video, PhoneMissed, PhoneOff, PhoneIncoming } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type CallMessageBubbleProps = {
    content: string;
    createdAt: string;
    isMe: boolean;
    onCallBack?: () => void;
};

type CallInfo = {
    icon: React.ReactNode;
    label: string;
    sublabel?: string;
    iconBg: string;
    iconColor: string;
};

function parseCallContent(content: string, isMe: boolean): CallInfo {
    const lower = content.toLowerCase();

    // Completed call: "📞 Voice call ended · 01:23"
    const endedMatch = content.match(/(?:📞|🎥)?\s*(voice|video) call ended\s*[·•]\s*(\d{2}:\d{2})/i);
    if (endedMatch) {
        const isVideo = endedMatch[1].toLowerCase() === 'video';
        return {
            icon: isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />,
            label: isVideo ? 'Video call' : 'Voice call',
            sublabel: endedMatch[2],
            iconBg: 'bg-emerald-500/15',
            iconColor: 'text-emerald-500',
        };
    }

    // Missed call
    if (lower.includes('missed')) {
        const isVideo = lower.includes('video');
        return {
            icon: <PhoneMissed className="w-4 h-4" />,
            label: 'Missed call',
            sublabel: isMe ? undefined : 'Tap to call back',
            iconBg: 'bg-red-500/15',
            iconColor: 'text-red-500',
        };
    }

    // Declined call
    if (lower.includes('declined')) {
        return {
            icon: <PhoneOff className="w-4 h-4" />,
            label: 'Declined call',
            iconBg: 'bg-red-500/15',
            iconColor: 'text-red-400',
        };
    }

    // Started / ringing (in progress) — legacy or pending
    if (lower.includes('started') || lower.includes('ringing')) {
        const isVideo = lower.includes('video');
        return {
            icon: isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />,
            label: isVideo ? 'Video call' : 'Voice call',
            sublabel: 'Connecting...',
            iconBg: 'bg-amber-500/15',
            iconColor: 'text-amber-500',
        };
    }

    // Fallback: generic system message that looks like a call
    return {
        icon: <PhoneIncoming className="w-4 h-4" />,
        label: content,
        iconBg: 'bg-muted',
        iconColor: 'text-muted-foreground',
    };
}

function isCallMessage(content: string): boolean {
    const lower = content.toLowerCase();
    return (
        lower.includes('voice call') ||
        lower.includes('video call') ||
        lower.includes('missed call') ||
        lower.includes('started a') ||
        lower.includes('ended voice') ||
        lower.includes('ended video') ||
        lower.includes('declined')
    );
}

export function CallMessageBubble({ content, createdAt, isMe, onCallBack }: CallMessageBubbleProps) {
    // Only render call-style if content looks like a call
    if (!isCallMessage(content)) {
        // Render plain system message
        return (
            <div className="flex justify-center my-2">
                <span className="text-[11px] text-muted-foreground/70 bg-muted/30 rounded-full px-3 py-1 font-medium italic">
                    {content}
                </span>
            </div>
        );
    }

    const info = parseCallContent(content, isMe);
    const isMissed = content.toLowerCase().includes('missed');
    const canCallBack = isMissed && !isMe && onCallBack;

    return (
        <div className={cn(
            'flex items-center',
            isMe ? 'justify-end' : 'justify-start'
        )}>
            <div
                className={cn(
                    'flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border max-w-[240px] transition-all duration-200',
                    'bg-muted/30 border-border/40',
                    canCallBack && 'cursor-pointer hover:bg-muted/60 active:scale-[0.97]',
                    isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'
                )}
                onClick={canCallBack ? onCallBack : undefined}
                title={canCallBack ? 'Click to call back' : undefined}
            >
                {/* Icon */}
                <div className={cn('rounded-full p-1.5 flex-shrink-0', info.iconBg, info.iconColor)}>
                    {info.icon}
                </div>

                {/* Labels */}
                <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-foreground leading-tight">
                        {info.label}
                    </span>
                    {info.sublabel && (
                        <span className={cn(
                            'text-[11px] font-medium leading-tight mt-0.5',
                            isMissed ? 'text-red-400' : 'text-muted-foreground'
                        )}>
                            {info.sublabel}
                        </span>
                    )}
                </div>

                {/* Time */}
                <span className="text-[10px] text-muted-foreground/60 font-medium ml-auto pl-1 self-end whitespace-nowrap">
                    {format(new Date(createdAt), 'hh:mm a')}
                </span>
            </div>
        </div>
    );
}
