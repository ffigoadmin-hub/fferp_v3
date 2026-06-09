import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:openrelay.metered.ca:80' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
        {
            urls: 'turns:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
    iceCandidatePoolSize: 10,
};

const MAX_VIDEO_BITRATE = 2_000_000;
const MAX_AUDIO_BITRATE = 96_000;
const RECONNECT_OFFER_DELAY_MS = 1200;
const READY_SIGNAL_INTERVAL_MS = 2000;

type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'peer-ready' | 'hangup';
type WebRTCState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'ended';

type CallSignalRecord = {
    id: string;
    call_id: string;
    sender_id: string;
    receiver_id: string;
    type: SignalType;
    payload: any;
    created_at: string;
};

export function useWebRTC(callId: string | null, userId: string | null, isInitiator: boolean, otherUserIds: string[] = [], userName?: string) {
    const stringifiedOtherIds = otherUserIds.slice().sort().join(',');
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
    const remoteStreams = useRef<Map<string, MediaStream>>(new Map());
    const pendingCandidatesMap = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
    const processedSignalIds = useRef<Set<string>>(new Set());
    const queuedSignals = useRef<Map<string, CallSignalRecord>>(new Map());
    const reconnectOfferTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const restartInProgress = useRef<Set<string>>(new Set());

    const localStream = useRef<MediaStream | null>(null);
    const signalChannel = useRef<any>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const readySignalInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const handleSignalRef = useRef<((signal: CallSignalRecord) => Promise<void>) | null>(null);

    const [state, setState] = useState<WebRTCState>('idle');
    const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
    const [remoteMediaStreams, setRemoteMediaStreams] = useState<Map<string, MediaStream>>(new Map());
    const [remoteParticipantNames, setRemoteParticipantNames] = useState<Map<string, string>>(new Map());
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    const stopCallTimer = useCallback(() => {
        if (!timerRef.current) return;
        clearInterval(timerRef.current);
        timerRef.current = null;
    }, []);

    const startCallTimer = useCallback(() => {
        if (timerRef.current) return;
        timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    }, []);

    const applySenderParameters = useCallback((pc: RTCPeerConnection) => {
        pc.getSenders().forEach(sender => {
            if (!sender.track) return;

            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }

            if (sender.track.kind === 'video') {
                params.encodings[0].maxBitrate = MAX_VIDEO_BITRATE;
                params.encodings[0].maxFramerate = 30;
                if (!params.encodings[0].scaleResolutionDownBy) {
                    params.encodings[0].scaleResolutionDownBy = 1;
                }
            }

            if (sender.track.kind === 'audio') {
                params.encodings[0].maxBitrate = MAX_AUDIO_BITRATE;
            }

            sender.setParameters(params).catch(err => {
                console.warn('[WebRTC] sender.setParameters failed:', err);
            });
        });
    }, []);

    const clearReconnectTimer = useCallback((peerId: string) => {
        const timer = reconnectOfferTimers.current.get(peerId);
        if (timer) {
            clearTimeout(timer);
            reconnectOfferTimers.current.delete(peerId);
        }
        restartInProgress.current.delete(peerId);
    }, []);

    const scheduleIceRestartOffer = useCallback((peerId: string) => {
        if (reconnectOfferTimers.current.has(peerId)) return;
        if (restartInProgress.current.has(peerId)) return;

        const timeout = setTimeout(async () => {
            reconnectOfferTimers.current.delete(peerId);
            const pc = peerConnections.current.get(peerId);
            if (!pc) return;
            if (pc.connectionState === 'connected' || pc.connectionState === 'closed') return;
            if (pc.signalingState !== 'stable') return;

            try {
                restartInProgress.current.add(peerId);
                const offer = await pc.createOffer({
                    iceRestart: true,
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                await sendSignal('offer', { sdp: pc.localDescription, restart: true }, peerId);
            } catch (err) {
                console.warn('[WebRTC] ICE restart offer failed:', err);
            } finally {
                restartInProgress.current.delete(peerId);
            }
        }, RECONNECT_OFFER_DELAY_MS);

        reconnectOfferTimers.current.set(peerId, timeout);
    }, []);

    const closePeerConnection = useCallback((peerId: string) => {
        const pc = peerConnections.current.get(peerId);
        if (pc) {
            pc.ontrack = null;
            pc.onicecandidate = null;
            pc.onconnectionstatechange = null;
            pc.close();
        }

        peerConnections.current.delete(peerId);
        pendingCandidatesMap.current.delete(peerId);
        remoteStreams.current.delete(peerId);
        clearReconnectTimer(peerId);

        setRemoteMediaStreams(prev => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
        });

        if (peerConnections.current.size === 0) {
            stopCallTimer();
        }
    }, [clearReconnectTimer, stopCallTimer]);

    const sendSignal = useCallback(async (signalType: SignalType, payload: any, receiverId?: string) => {
        if (!callId || !userId) return;

        const targets = receiverId ? [receiverId] : otherUserIds;
        if (targets.length === 0) {
            console.warn('[WebRTC] Missing signal receivers for', signalType);
            return;
        }

        const inserts = targets.map(targetId => ({
            call_id: callId,
            sender_id: userId,
            receiver_id: targetId,
            type: signalType,
            payload: {
                ...payload,
                sender_name: userName
            },
        }));

        const { error } = await (supabase.from('chat_call_signals' as any) as any).insert(inserts);

        if (error) {
            console.error(`[WebRTC] Failed to send ${signalType}:`, error);
        }
    }, [callId, stringifiedOtherIds, userId, userName]);

    const getMedia = useCallback(async (type: 'voice' | 'video') => {
        const constraints: MediaStreamConstraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 1,
            },
            video: type === 'video'
                ? {
                    width: { min: 640, ideal: 1280, max: 1920 },
                    height: { min: 360, ideal: 720, max: 1080 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user',
                }
                : false,
        };

        try {
            let stream: MediaStream;
            try {
                // Try with ideal constraints first
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (qualityError) {
                console.warn('[WebRTC] Falling back to basic media constraints:', qualityError);
                // Fallback to minimal working constraints
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: type === 'video',
                });
            }

            stream.getAudioTracks().forEach(track => {
                if ('contentHint' in track) {
                    track.contentHint = 'speech';
                }
            });

            stream.getVideoTracks().forEach(track => {
                if ('contentHint' in track) {
                    track.contentHint = 'motion';
                }
            });

            localStream.current = stream;
            setLocalMediaStream(stream);
            return stream;
        } catch (err) {
            console.error('[WebRTC] getUserMedia failed:', err);
            setState('failed');
            throw err;
        }
    }, []);

    const getOrCreatePeerConnection = useCallback((peerId: string) => {
        const existing = peerConnections.current.get(peerId);
        if (existing) return existing;

        if (!localStream.current) {
            throw new Error('Local media stream not ready');
        }

        const pc = new RTCPeerConnection({
            ...ICE_SERVERS,
            bundlePolicy: 'max-bundle',
            iceTransportPolicy: 'all',
        });

        peerConnections.current.set(peerId, pc);

        localStream.current.getTracks().forEach(track => {
            pc.addTrack(track, localStream.current as MediaStream);
        });

        applySenderParameters(pc);

        pc.ontrack = event => {
            const stream = event.streams[0] || new MediaStream([event.track]);
            remoteStreams.current.set(peerId, stream);
            setRemoteMediaStreams(prev => new Map(prev).set(peerId, stream));
        };

        pc.onicecandidate = event => {
            if (!event.candidate) return;
            sendSignal('ice-candidate', { candidate: event.candidate.toJSON() }, peerId);
        };

        pc.onconnectionstatechange = () => {
            const connectionState = pc.connectionState;
            console.log('[WebRTC] connection state:', peerId, connectionState);

            if (connectionState === 'connected') {
                clearReconnectTimer(peerId);
                setState('connected');
                startCallTimer();
                // Clear the ready signal interval once connected
                if (readySignalInterval.current) {
                    clearInterval(readySignalInterval.current);
                    readySignalInterval.current = null;
                }
            }

            if (connectionState === 'failed') {
                setState('reconnecting');
                scheduleIceRestartOffer(peerId);
            }

            if (connectionState === 'disconnected') {
                setState('reconnecting');
                scheduleIceRestartOffer(peerId);
            }

            if (connectionState === 'disconnected' || connectionState === 'closed') {
                const hasConnectedPeer = Array.from(peerConnections.current.values()).some(
                    connection => connection.connectionState === 'connected'
                );

                if (connectionState === 'closed') {
                    clearReconnectTimer(peerId);
                }

                if (!hasConnectedPeer && connectionState === 'closed') {
                    setState('ended');
                }
            }
        };

        return pc;
    }, [applySenderParameters, clearReconnectTimer, scheduleIceRestartOffer, sendSignal, startCallTimer]);

    const flushPendingCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
        const pendingCandidates = pendingCandidatesMap.current.get(peerId) || [];
        if (pendingCandidates.length === 0) return;

        for (const candidate of pendingCandidates) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.warn('[WebRTC] Failed to flush queued ICE candidate:', err);
            }
        }

        pendingCandidatesMap.current.delete(peerId);
    }, []);

    const handleSignal = useCallback(async (signal: CallSignalRecord) => {
        if (!userId) return;

        if (signal.sender_id === userId) return;
        if (signal.receiver_id !== userId) return;

        const signalType = signal.type;
        if (!localStream.current && signalType !== 'hangup') {
            queuedSignals.current.set(signal.id, signal);
            return;
        }

        if (processedSignalIds.current.has(signal.id)) return;
        processedSignalIds.current.add(signal.id);

        const senderId = signal.sender_id;
        const payload = signal.payload || {};
        const senderName = payload.sender_name;

        if (senderName) {
            setRemoteParticipantNames(prev => {
                if (prev.get(senderId) === senderName) return prev;
                return new Map(prev).set(senderId, senderName);
            });
        }

        try {
            if (signalType === 'hangup') {
                closePeerConnection(senderId);
                if (peerConnections.current.size === 0) {
                    setState('ended');
                }
                return;
            }

            if (signalType === 'peer-ready') {
                // Avoid offer glare storms: only initiator should answer peer-ready with an offer.
                if (!isInitiator) return;
                const pc = getOrCreatePeerConnection(senderId);
                if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected') {
                    return;
                }
                if (pc.signalingState !== 'stable') {
                    return;
                }

                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                await sendSignal('offer', { sdp: pc.localDescription }, senderId);
                return;
            }

            if (signalType === 'offer') {
                if (!payload?.sdp) return;
                const pc = getOrCreatePeerConnection(senderId);

                if (pc.signalingState !== 'stable') {
                    try {
                        await pc.setLocalDescription({ type: 'rollback' });
                    } catch (err) {
                        console.warn('[WebRTC] rollback during glare failed:', err);
                    }
                }

                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                await flushPendingCandidates(senderId, pc);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await sendSignal('answer', { sdp: pc.localDescription }, senderId);
                return;
            }

            if (signalType === 'answer') {
                if (!payload?.sdp) return;
                const pc = peerConnections.current.get(senderId);
                if (!pc) return;
                if (pc.signalingState !== 'have-local-offer') return;

                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                await flushPendingCandidates(senderId, pc);
                return;
            }

            if (signalType === 'ice-candidate') {
                const candidate = payload?.candidate as RTCIceCandidateInit | undefined;
                if (!candidate) return;

                const pc = peerConnections.current.get(senderId);
                if (!pc || !pc.remoteDescription) {
                    const pending = pendingCandidatesMap.current.get(senderId) || [];
                    pending.push(candidate);
                    pendingCandidatesMap.current.set(senderId, pending);
                    return;
                }

                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                return;
            }
        } catch (err) {
            console.error('[WebRTC] Failed to process signal:', signalType, err);
        }
    }, [closePeerConnection, flushPendingCandidates, getOrCreatePeerConnection, isInitiator, sendSignal, userId]);

    handleSignalRef.current = handleSignal;

    const flushQueuedSignals = useCallback(async () => {
        if (queuedSignals.current.size === 0) return;

        const pendingSignals = Array.from(queuedSignals.current.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        queuedSignals.current.clear();

        for (const signal of pendingSignals) {
            await handleSignalRef.current?.(signal);
        }
    }, []);

    const replaySignals = useCallback(async (id: string) => {
        if (!userId) return;

        const { data, error } = await (supabase
            .from('chat_call_signals' as any) as any)
            .select('id, call_id, sender_id, receiver_id, type, payload, created_at')
            .eq('call_id', id)
            .eq('receiver_id', userId)
            .order('created_at', { ascending: true });

        if (error) {
            console.warn('[WebRTC] Failed to replay call signals:', error);
            return;
        }

        const signals = (data || []) as CallSignalRecord[];
        for (const signal of signals) {
            await handleSignalRef.current?.(signal);
        }
    }, [userId]);

    const subscribeToSignals = useCallback((id: string): Promise<void> => {
        if (signalChannel.current) {
            supabase.removeChannel(signalChannel.current);
            signalChannel.current = null;
        }

        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                console.warn('[WebRTC] Signal subscribe timeout, continuing');
                resolve();
            }, 4000);

            const channel = supabase
                .channel(`call_signals_${id}_${userId || 'anon'}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_call_signals',
                        filter: `call_id=eq.${id}`,
                    },
                    payload => {
                        const signal = payload.new as CallSignalRecord;
                        handleSignalRef.current?.(signal);
                    }
                )
                .subscribe(status => {
                    if (status === 'SUBSCRIBED') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });

            signalChannel.current = channel;
        });
    }, [userId]);

    const cleanupCall = useCallback(() => {
        stopCallTimer();

        if (signalChannel.current) {
            supabase.removeChannel(signalChannel.current);
            signalChannel.current = null;
        }

        localStream.current?.getTracks().forEach(track => {
            track.stop();
        });

        peerConnections.current.forEach(pc => {
            pc.ontrack = null;
            pc.onicecandidate = null;
            pc.onconnectionstatechange = null;
            pc.close();
        });

        peerConnections.current.clear();
        remoteStreams.current.clear();
        pendingCandidatesMap.current.clear();
        processedSignalIds.current.clear();
        queuedSignals.current.clear();
        reconnectOfferTimers.current.forEach(timer => clearTimeout(timer));
        reconnectOfferTimers.current.clear();
        restartInProgress.current.clear();
        localStream.current = null;

        setLocalMediaStream(null);
        setRemoteMediaStreams(new Map());
        setRemoteParticipantNames(new Map());
        setCallDuration(0);
        setIsMuted(false);
        setIsCameraOff(false);

        if (readySignalInterval.current) {
            clearInterval(readySignalInterval.current);
            readySignalInterval.current = null;
        }
    }, [stopCallTimer]);

    const startCall = useCallback(async (type: 'voice' | 'video') => {
        if (!callId || !userId) return;
        if (otherUserIds.length === 0) {
            console.error('[WebRTC] Missing peer ids for call start');
            setState('failed');
            return;
        }

        setState('connecting');
        setCallDuration(0);
        processedSignalIds.current.clear();
        queuedSignals.current.clear();

        try {
            await getMedia(type);
            await flushQueuedSignals();
            await subscribeToSignals(callId);
            await replaySignals(callId);
            await flushQueuedSignals();

            for (const targetId of otherUserIds) {
                const pc = getOrCreatePeerConnection(targetId);
                const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: type === 'video',
                });

                await pc.setLocalDescription(offer);
                await sendSignal('offer', { sdp: pc.localDescription, sender_name: userName }, targetId);
            }

            // Periodically broadcast presence - "I am here, call me" until connected
            if (readySignalInterval.current) clearInterval(readySignalInterval.current);
            readySignalInterval.current = setInterval(async () => {
                const allConnected = otherUserIds.every(id => peerConnections.current.get(id)?.connectionState === 'connected');
                if (!allConnected) {
                    console.log('[WebRTC] >>> Periodic peer-ready broadcast (initiator)');
                    for (const targetId of otherUserIds) {
                        if (peerConnections.current.get(targetId)?.connectionState !== 'connected') {
                            await sendSignal('peer-ready', { ready: true, sender_name: userName }, targetId);
                        }
                    }
                } else {
                    if (readySignalInterval.current) {
                        clearInterval(readySignalInterval.current);
                        readySignalInterval.current = null;
                    }
                }
            }, READY_SIGNAL_INTERVAL_MS);

        } catch (err) {
            console.error('[WebRTC] startCall failed:', err);
            setState('failed');
        }
    }, [callId, flushQueuedSignals, getMedia, getOrCreatePeerConnection, stringifiedOtherIds, replaySignals, sendSignal, subscribeToSignals, userId, userName]);

    const answerCall = useCallback(async (type: 'voice' | 'video') => {
        if (!callId || !userId) return;

        setState('connecting');
        setCallDuration(0);
        processedSignalIds.current.clear();
        queuedSignals.current.clear();

        try {
            await getMedia(type);
            await flushQueuedSignals();
            await subscribeToSignals(callId);
            await replaySignals(callId);
            await flushQueuedSignals();

            if (otherUserIds.length > 0) {
                for (const targetId of otherUserIds) {
                    await sendSignal('peer-ready', { ready: true, sender_name: userName }, targetId);
                }

                // Periodically broadcast presence - "I am here, call me" until connected
                if (readySignalInterval.current) clearInterval(readySignalInterval.current);
                readySignalInterval.current = setInterval(async () => {
                    const hasConnectedPeer = Array.from(peerConnections.current.values()).some(
                        pc => pc.connectionState === 'connected'
                    );
                    if (!hasConnectedPeer) {
                        console.log('[WebRTC] >>> Periodic peer-ready broadcast (receiver)');
                        for (const targetId of otherUserIds) {
                            await sendSignal('peer-ready', { ready: true, sender_name: userName }, targetId);
                        }
                    } else {
                        if (readySignalInterval.current) {
                            clearInterval(readySignalInterval.current);
                            readySignalInterval.current = null;
                        }
                    }
                }, READY_SIGNAL_INTERVAL_MS);
            }
        } catch (err) {
            console.error('[WebRTC] answerCall failed:', err);
            setState('failed');
        }
    }, [callId, flushQueuedSignals, getMedia, stringifiedOtherIds, replaySignals, sendSignal, subscribeToSignals, userId, userName]);

    const endCall = useCallback(async () => {
        if (otherUserIds.length > 0) {
            for (const targetId of otherUserIds) {
                await sendSignal('hangup', { ended: true, at: new Date().toISOString() }, targetId);
            }
        }

        cleanupCall();
        setState('ended');
    }, [cleanupCall, stringifiedOtherIds, sendSignal]);

    const toggleMute = useCallback(() => {
        localStream.current?.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsMuted(prev => !prev);
    }, []);

    const toggleCamera = useCallback(() => {
        localStream.current?.getVideoTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsCameraOff(prev => !prev);
    }, []);

    useEffect(() => {
        return () => {
            cleanupCall();
        };
    }, [cleanupCall]);

    const remoteMediaStream = Array.from(remoteMediaStreams.values())[0] || null;

    return {
        state,
        localMediaStream,
        remoteMediaStream,
        remoteMediaStreams,
        remoteParticipantNames,
        isMuted,
        isCameraOff,
        callDuration,
        startCall,
        answerCall,
        endCall,
        toggleMute,
        toggleCamera,
    };
}
