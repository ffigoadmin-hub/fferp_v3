import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useWebRTC } from '../../hooks/useWebRTC';
import { supabase } from '@/integrations/supabase/client';
import { RingtoneManager } from '@/lib/alertSounds';
import { Loader2, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type CallScreenProps = {
    callId: string;
    callType: 'voice' | 'video';
    callerName: string;
    userId: string;
    isInitiator: boolean;
    otherUserIds: string[];
    onEnd: () => void;
};

const CONNECT_TIMEOUT_SECONDS = 60;

export const CallScreen = ({ callId, callType, callerName, userId, isInitiator, otherUserIds, onEnd }: CallScreenProps) => {
    const { user } = useAuth();
    const {
        state,
        localMediaStream,
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
    } = useWebRTC(callId, userId, isInitiator, otherUserIds, user?.name || 'Unknown');

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
    const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const [isFullscreen, setIsFullscreen] = useState(callType === 'video');

    // Auto-start or answer call on mount
    useEffect(() => {
        console.log('[CallScreen] Mount — isInitiator:', isInitiator, 'callType:', callType, 'otherUserIds:', otherUserIds);
        if (isInitiator) {
            startCall(callType);
        } else {
            answerCall(callType);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localMediaStream) {
            localVideoRef.current.srcObject = localMediaStream;
            localVideoRef.current.play().catch(e => console.warn('[CallScreen] Local play failed:', e));
        }
    }, [localMediaStream]);

    // Attach remote streams to video/audio elements
    useEffect(() => {
        remoteMediaStreams.forEach((stream, peerId) => {
            // Handle Video elements
            const videoEl = remoteVideoRefs.current.get(peerId);
            if (videoEl && videoEl.srcObject !== stream) {
                console.log('[CallScreen] Attaching remote stream to video for:', peerId);
                videoEl.srcObject = stream;
                videoEl.play().catch(e => console.warn(`[CallScreen] Video play failed for ${peerId}:`, e));
            }

            // Handle Audio elements (for voice calls)
            const audioEl = remoteAudioRefs.current.get(peerId);
            if (audioEl && audioEl.srcObject !== stream) {
                console.log('[CallScreen] Attaching remote stream to audio for:', peerId);
                audioEl.srcObject = stream;
                audioEl.play().catch(e => console.warn(`[CallScreen] Audio play failed for ${peerId}:`, e));
            }
        });
    }, [remoteMediaStreams]);

    // Handle end call
    const handleEndCall = async () => {
        console.log('[CallScreen] Ending call, duration:', callDuration, 's');
        endCall();
        // Update DB status to ended — triggers DB function which computes duration
        await (supabase.from('chat_calls' as any) as any)
            .update({ status: 'ended', updated_at: new Date().toISOString() })
            .eq('id', callId);
        onEnd();
    };

    // Handle call failure/end state
    useEffect(() => {
        if (state === 'ended') {
            onEnd();
        }
    }, [onEnd, state]);

    // 🔔 Outgoing ring: play while connecting, stop when connected/ended
    useEffect(() => {
        if (isInitiator && (state === 'connecting' || state === 'reconnecting')) {
            console.log('[CallScreen] Starting outgoing ringtone');
            RingtoneManager.startOutgoing();
        } else {
            console.log('[CallScreen] Stopping ringtone - state:', state);
            RingtoneManager.stop();
        }
        return () => {
            RingtoneManager.stop();
        };
    }, [state, isInitiator]);

    const [countdown, setCountdown] = useState(CONNECT_TIMEOUT_SECONDS);

    useEffect(() => {
        const shouldUseConnectTimeout =
            state === 'idle' ||
            state === 'connecting' ||
            (state === 'reconnecting' && remoteMediaStreams.size === 0);

        if (!shouldUseConnectTimeout) return;

        setCountdown(CONNECT_TIMEOUT_SECONDS);
        const countdownTimer = setInterval(() => setCountdown(prev => Math.max(0, prev - 1)), 1000);
        const timeout = setTimeout(() => {
            endCall();
            setTimeout(onEnd, 1500);
        }, CONNECT_TIMEOUT_SECONDS * 1000);
        return () => { clearTimeout(timeout); clearInterval(countdownTimer); };
    }, [endCall, onEnd, remoteMediaStreams.size, state]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={cn(
            "fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-between",
            isFullscreen ? "overflow-hidden" : "md:inset-4 md:rounded-[40px] md:shadow-3xl overflow-hidden"
        )}>
            {/* Remote Audio Elements (CRITICAL for MESH) */}
            {Array.from(remoteMediaStreams.entries()).map(([peerId, stream]: [string, MediaStream]) => (
                <audio
                    key={`audio-${peerId}`}
                    ref={el => {
                        if (el) {
                            remoteAudioRefs.current.set(peerId, el);
                            el.srcObject = stream;
                        } else {
                            remoteAudioRefs.current.delete(peerId);
                        }
                    }}
                    autoPlay
                    playsInline
                />
            ))}
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-black pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent pointer-events-none" />

            {/* Top Bar Navigation Influence */}
            <div className="relative z-10 w-full flex items-center justify-between p-4 md:p-6">
                <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/10 shadow-lg">
                    <div className={cn(
                        "h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.2)]",
                        state === 'connected' ? "bg-emerald-500 animate-pulse" :
                            state === 'reconnecting' ? "bg-red-500 animate-[pulse_0.5s_infinite]" : "bg-amber-500 animate-[pulse_1.5s_infinite]"
                    )} />
                    <span className="text-white font-bold text-sm tracking-tight">
                        {state === 'connected' ? formatDuration(callDuration) :
                            state === 'reconnecting' ? `Reconnecting...` : `Establishing Secure Line... ${countdown}s`}
                    </span>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-3">
                        <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">IGO Cloud Relay v2</span>
                        <div className="h-4 w-[1px] bg-white/10" />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="text-white/30 hover:text-white h-8 w-8 hover:bg-white/5 rounded-xl"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="relative z-10 flex-1 w-full flex items-center justify-center p-1 md:p-2">
                {callType === 'video' ? (
                    <div className={cn(
                        "grid gap-2 md:gap-3 w-full h-full transition-all duration-500",
                        remoteMediaStreams.size === 0 ? "grid-cols-1" :
                            remoteMediaStreams.size === 1 ? "grid-cols-1" :
                                remoteMediaStreams.size <= 4 ? "grid-cols-2" :
                                    remoteMediaStreams.size <= 9 ? "grid-cols-3" : "grid-cols-4"
                    )}>
                        {/* Remote Videos */}
                        {Array.from(remoteMediaStreams.entries()).map(([peerId, stream]) => (
                            <div
                                key={peerId}
                                className={cn(
                                    "relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-white/10",
                                    remoteMediaStreams.size <= 1 ? "min-h-[70vh]" : "min-h-[240px]"
                                )}
                            >
                                <video
                                    ref={el => {
                                        if (el) remoteVideoRefs.current.set(peerId, el);
                                        else remoteVideoRefs.current.delete(peerId);
                                    }}
                                    autoPlay
                                    playsInline
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="absolute bottom-3 left-3 bg-black/50 px-2 py-1 rounded-md text-xs text-white backdrop-blur-sm">
                                    {remoteParticipantNames.get(peerId) || 'Participant'}
                                </div>
                            </div>
                        ))}

                        {/* Local Video (in grid if solo, pip otherwise or pinned) */}
                        {remoteMediaStreams.size === 0 ? (
                            <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="absolute inset-0 w-full h-full object-cover mirror"
                                    style={{ transform: 'scaleX(-1)' }}
                                />
                                <div className="absolute bottom-6 left-6 bg-black/50 px-3 py-1.5 rounded-lg text-sm text-white backdrop-blur-md">
                                    You (Waiting for others...)
                                </div>
                            </div>
                        ) : (
                            <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 w-56 h-40 md:w-72 md:h-52 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-800 z-50 transition-all hover:scale-105">
                                {isCameraOff ? (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                                        <VideoOff className="h-8 w-8 text-white/30" />
                                    </div>
                                ) : (
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover mirror"
                                        style={{ transform: 'scaleX(-1)' }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Voice call - grid of avatars */
                    <div className="flex flex-wrap justify-center gap-8 max-w-5xl">
                        {/* Caller/Primary */}
                        <div className="flex flex-col items-center gap-4 p-4">
                            <div className="relative">
                                {state === 'connected' && (
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-pulse scale-[1.2]" />
                                )}
                                <Avatar className="h-24 w-24 border-4 border-white/10 shadow-2xl">
                                    <AvatarFallback className="bg-slate-800 text-3xl font-black text-white">
                                        {callerName.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-white tracking-tight">{callerName}</h2>
                                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                                    {state === 'connected' ? 'Active' : 'Connecting...'}
                                </p>
                            </div>
                        </div>

                        {/* Remote Participants (Placeholders for voice grid) */}
                        {Array.from(remoteMediaStreams.keys()).map((peerId: string) => (
                            <div key={peerId} className="flex flex-col items-center gap-4 p-4 animate-in zoom-in-50 duration-300">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-pulse scale-[1.2]" />
                                    <Avatar className="h-24 w-24 border-4 border-white/10 shadow-2xl">
                                        <AvatarFallback className="bg-slate-700 text-2xl font-bold text-white">
                                            {(remoteParticipantNames.get(peerId) || 'P').charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="text-center">
                                    <h2 className="text-xl font-bold text-white tracking-tight">{remoteParticipantNames.get(peerId) || 'Participant'}</h2>
                                    <p className="text-emerald-400/80 text-xs font-semibold uppercase tracking-wider">Connected</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Reconnecting Overlay */}
                {state === 'reconnecting' && (
                    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center gap-6 animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
                            <div className="relative bg-red-500/10 p-6 rounded-full border border-red-500/30">
                                <WifiOff className="h-10 w-10 text-red-500" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white tracking-tight uppercase">Connection Lost</h3>
                            <p className="text-white/60 text-sm max-w-xs mx-auto font-medium">
                                Attempting to restore your secure line. Please remain on the call.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                            <span className="text-xs text-white/80 font-bold uppercase tracking-wider">Reestablishing...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="relative z-10 w-full p-8">
                <div className="flex items-center justify-center gap-6 max-w-md mx-auto">
                    {/* Mute */}
                    <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                            "h-14 w-14 rounded-full transition-all",
                            isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
                        )}
                        onClick={toggleMute}
                    >
                        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>

                    {/* End Call */}
                    <Button
                        size="icon"
                        variant="destructive"
                        className="h-18 w-18 rounded-full shadow-2xl shadow-destructive/40 hover:scale-110 active:scale-95 transition-all p-5"
                        onClick={handleEndCall}
                    >
                        <PhoneOff className="h-8 w-8" />
                    </Button>

                    {/* Camera toggle (video calls only) */}
                    {callType === 'video' && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "h-14 w-14 rounded-full transition-all",
                                isCameraOff ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
                            )}
                            onClick={toggleCamera}
                        >
                            {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
