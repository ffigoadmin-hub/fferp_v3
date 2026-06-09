import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { playAlert, playCallRingtone, RingtoneManager } from '@/lib/alertSounds';
import { useNavigate, useLocation } from 'react-router-dom';
import { pushAlert } from '@/components/AlertPopup';

export type ChatCall = {
    id: string;
    conversation_id: string;
    caller_id: string;
    receiver_id: string;
    type: 'voice' | 'video';
    status: 'ringing' | 'ongoing' | 'ended' | 'declined' | 'missed';
    created_at: string;
};

export type ActiveCall = {
    id: string;
    type: 'voice' | 'video';
    caller_name: string;
    isInitiator: boolean;
    otherUserIds: string[];
};

// ─── Browser Push Notification Helper ───
async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}

function showBrowserNotification(
    title: string,
    body: string,
    opts?: {
        tag?: string;
        onClick?: () => void;
        requireInteraction?: boolean;
        icon?: string;
    }
) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
        const n = new Notification(title, {
            body,
            icon: opts?.icon || '/favicon.ico',
            tag: opts?.tag, // prevents duplicate notifications with same tag
            requireInteraction: opts?.requireInteraction ?? false,
            silent: false,
        });

        if (opts?.onClick) {
            n.onclick = () => {
                window.focus();
                opts.onClick?.();
                n.close();
            };
        }

        // Auto-close after 10s if not requireInteraction
        if (!opts?.requireInteraction) {
            setTimeout(() => n.close(), 10000);
        }
    } catch (err) {
        console.warn('[Notification] Failed to show:', err);
    }
}

export function useChatEvents() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const pathnameRef = useRef(location.pathname);
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const incomingCallRef = useRef<any>(null);
    const activeCallRef = useRef<ActiveCall | null>(null);

    // Sync refs with state to avoid stale closures
    useEffect(() => {
        incomingCallRef.current = incomingCall;
    }, [incomingCall]);

    useEffect(() => {
        activeCallRef.current = activeCall;
    }, [activeCall]);

    // Update ref whenever location changes
    useEffect(() => {
        pathnameRef.current = location.pathname;
    }, [location.pathname]);

    // Stable user ID ref to prevent subscription recreations
    const userIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (user?.id) {
            userIdRef.current = user.id;
        }
    }, [user?.id]);

    // ─── Call Actions ───
    const acceptCall = useCallback(async (call: any) => {
        console.log('[useChatEvents] Accepting call:', call.id);
        const { error } = await supabase
            .from('chat_calls' as any)
            .update({ status: 'ongoing' } as any)
            .eq('id', call.id);

        if (error) {
            console.error('[useChatEvents] Failed to accept call:', error);
            toast.error("Failed to accept call");
            return;
        }

        setIncomingCall(null);
        setActiveCall({
            id: call.id,
            type: call.type,
            caller_name: call.caller_name || 'Unknown',
            isInitiator: false,
            otherUserIds: call.metadata?.is_group_call && call.metadata?.participant_ids
                ? call.metadata.participant_ids.filter((id: string) => id !== user?.id)
                : [call.caller_id],
        });
    }, []);

    const declineCall = useCallback(async (call: any) => {
        console.log('[useChatEvents] Declining call:', call.id);
        await supabase
            .from('chat_calls' as any)
            .update({ status: 'declined' } as any)
            .eq('id', call.id);
        setIncomingCall(null);
    }, []);

    const endActiveCall = useCallback(async () => {
        const currentCall = activeCallRef.current;
        if (!currentCall) return;
        console.log('[useChatEvents] Ending active call:', currentCall.id);
        await supabase
            .from('chat_calls' as any)
            .update({ status: 'ended' } as any)
            .eq('id', currentCall.id);
        setActiveCall(null);
    }, []);

    // Request notification permission on mount
    useEffect(() => {
        requestNotificationPermission();

        // Listen for outgoing calls initiated from any component
        const handleCallStart = (e: any) => {
            const detail = e.detail;
            console.log('[useChatEvents] Global call start detected:', detail);
            setActiveCall({
                id: detail.id,
                type: detail.type,
                caller_name: detail.callerName,
                isInitiator: true,
                otherUserIds: detail.receiverIds
                    ? (Array.isArray(detail.receiverIds) ? detail.receiverIds : [detail.receiverIds])
                    : [detail.receiverId],
            });
            // Start outgoing ringtone for feedback
            RingtoneManager.startOutgoing();
        };

        window.addEventListener('igo-call-start' as any, handleCallStart);
        return () => window.removeEventListener('igo-call-start' as any, handleCallStart);
    }, []);

    useEffect(() => {
        if (!user) return;

        console.log('[useChatEvents] Setting up global listeners for user:', user.id);

        // 1. Global Call Listener
        const callsChannel = supabase
            .channel('global_chat_calls')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_calls',
                    filter: `receiver_id=eq.${user.id}`
                },
                async (payload) => {
                    console.log('[useChatEvents] 📞 Incoming call INSERT payload:', payload.new);
                    const call = payload.new;
                    if (call.status === 'ringing') {
                        // Fetch caller info
                        const { data: caller } = await supabase
                            .from('profiles')
                            .select('name')
                            .eq('id', call.caller_id)
                            .single();

                        const callerName = caller?.name || 'Unknown';
                        const metadata = call.metadata as any;
                        const isGroupCall = metadata?.is_group_call;
                        const displayName = isGroupCall
                            ? `${metadata.group_name || 'Group'}`
                            : callerName;
                        console.log('[useChatEvents] 📞 Setting incoming call from:', displayName, isGroupCall ? '(group)' : '');

                        setIncomingCall({
                            ...(call as ChatCall),
                            caller_name: displayName
                        });

                        // Browser push notification for incoming call
                        showBrowserNotification(
                            `📞 Incoming ${isGroupCall ? 'group ' : ''}${call.type} call`,
                            isGroupCall
                                ? `${callerName} started a ${call.type} call in ${metadata.group_name || 'a group'}`
                                : `${callerName} is calling you`,
                            {
                                tag: `call-${call.id}`,
                                requireInteraction: true,
                                onClick: () => window.focus(),
                            }
                        );
                    } else {
                        console.warn('[useChatEvents] INSERT received but status is not ringing:', call.status);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_calls',
                    filter: `receiver_id=eq.${user.id}`
                },
                (payload) => {
                    console.log('[useChatEvents] Call UPDATE for receiver:', payload.new.status);
                    if (['ended', 'missed', 'declined', 'ongoing'].includes(payload.new.status)) {
                        RingtoneManager.stop();
                    }
                    if (['ended', 'missed', 'declined'].includes(payload.new.status)) {
                        setIncomingCall(prev => (prev?.id === payload.new.id ? null : prev));
                        setActiveCall(prev => (prev?.id === payload.new.id ? null : prev));
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_calls',
                    filter: `caller_id=eq.${user.id}`
                },
                async (payload) => {
                    const newStatus = payload.new.status;
                    console.log('[useChatEvents] Call UPDATE for caller:', newStatus);
                    // Stop ringing when receiver accepts
                    if (newStatus === 'ongoing') {
                        RingtoneManager.stop();
                    }
                    if (['ended', 'missed', 'declined'].includes(newStatus)) {
                        RingtoneManager.stop();
                        setActiveCall(prev => (prev?.id === payload.new.id ? null : prev));
                    }
                }
            )
            .subscribe((status) => {
                console.log('[useChatEvents] callsChannel status:', status);
            });

        // 2. Global Activity/Message Listener
        // We listen to chat_activity because it has a simple user_id = auth.uid() RLS policy,
        // making it much more reliable for real-time notifications than chat_messages.
        const activityChannel = supabase
            .channel(`global_chat_activity_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_activity',
                    filter: `user_id=eq.${user.id}`
                },
                async (payload) => {
                    console.log('[useChatEvents] 🔔 New chat activity detected:', payload.new.type);
                    const activity = payload.new;

                    if (activity.type === 'message') {
                        // Play sound even if in conversation
                        playAlert('chat_message');

                        // Check if we are already in this conversation for UI/Toast notifications
                        if (pathnameRef.current.includes(`/chat/${activity.entity_id}`)) {
                            console.log('[useChatEvents] 💬 User in conversation, playing sound only');
                            return;
                        }

                        // Fetch sender name
                        const { data: sender } = await supabase
                            .from('profiles')
                            .select('name')
                            .eq('id', activity.actor_id)
                            .single();

                        const senderName = sender?.name || 'Team member';
                        const msgPreview = activity.content || 'New message';

                        console.log(`[useChatEvents] 💬 Showing notification for message from ${senderName}`);

                        pushAlert({
                            type: 'chat_message',
                            title: `Message from ${senderName}`,
                            message: msgPreview,
                            onAction: () => {
                                console.log('[useChatEvents] Notification clicked, navigating...');
                                navigate(`/chat/${activity.entity_id}`);
                            }
                        });

                        playAlert('chat_message');

                        showBrowserNotification(
                            `💬 ${senderName}`,
                            msgPreview,
                            {
                                tag: `msg-${activity.entity_id}`,
                                onClick: () => {
                                    window.focus();
                                    navigate(`/chat/${activity.entity_id}`);
                                },
                            }
                        );
                    } else if (activity.type === 'connection_request') {
                        const { data: actor } = await supabase
                            .from('profiles')
                            .select('name')
                            .eq('id', activity.actor_id)
                            .single();

                        const actorName = actor?.name || 'Someone';

                        pushAlert({
                            type: 'announcement',
                            title: 'Connection Request',
                            message: `${actorName} ${activity.content}`,
                            onAction: () => navigate('/chat')
                        });

                        playAlert('announcement');
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[useChatEvents] activityChannel status for ${user.id}:`, status);
            });


        return () => {
            supabase.removeChannel(callsChannel);
            supabase.removeChannel(activityChannel);
        };

    }, [navigate, user]);

    return {
        incomingCall,
        setIncomingCall,
        activeCall,
        setActiveCall,
        acceptCall,
        declineCall,
        endActiveCall
    };
}
