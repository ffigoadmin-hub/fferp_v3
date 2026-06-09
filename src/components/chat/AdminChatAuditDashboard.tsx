import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import {
    Activity,
    ChevronDown,
    ChevronUp,
    Clock3,
    Loader2,
    MessageSquare,
    PhoneCall,
    PhoneIncoming,
    PhoneOutgoing,
    RefreshCw,
    Search,
    Video,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type DateRangeValue = '24h' | '7d' | '30d' | 'all';
type ConversationFilterValue = 'all' | 'direct' | 'group';
type CallStatusFilterValue = 'all' | 'ringing' | 'ongoing' | 'ended' | 'missed' | 'declined';

type ChatMessageRow = {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string | null;
    type: string;
    created_at: string | null;
    is_deleted: boolean | null;
    sender?: {
        name: string | null;
    } | null;
};

type ChatCallRow = {
    id: string;
    conversation_id: string;
    caller_id: string;
    receiver_id: string;
    type: string;
    status: string;
    created_at: string | null;
    updated_at: string | null;
    caller?: {
        name: string | null;
    } | null;
    receiver?: {
        name: string | null;
    } | null;
};

type ConversationRow = {
    id: string;
    name: string | null;
    type: string;
};

type ParticipantRow = {
    conversation_id: string;
    user_id: string;
    profile?: {
        name: string | null;
    } | null;
};

type ProfileRow = {
    id: string;
    name: string | null;
};

type AuditMessage = {
    id: string;
    conversationId: string;
    timestamp: string | null;
    senderName: string;
    recipientName: string;
    conversationLabel: string;
    conversationType: 'direct' | 'group' | 'unknown';
    messageType: string;
    preview: string;
};

type AuditCall = {
    id: string;
    conversationId: string;
    timestamp: string | null;
    callerName: string;
    receiverName: string;
    conversationLabel: string;
    conversationType: 'direct' | 'group' | 'unknown';
    callType: string;
    status: string;
    durationLabel: string;
};

type AuditData = {
    messages: AuditMessage[];
    calls: AuditCall[];
};

type ConversationTimelineItem = {
    id: string;
    conversationId: string;
    timestamp: string | null;
    kind: 'message' | 'call';
    summary: string;
    detail: string;
    status?: string;
};

type ConversationAudit = {
    id: string;
    label: string;
    type: 'direct' | 'group' | 'unknown';
    messageCount: number;
    callCount: number;
    voiceCount: number;
    videoCount: number;
    lastActivity: string | null;
    timeline: ConversationTimelineItem[];
};

const EMPTY_DATA: AuditData = { messages: [], calls: [] };

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeValue; label: string }> = [
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All records' },
];

const CONVERSATION_OPTIONS: Array<{ value: ConversationFilterValue; label: string }> = [
    { value: 'all', label: 'All conversations' },
    { value: 'direct', label: 'Direct chats' },
    { value: 'group', label: 'Group chats' },
];

const CALL_STATUS_OPTIONS: Array<{ value: CallStatusFilterValue; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'ringing', label: 'Ringing' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'ended', label: 'Ended' },
    { value: 'missed', label: 'Missed' },
    { value: 'declined', label: 'Declined' },
];

const MAX_ROWS = 500;
const QUERY_TIMEOUT_MS = 15_000;

const withTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs = QUERY_TIMEOUT_MS): Promise<T> => {
    return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
        ),
    ]);
};

const toShortId = (value: string | null | undefined) => {
    if (!value) return 'Unknown';
    return `User-${value.slice(0, 8)}`;
};

const chunkArray = <T,>(items: T[], chunkSize: number) => {
    if (chunkSize <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
};

const formatDateTime = (value: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return format(date, 'dd MMM yyyy, hh:mm a');
};

const formatDuration = (startedAt: string | null, endedAt: string | null) => {
    if (!startedAt || !endedAt) return '-';
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '-';

    const seconds = Math.floor((end - start) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const compactNames = (names: string[]) => {
    if (names.length === 0) return 'Unknown';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
};

const getSinceIso = (range: DateRangeValue) => {
    const now = Date.now();
    if (range === 'all') return null;
    if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    if (range === '7d') return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
};

const getStatusClass = (status: string) => {
    if (status === 'ongoing') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'missed') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'declined') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'ended') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-muted text-muted-foreground border-border';
};

const StatCard = ({ title, value, icon }: { title: string; value: number; icon: ReactNode }) => (
    <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
                <div className="text-muted-foreground">{icon}</div>
            </div>
            <p className="text-2xl font-black tracking-tight">{value}</p>
        </CardContent>
    </Card>
);

const MessageTable = ({ rows, incoming }: { rows: AuditMessage[]; incoming?: boolean }) => (
    <Card className="h-full min-h-0 flex flex-col border-border/60 shadow-sm">
        <CardHeader className="py-3 px-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {incoming ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
                    {incoming ? 'Incoming Messages' : 'Outgoing Messages'}
                </CardTitle>
                <Badge variant="secondary">{rows.length}</Badge>
            </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>{incoming ? 'To' : 'From'}</TableHead>
                            <TableHead>{incoming ? 'From' : 'To'}</TableHead>
                            <TableHead>Conversation</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Message</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No messages found.</TableCell></TableRow>
                        ) : rows.map(row => (
                            <TableRow key={`${incoming ? 'in' : 'out'}-${row.id}`}>
                                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(row.timestamp)}</TableCell>
                                <TableCell className="whitespace-nowrap font-medium">{incoming ? row.recipientName : row.senderName}</TableCell>
                                <TableCell className="whitespace-nowrap">{incoming ? row.senderName : row.recipientName}</TableCell>
                                <TableCell className="max-w-[160px] truncate">{row.conversationLabel}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px] uppercase">{row.messageType}</Badge></TableCell>
                                <TableCell className="max-w-[240px] truncate">{row.preview}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
    </Card>
);

const CallTable = ({ rows, incoming }: { rows: AuditCall[]; incoming?: boolean }) => (
    <Card className="h-full min-h-0 flex flex-col border-border/60 shadow-sm">
        <CardHeader className="py-3 px-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {incoming ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
                    {incoming ? 'Incoming Calls' : 'Outgoing Calls'}
                </CardTitle>
                <Badge variant="secondary">{rows.length}</Badge>
            </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>{incoming ? 'Receiver' : 'Caller'}</TableHead>
                            <TableHead>{incoming ? 'Caller' : 'Receiver'}</TableHead>
                            <TableHead>Conversation</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Duration</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No calls found.</TableCell></TableRow>
                        ) : rows.map(row => (
                            <TableRow key={`${incoming ? 'in' : 'out'}-${row.id}`}>
                                <TableCell className="text-xs whitespace-nowrap">{formatDateTime(row.timestamp)}</TableCell>
                                <TableCell className="whitespace-nowrap font-medium">{incoming ? row.receiverName : row.callerName}</TableCell>
                                <TableCell className="whitespace-nowrap">{incoming ? row.callerName : row.receiverName}</TableCell>
                                <TableCell className="max-w-[160px] truncate">{row.conversationLabel}</TableCell>
                                <TableCell><Badge variant="outline" className={getStatusClass(row.status)}>{row.status}</Badge></TableCell>
                                <TableCell className="font-mono text-xs">{row.durationLabel}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
    </Card>
);

export const AdminChatAuditDashboard = () => {
    const { user } = useAuth();
    const isAdmin = user?.role?.toLowerCase() === 'admin';

    const [data, setData] = useState<AuditData>(EMPTY_DATA);
    const [search, setSearch] = useState('');
    const [dateRange, setDateRange] = useState<DateRangeValue>('7d');
    const [conversationFilter, setConversationFilter] = useState<ConversationFilterValue>('all');
    const [callStatusFilter, setCallStatusFilter] = useState<CallStatusFilterValue>('all');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [expandedConversationIds, setExpandedConversationIds] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sinceIso = useMemo(() => getSinceIso(dateRange), [dateRange]);

    const fetchAuditData = useCallback(async (manualRefresh = false) => {
        if (!isAdmin) return;

        if (manualRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            let messageQuery = supabase
                .from('chat_messages')
                .select('id, conversation_id, sender_id, content, type, created_at, is_deleted, sender:profiles!chat_messages_sender_id_fkey(name)')
                .order('created_at', { ascending: false })
                .limit(MAX_ROWS);

            let callQuery = supabase
                .from('chat_calls' as never)
                .select('id, conversation_id, caller_id, receiver_id, type, status, created_at, updated_at, caller:profiles!chat_calls_caller_id_fkey(name), receiver:profiles!chat_calls_receiver_id_fkey(name)')
                .order('created_at', { ascending: false })
                .limit(MAX_ROWS);

            if (sinceIso) {
                messageQuery = messageQuery.gte('created_at', sinceIso);
                callQuery = callQuery.gte('created_at', sinceIso);
            }

            const [messageRes, callRes] = await withTimeout(
                Promise.all([messageQuery, callQuery]),
                'Chat audit base data'
            );
            if (messageRes.error) throw messageRes.error;
            if (callRes.error) throw callRes.error;

            const messages = (messageRes.data || []) as ChatMessageRow[];
            const calls = ((callRes.data || []) as ChatCallRow[]).map(call => ({
                ...call,
                type: call.type || 'voice',
                status: call.status || 'ringing',
            }));

            const conversationIds = Array.from(new Set([
                ...messages.map(m => m.conversation_id),
                ...calls.map(c => c.conversation_id),
            ].filter(Boolean)));

            let conversations: ConversationRow[] = [];
            let participants: ParticipantRow[] = [];
            if (conversationIds.length > 0) {
                try {
                    const [convRes, partRes] = await withTimeout(
                        Promise.all([
                            supabase.from('chat_conversations').select('id, name, type').in('id', conversationIds),
                            supabase.from('chat_participants').select('conversation_id, user_id, profile:profiles(name)').in('conversation_id', conversationIds),
                        ]),
                        'Chat audit conversation metadata'
                    );
                    if (convRes.error || partRes.error) {
                        console.warn('[AdminChatAuditDashboard] Conversation metadata unavailable, continuing with partial data', convRes.error || partRes.error);
                    } else {
                        conversations = (convRes.data || []) as ConversationRow[];
                        participants = (partRes.data || []) as ParticipantRow[];
                    }
                } catch (metaErr) {
                    console.warn('[AdminChatAuditDashboard] Conversation metadata timeout, continuing with base data', metaErr);
                }
            }

            const userIds = Array.from(new Set([
                ...messages.map(m => m.sender_id),
                ...calls.map(c => c.caller_id),
                ...calls.map(c => c.receiver_id),
                ...participants.map(p => p.user_id),
            ].filter(Boolean)));

            let profiles: ProfileRow[] = [];
            if (userIds.length > 0) {
                const profileMap = new Map<string, ProfileRow>();
                const profileChunks = chunkArray(userIds, 80);

                await Promise.all(profileChunks.map(async (chunk, index) => {
                    try {
                        const profileRes: any = await withTimeout(
                            (supabase.from('profiles') as any).select('id, name').in('id', chunk),
                            `Chat audit profile metadata chunk ${index + 1}`
                        );
                        if (profileRes.error) {
                            console.warn('[AdminChatAuditDashboard] Profile metadata chunk failed', profileRes.error);
                            return;
                        }
                        ((profileRes.data || []) as ProfileRow[]).forEach(profile => {
                            profileMap.set(profile.id, profile);
                        });
                    } catch (profileErr) {
                        console.warn('[AdminChatAuditDashboard] Profile metadata chunk timeout/failure', profileErr);
                    }
                }));

                profiles = Array.from(profileMap.values());
            }

            const conversationMap = new Map(conversations.map(c => [c.id, c]));
            const nameMap = new Map(profiles.map(p => [p.id, p.name || 'Unknown']));
            const participantMap = new Map<string, string[]>();
            const participantUserNameMap = new Map<string, Map<string, string>>();
            participants.forEach(p => {
                const existing = participantMap.get(p.conversation_id) || [];
                existing.push(p.user_id);
                participantMap.set(p.conversation_id, existing);

                const conversationUsers = participantUserNameMap.get(p.conversation_id) || new Map<string, string>();
                const resolved = (p.profile?.name || nameMap.get(p.user_id) || '').trim() || toShortId(p.user_id);
                conversationUsers.set(p.user_id, resolved);
                participantUserNameMap.set(p.conversation_id, conversationUsers);
            });

            const resolveName = (userId: string, inlineName?: string | null) => {
                const normalizedInline = (inlineName || '').trim();
                if (normalizedInline) return normalizedInline;
                const mapName = (nameMap.get(userId) || '').trim();
                if (mapName) return mapName;
                return toShortId(userId);
            };

            const eventUserNameMap = new Map<string, Set<string>>();
            const addEventName = (conversationId: string, userName: string) => {
                const normalized = (userName || '').trim();
                if (!normalized) return;
                const set = eventUserNameMap.get(conversationId) || new Set<string>();
                set.add(normalized);
                eventUserNameMap.set(conversationId, set);
            };

            messages.forEach(message => {
                addEventName(message.conversation_id, resolveName(message.sender_id, message.sender?.name));
            });
            calls.forEach(call => {
                addEventName(call.conversation_id, resolveName(call.caller_id, call.caller?.name));
                addEventName(call.conversation_id, resolveName(call.receiver_id, call.receiver?.name));
            });

            const getConversationType = (conversationId: string): 'direct' | 'group' | 'unknown' => {
                const value = conversationMap.get(conversationId)?.type;
                if (value === 'direct' || value === 'group') return value;
                return 'unknown';
            };

            const getConversationLabel = (conversationId: string) => {
                const conversation = conversationMap.get(conversationId);
                if (!conversation) return 'Unknown Conversation';
                if (conversation.type === 'group') return conversation.name || 'Group Chat';
                if (conversation.name) return conversation.name;
                const userNameMap = participantUserNameMap.get(conversationId);
                if (userNameMap && userNameMap.size > 0) {
                    return compactNames(Array.from(userNameMap.values()));
                }
                const eventNames = Array.from(eventUserNameMap.get(conversationId) || []);
                if (eventNames.length > 0) {
                    return compactNames(eventNames);
                }
                const ids = participantMap.get(conversationId) || [];
                return compactNames(ids.map(id => resolveName(id)));
            };

            const normalizedMessages: AuditMessage[] = messages.map(m => {
                const conversation = conversationMap.get(m.conversation_id);
                const conversationUserNames = participantUserNameMap.get(m.conversation_id);
                const recipients = (participantMap.get(m.conversation_id) || [])
                    .filter(id => id !== m.sender_id)
                    .map(id => conversationUserNames?.get(id) || resolveName(id));

                return {
                    id: m.id,
                    conversationId: m.conversation_id,
                    timestamp: m.created_at,
                    senderName: conversationUserNames?.get(m.sender_id) || resolveName(m.sender_id, m.sender?.name),
                    recipientName: conversation?.type === 'group' ? (conversation.name || 'Group Chat') : compactNames(recipients),
                    conversationLabel: getConversationLabel(m.conversation_id),
                    conversationType: getConversationType(m.conversation_id),
                    messageType: m.type || 'text',
                    preview: m.is_deleted ? '[deleted message]' : (m.content || `[${m.type || 'message'}]`),
                };
            });

            const normalizedCalls: AuditCall[] = calls.map(c => ({
                id: c.id,
                conversationId: c.conversation_id,
                timestamp: c.created_at,
                callerName: resolveName(c.caller_id, c.caller?.name),
                receiverName: resolveName(c.receiver_id, c.receiver?.name),
                conversationLabel: getConversationLabel(c.conversation_id),
                conversationType: getConversationType(c.conversation_id),
                callType: c.type || 'voice',
                status: c.status || 'ringing',
                durationLabel: formatDuration(c.created_at, c.updated_at),
            }));

            setData({ messages: normalizedMessages, calls: normalizedCalls });
            setLastSyncedAt(new Date());
        } catch (err: unknown) {
            console.error('[AdminChatAuditDashboard] fetch failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to load chat audit data.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [isAdmin, sinceIso]);

    useEffect(() => {
        if (!isAdmin) return;
        void fetchAuditData();

        const scheduleRefresh = () => {
            if (refreshTimerRef.current) return;
            refreshTimerRef.current = setTimeout(() => {
                refreshTimerRef.current = null;
                void fetchAuditData();
            }, 700);
        };

        const channel = supabase
            .channel(`admin_chat_audit_${user?.id || 'anonymous'}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, scheduleRefresh)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_calls' }, scheduleRefresh)
            .subscribe();

        const interval = setInterval(() => {
            void fetchAuditData();
        }, 30_000);

        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [fetchAuditData, isAdmin, user?.id]);

    const filteredData = useMemo(() => {
        const q = search.trim().toLowerCase();

        const filteredMessages = data.messages.filter(msg => {
            if (conversationFilter !== 'all' && msg.conversationType !== conversationFilter) return false;
            if (!q) return true;
            const haystack = [
                msg.senderName,
                msg.recipientName,
                msg.conversationLabel,
                msg.messageType,
                msg.preview,
            ].join(' ').toLowerCase();
            return haystack.includes(q);
        });

        const filteredCalls = data.calls.filter(call => {
            if (conversationFilter !== 'all' && call.conversationType !== conversationFilter) return false;
            if (callStatusFilter !== 'all' && call.status !== callStatusFilter) return false;
            if (!q) return true;
            const haystack = [
                call.callerName,
                call.receiverName,
                call.conversationLabel,
                call.status,
                call.callType,
            ].join(' ').toLowerCase();
            return haystack.includes(q);
        });

        return { messages: filteredMessages, calls: filteredCalls };
    }, [callStatusFilter, conversationFilter, data.calls, data.messages, search]);

    const conversations = useMemo<ConversationAudit[]>(() => {
        const map = new Map<string, ConversationAudit>();

        const ensureConversation = (
            conversationId: string,
            label: string,
            type: 'direct' | 'group' | 'unknown'
        ) => {
            if (!map.has(conversationId)) {
                map.set(conversationId, {
                    id: conversationId,
                    label,
                    type,
                    messageCount: 0,
                    callCount: 0,
                    voiceCount: 0,
                    videoCount: 0,
                    lastActivity: null,
                    timeline: [],
                });
            }
            return map.get(conversationId)!;
        };

        filteredData.messages.forEach(message => {
            const bucket = ensureConversation(message.conversationId, message.conversationLabel, message.conversationType);
            bucket.messageCount += 1;
            bucket.timeline.push({
                id: `m-${message.id}`,
                conversationId: message.conversationId,
                timestamp: message.timestamp,
                kind: 'message',
                summary: `${message.senderName} -> ${message.recipientName}`,
                detail: message.preview,
            });

            if (!bucket.lastActivity || (message.timestamp && new Date(message.timestamp).getTime() > new Date(bucket.lastActivity).getTime())) {
                bucket.lastActivity = message.timestamp;
            }
        });

        filteredData.calls.forEach(call => {
            const bucket = ensureConversation(call.conversationId, call.conversationLabel, call.conversationType);
            bucket.callCount += 1;
            if (call.callType === 'voice') bucket.voiceCount += 1;
            if (call.callType === 'video') bucket.videoCount += 1;

            bucket.timeline.push({
                id: `c-${call.id}`,
                conversationId: call.conversationId,
                timestamp: call.timestamp,
                kind: 'call',
                summary: `${call.callerName} -> ${call.receiverName}`,
                detail: `${call.callType.toUpperCase()} call | ${call.durationLabel}`,
                status: call.status,
            });

            if (!bucket.lastActivity || (call.timestamp && new Date(call.timestamp).getTime() > new Date(bucket.lastActivity).getTime())) {
                bucket.lastActivity = call.timestamp;
            }
        });

        return Array.from(map.values())
            .map(item => ({
                ...item,
                timeline: item.timeline.sort((a, b) => {
                    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return bTime - aTime;
                }),
            }))
            .sort((a, b) => {
                const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
                const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
                return bTime - aTime;
            });
    }, [filteredData.calls, filteredData.messages]);

    useEffect(() => {
        if (conversations.length === 0) {
            if (selectedConversationId !== null) setSelectedConversationId(null);
            return;
        }

        if (!selectedConversationId || !conversations.some(item => item.id === selectedConversationId)) {
            setSelectedConversationId(conversations[0].id);
        }
    }, [conversations, selectedConversationId]);

    const activeConversation = useMemo(
        () => conversations.find(item => item.id === selectedConversationId) || null,
        [conversations, selectedConversationId]
    );

    const toggleConversationDetails = useCallback((conversationId: string) => {
        setExpandedConversationIds(prev => ({
            ...prev,
            [conversationId]: !prev[conversationId],
        }));
    }, []);

    useEffect(() => {
        const validIds = new Set(conversations.map(item => item.id));
        setExpandedConversationIds(prev => {
            const next: Record<string, boolean> = {};
            Object.entries(prev).forEach(([id, expanded]) => {
                if (expanded && validIds.has(id)) {
                    next[id] = true;
                }
            });
            return next;
        });
    }, [conversations]);

    const voiceCalls = useMemo(
        () => filteredData.calls.filter(call => call.callType === 'voice'),
        [filteredData.calls]
    );
    const videoCalls = useMemo(
        () => filteredData.calls.filter(call => call.callType === 'video'),
        [filteredData.calls]
    );

    const stats = useMemo(() => ({
        totalMessages: filteredData.messages.length,
        totalCalls: filteredData.calls.length,
        voiceCalls: voiceCalls.length,
        videoCalls: videoCalls.length,
        missedCalls: filteredData.calls.filter(call => call.status === 'missed').length,
        ongoingCalls: filteredData.calls.filter(call => call.status === 'ongoing').length,
    }), [filteredData.calls, filteredData.messages.length, videoCalls.length, voiceCalls.length]);

    if (!isAdmin) {
        return <div className="h-full flex items-center justify-center text-muted-foreground">Admin access required.</div>;
    }

    return (
        <div className="h-full overflow-y-auto p-4 md:p-6 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.09),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_40%)]">
            <div className="min-h-full flex flex-col gap-4">
                <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background shadow-sm">
                    <CardContent className="p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black tracking-tight">Admin Chat Audit Console</h2>
                            <p className="text-sm text-muted-foreground">All messages and voice/video calls with incoming/outgoing split.</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="gap-1"><Activity className="h-3 w-3" /> Auto-refresh: 30s</Badge>
                            <Badge variant="outline" className="gap-1"><Clock3 className="h-3 w-3" /> Last sync: {lastSyncedAt ? format(lastSyncedAt, 'hh:mm:ss a') : '--'}</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm">
                    <CardContent className="p-4 grid gap-2 md:grid-cols-[1fr_180px_180px_180px_auto]">
                        <div className="relative">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users, conversation, status, content" className="pl-9" />
                        </div>
                        <Select value={dateRange} onValueChange={value => setDateRange(value as DateRangeValue)}>
                            <SelectTrigger><SelectValue placeholder="Date range" /></SelectTrigger>
                            <SelectContent>{DATE_RANGE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={conversationFilter} onValueChange={value => setConversationFilter(value as ConversationFilterValue)}>
                            <SelectTrigger><SelectValue placeholder="Conversation type" /></SelectTrigger>
                            <SelectContent>{CONVERSATION_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={callStatusFilter} onValueChange={value => setCallStatusFilter(value as CallStatusFilterValue)}>
                            <SelectTrigger><SelectValue placeholder="Call status" /></SelectTrigger>
                            <SelectContent>{CALL_STATUS_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => void fetchAuditData(true)} disabled={isLoading || isRefreshing} className="gap-2">
                            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
                        </Button>
                    </CardContent>
                </Card>

                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <StatCard title="Messages" value={stats.totalMessages} icon={<MessageSquare className="h-4 w-4" />} />
                    <StatCard title="Calls" value={stats.totalCalls} icon={<PhoneCall className="h-4 w-4" />} />
                    <StatCard title="Voice" value={stats.voiceCalls} icon={<PhoneOutgoing className="h-4 w-4" />} />
                    <StatCard title="Video" value={stats.videoCalls} icon={<Video className="h-4 w-4" />} />
                    <StatCard title="Missed" value={stats.missedCalls} icon={<PhoneIncoming className="h-4 w-4" />} />
                    <StatCard title="Ongoing" value={stats.ongoingCalls} icon={<Activity className="h-4 w-4" />} />
                </div>

                {error && <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

                <div className="flex-1 min-h-0 overflow-hidden">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" /> Loading audit data...
                        </div>
                    ) : (
                        <Tabs defaultValue="conversations" className="h-full flex flex-col gap-3">
                            <TabsList className="grid w-full grid-cols-4 md:w-[560px]">
                                <TabsTrigger value="conversations" className="gap-1"><MessageSquare className="h-4 w-4" /> Conversations</TabsTrigger>
                                <TabsTrigger value="messages" className="gap-1"><MessageSquare className="h-4 w-4" /> Messages</TabsTrigger>
                                <TabsTrigger value="voice" className="gap-1"><PhoneOutgoing className="h-4 w-4" /> Voice Calls</TabsTrigger>
                                <TabsTrigger value="video" className="gap-1"><Video className="h-4 w-4" /> Video Calls</TabsTrigger>
                            </TabsList>

                            <TabsContent value="conversations" className="flex-1 min-h-0 m-0">
                                <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[420px_1fr]">
                                    <Card className="h-full min-h-0 flex flex-col border-border/60 shadow-sm">
                                        <CardHeader className="py-3 px-4 border-b bg-muted/20">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-sm font-semibold">Conversation List</CardTitle>
                                                <Badge variant="secondary">{conversations.length}</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0 flex-1 min-h-0">
                                            <ScrollArea className="h-full">
                                                <div className="p-2 space-y-2">
                                                    {conversations.length === 0 ? (
                                                        <div className="p-4 text-sm text-muted-foreground text-center">No conversations found.</div>
                                                    ) : conversations.map(item => {
                                                        const isSelected = selectedConversationId === item.id;
                                                        const isExpanded = !!expandedConversationIds[item.id];
                                                        const previewEvents = item.timeline.slice(0, 8);

                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className={`rounded-lg border transition-colors ${
                                                                    isSelected
                                                                        ? 'bg-primary/10 border-primary/30'
                                                                        : 'bg-background border-border/50'
                                                                }`}
                                                            >
                                                                <div className="p-3">
                                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSelectedConversationId(item.id)}
                                                                            className="flex-1 text-left min-w-0"
                                                                        >
                                                                            <p className="font-semibold text-sm truncate">{item.label}</p>
                                                                        </button>
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <Badge variant="outline" className="text-[10px] uppercase">{item.type}</Badge>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-6 w-6"
                                                                                onClick={() => toggleConversationDetails(item.id)}
                                                                            >
                                                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                            </Button>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                                                                        <span>{item.messageCount} msg</span>
                                                                        <span>{item.callCount} calls</span>
                                                                        <span>V:{item.voiceCount}</span>
                                                                        <span>VD:{item.videoCount}</span>
                                                                    </div>
                                                                    <p className="text-[11px] text-muted-foreground truncate">
                                                                        Last: {formatDateTime(item.lastActivity)}
                                                                    </p>
                                                                </div>

                                                                {isExpanded && (
                                                                    <div className="border-t border-border/60 p-3 bg-muted/20">
                                                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                                                            Detailed events ({item.timeline.length})
                                                                        </p>
                                                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                                                            {previewEvents.map(event => (
                                                                                <div key={event.id} className="rounded-md border border-border/50 bg-background p-2">
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                            {event.kind === 'message' ? (
                                                                                                <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                                            ) : (
                                                                                                <PhoneCall className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                                                                                            )}
                                                                                            <p className="text-xs font-semibold truncate">{event.summary}</p>
                                                                                        </div>
                                                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                                                            {formatDateTime(event.timestamp)}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="mt-1 flex items-center gap-2">
                                                                                        {event.status && (
                                                                                            <Badge variant="outline" className={`text-[10px] ${getStatusClass(event.status)}`}>
                                                                                                {event.status}
                                                                                            </Badge>
                                                                                        )}
                                                                                        <p className="text-xs text-muted-foreground truncate">{event.detail}</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        {item.timeline.length > previewEvents.length && (
                                                                            <p className="text-[10px] text-muted-foreground mt-2">
                                                                                Showing latest {previewEvents.length} events.
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>

                                    <Card className="h-full min-h-0 flex flex-col border-border/60 shadow-sm">
                                        <CardHeader className="py-3 px-4 border-b bg-muted/20">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-sm font-semibold">
                                                    {activeConversation ? `${activeConversation.label} Timeline` : 'Conversation Timeline'}
                                                </CardTitle>
                                                {activeConversation && (
                                                    <Badge variant="secondary">{activeConversation.timeline.length} events</Badge>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0 flex-1 min-h-0">
                                            <ScrollArea className="h-full">
                                                {!activeConversation ? (
                                                    <div className="h-full min-h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                                                        Select a conversation to view message + call timeline.
                                                    </div>
                                                ) : (
                                                    <div className="p-4 space-y-3">
                                                        {activeConversation.timeline.map(item => (
                                                            <div key={item.id} className="rounded-lg border border-border/60 p-3 bg-background">
                                                                <div className="flex items-center justify-between gap-3 mb-1">
                                                                    <div className="flex items-center gap-2">
                                                                        {item.kind === 'message' ? (
                                                                            <MessageSquare className="h-4 w-4 text-primary" />
                                                                        ) : (
                                                                            <PhoneCall className="h-4 w-4 text-sky-600" />
                                                                        )}
                                                                        <p className="text-sm font-semibold">{item.summary}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {item.status && (
                                                                            <Badge variant="outline" className={getStatusClass(item.status)}>{item.status}</Badge>
                                                                        )}
                                                                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDateTime(item.timestamp)}</span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm text-muted-foreground">{item.detail}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </ScrollArea>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>

                            <TabsContent value="messages" className="flex-1 min-h-0 m-0">
                                <div className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
                                    <MessageTable rows={filteredData.messages} />
                                    <MessageTable rows={filteredData.messages} incoming />
                                </div>
                            </TabsContent>
                            <TabsContent value="voice" className="flex-1 min-h-0 m-0">
                                <div className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
                                    <CallTable rows={voiceCalls} />
                                    <CallTable rows={voiceCalls} incoming />
                                </div>
                            </TabsContent>
                            <TabsContent value="video" className="flex-1 min-h-0 m-0">
                                <div className="grid h-full min-h-0 gap-3 lg:grid-cols-2">
                                    <CallTable rows={videoCalls} />
                                    <CallTable rows={videoCalls} incoming />
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </div>
            </div>
        </div>
    );
};
