import { useState, useEffect, useRef } from "react";
import {
    Phone,
    Video,
    X,
    Check,
    PhoneIncoming,
    VideoIcon
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RingtoneManager } from "@/lib/alertSounds";

type CallData = {
    id: string;
    type: 'voice' | 'video';
    conversation_id: string;
    caller_id: string;
    caller_name: string;
};

export const IncomingCallDialog = ({
    call,
    onClose,
    onAccept
}: {
    call: CallData | null;
    onClose: () => void;
    onAccept: (call: CallData) => void;
}) => {
    const ringtoneInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const [audioSuspended, setAudioSuspended] = useState(false);

    // Start/stop ringtone using RingtoneManager
    useEffect(() => {
        if (call) {
            console.log('[IncomingCallDialog] Call detected, starting ringtone');
            // Check if audio context is suspended initially
            const checkAudio = async () => {
                try {
                    await RingtoneManager.start();
                    // If we get here, it might have played, but browser might still block silently
                    // We can't easily detect silent block for HTMLAudioElement without gesture
                } catch (e) {
                    console.warn('[IncomingCallDialog] Audio play blocked:', e);
                    setAudioSuspended(true);
                }
            };
            checkAudio();
        }
        return () => {
            RingtoneManager.stop();
        };
    }, [call?.id]);

    if (!call) return null;

    const handleAccept = async () => {
        console.log('[IncomingCallDialog] Accept clicked, stopping ringtone');
        RingtoneManager.stop();
        onAccept(call);
    };

    const handleDecline = async () => {
        RingtoneManager.stop();
        try {
            await (supabase
                .from('chat_calls' as any) as any)
                .update({ status: 'declined' })
                .eq('id', call.id);

            onClose();
        } catch (error) {
            onClose();
        }
    };

    const handleUnlockAudio = () => {
        RingtoneManager.start();
        setAudioSuspended(false);
    };

    return (
        <Dialog open={!!call} onOpenChange={(open) => !open && handleDecline()}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-slate-900/95 backdrop-blur-2xl border-white/10 shadow-3xl z-[200] rounded-3xl">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-black/40 pointer-events-none" />

                <div className="p-10 flex flex-col items-center justify-center text-white text-center gap-10 relative z-10">
                    <div className="relative group">
                        {/* Multiple Ripple Layers */}
                        <div className="absolute inset-0 bg-primary/40 rounded-full animate-ping scale-[1.5] opacity-20" />
                        <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping scale-[2] opacity-10 animation-delay-500" />

                        <Avatar className="h-32 w-32 border-4 border-primary/50 shadow-2xl relative z-10 rounded-[40px] transition-transform group-hover:scale-105 duration-500">
                            <AvatarFallback className="bg-gradient-to-br from-slate-800 to-slate-950 text-4xl font-black text-white">
                                {call.caller_name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>

                        <div className="absolute -bottom-2 -right-2 bg-primary p-3 rounded-2xl border-4 border-slate-900 z-20 shadow-xl overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                            {call.type === 'video' ? <VideoIcon className="h-5 w-5 relative z-10" /> : <PhoneIncoming className="h-5 w-5 relative z-10" />}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary mb-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Incoming {call.type} Call</span>
                        </div>
                        <h2 className="text-4xl font-black tracking-tight text-white drop-shadow-lg">{call.caller_name}</h2>
                        <p className="text-slate-400 text-sm font-medium">Internal IGO Enterprise Line</p>
                    </div>

                    {audioSuspended && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary font-bold rounded-full h-8 animate-bounce"
                            onClick={handleUnlockAudio}
                        >
                            <Phone className="h-3 w-3 mr-2" />
                            Click to unlock ringtone
                        </Button>
                    )}

                    <div className="flex gap-12 mt-6 w-full justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <Button
                                size="icon"
                                variant="destructive"
                                className="h-20 w-20 rounded-full shadow-2xl shadow-red-500/40 hover:scale-110 active:scale-95 transition-all outline-none ring-offset-slate-900 hover:ring-2 hover:ring-red-500/50"
                                onClick={handleDecline}
                            >
                                <X className="h-10 w-10" />
                            </Button>
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Decline</span>
                        </div>

                        <div className="flex flex-col items-center gap-4">
                            <Button
                                size="icon"
                                className="h-20 w-20 bg-emerald-500 hover:bg-emerald-600 rounded-full shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all outline-none ring-offset-slate-900 hover:ring-2 hover:ring-emerald-500/50"
                                onClick={handleAccept}
                            >
                                <Check className="h-10 w-10 text-white" />
                            </Button>
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Accept</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
