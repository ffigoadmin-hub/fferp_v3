import { useState, useRef, useEffect } from 'react';
import { CornerUpLeft, SmilePlus, Copy, Pencil, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type MessageContextMenuProps = {
    children: React.ReactNode;
    messageId: string;
    messageContent: string;
    messageSenderId: string;
    messageCreatedAt: string;
    messageType: string;
    conversationId: string;
    isPinned?: boolean;
    onReact?: (emoji: string) => void;
    onDeleted?: () => void;
    onReply?: () => void;
    onEdit?: () => void;
    onPin?: () => void;
};

const REACTIONS = ['✅', '👀', '❓', '🚀', '❌', '👍'];
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function MessageContextMenu({
    children,
    messageId,
    messageContent,
    messageSenderId,
    messageCreatedAt,
    messageType,
    conversationId,
    isPinned,
    onReact,
    onDeleted,
    onReply,
    onEdit,
    onPin,
}: MessageContextMenuProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuPositionRef = useRef({ left: 0, top: 0 });

    const isMyMessage = messageSenderId === user?.id;
    const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'ceo';
    const messageAge = Date.now() - new Date(messageCreatedAt).getTime();
    const canEdit = isMyMessage && messageType === 'text' && messageAge < FIFTEEN_MINUTES;

    // Apply position when menu opens
    useEffect(() => {
        if (!open || !menuRef.current) return;
        const el = menuRef.current;
        el.style.setProperty('--menu-x', `${menuPositionRef.current.left}px`);
        el.style.setProperty('--menu-y', `${menuPositionRef.current.top}px`);
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const handleContextMenu = (e: React.MouseEvent) => {
        if (messageType === 'system') return;
        e.preventDefault();
        menuPositionRef.current = {
            left: Math.min(e.clientX, window.innerWidth - 200),
            top: Math.min(e.clientY, window.innerHeight - 320),
        };
        setOpen(true);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(messageContent);
        toast.success('Copied to clipboard');
        setOpen(false);
    };

    return (
        <div onContextMenu={handleContextMenu} className="relative">
            {children}

            {open && (
                <div
                    ref={menuRef}
                    className="fixed z-[100] min-w-[180px] bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-150 [left:var(--menu-x)] [top:var(--menu-y)]"
                >
                    {/* Quick Reactions Bar */}
                    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50">
                        {REACTIONS.map(emoji => (
                            <button
                                key={emoji}
                                className="text-lg hover:scale-125 active:scale-95 transition-transform p-1 rounded-md hover:bg-muted/50"
                                onClick={() => {
                                    onReact?.(emoji);
                                    setOpen(false);
                                }}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>

                    {/* Reply */}
                    {messageType !== 'system' && (
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                            onClick={() => { onReply?.(); setOpen(false); }}
                        >
                            <CornerUpLeft className="w-4 h-4 text-muted-foreground" />
                            Reply
                        </button>
                    )}

                    {/* Copy */}
                    {messageType === 'text' && (
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                            onClick={handleCopy}
                        >
                            <Copy className="w-4 h-4 text-muted-foreground" />
                            Copy
                        </button>
                    )}

                    {/* Edit */}
                    {canEdit && (
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                            onClick={() => { onEdit?.(); setOpen(false); }}
                        >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                            Edit
                            <span className="ml-auto text-[10px] text-muted-foreground">
                                {Math.ceil((FIFTEEN_MINUTES - messageAge) / 60000)}m left
                            </span>
                        </button>
                    )}

                    {/* Pin / Unpin */}
                    {(isMyMessage || isAdmin) && messageType !== 'system' && (
                        <button
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                            onClick={() => { onPin?.(); setOpen(false); }}
                        >
                            <Pin className="w-4 h-4 text-muted-foreground" />
                            {isPinned ? 'Unpin' : 'Pin'}
                        </button>
                    )}

                    {/* Delete option removed as per requirements */}
                    {/* {(isMyMessage || isAdmin) && (
                        <>
                            {!showReasonPicker ? (
                                <button
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                    onClick={() => {
                                        if (!isMyMessage && isAdmin) {
                                            setShowReasonPicker(true);
                                        } else {
                                            handleDelete();
                                        }
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {canHardDelete && isMyMessage ? 'Delete' : 'Remove'}
                                    {canHardDelete && isMyMessage && (
                                        <span className="ml-auto text-[10px] text-muted-foreground">
                                            {Math.ceil((TEN_MINUTES - messageAge) / 60000)}m left
                                        </span>
                                    )}
                                </button>
                            ) : (
                                <div className="px-2 py-1">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 mb-1">
                                        Reason for removal
                                    </p>
                                    {deleteReasons.map(reason => (
                                        <button
                                            key={reason}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                            onClick={() => handleDelete(reason)}
                                        >
                                            <AlertCircle className="w-3 h-3" />
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )} */}
                </div>
            )}
        </div>
    );
}
