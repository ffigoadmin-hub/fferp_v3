import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceMessagePlayerProps {
    mediaUrl: string;
    duration?: number;
    isMe: boolean;
}

export function VoiceMessagePlayer({ mediaUrl, duration = 0, isMe }: VoiceMessagePlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(duration);
    const [waveform] = useState(() =>
        Array.from({ length: 28 }, () => 0.15 + Math.random() * 0.85)
    );
    const animFrameRef = useRef<number>();

    const updateProgress = useCallback(() => {
        if (audioRef.current && isPlaying) {
            setCurrentTime(audioRef.current.currentTime);
            animFrameRef.current = requestAnimationFrame(updateProgress);
        }
    }, [isPlaying]);

    useEffect(() => {
        if (isPlaying) {
            animFrameRef.current = requestAnimationFrame(updateProgress);
        }
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [isPlaying, updateProgress]);

    const handleLoadedMetadata = () => {
        if (audioRef.current && audioRef.current.duration !== Infinity) {
            setTotalDuration(audioRef.current.duration);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const togglePlay = async () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (err) {
                console.error('[VoicePlayer] Playback failed:', err);
            }
        }
    };

    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || totalDuration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = pct * totalDuration;
        setCurrentTime(audioRef.current.currentTime);
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

    return (
        <div className={cn(
            "flex items-center gap-3 min-w-[220px] max-w-[320px] px-3 py-2.5 select-none",
        )}>
            <audio
                ref={audioRef}
                src={mediaUrl}
                preload="metadata"
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />

            {/* Play/Pause button */}
            <button
                onClick={togglePlay}
                className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    "hover:scale-105 active:scale-95 shadow-sm",
                    isMe
                        ? "bg-white/20 hover:bg-white/30 text-white"
                        : "bg-primary/10 hover:bg-primary/20 text-primary"
                )}
            >
                {isPlaying
                    ? <Pause className="w-4 h-4" />
                    : <Play className="w-4 h-4 ml-0.5" />
                }
            </button>

            {/* Waveform + time */}
            <div className="flex-1 flex flex-col gap-1.5">
                <div
                    className="flex items-end gap-[2px] h-7 cursor-pointer"
                    onClick={handleBarClick}
                >
                    {waveform.map((h, i) => {
                        const barProgress = i / waveform.length;
                        const isActive = barProgress <= progress;
                        return (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 rounded-full transition-all duration-150",
                                    isActive
                                        ? isMe ? "bg-white/90" : "bg-primary"
                                        : isMe ? "bg-white/25" : "bg-primary/20",
                                    isPlaying && isActive && "animate-pulse"
                                )}
                                style={{ height: `${h * 100}%`, minHeight: 3 }}
                            />
                        );
                    })}
                </div>

                <div className="flex items-center justify-between">
                    <span className={cn(
                        "text-[10px] font-mono font-bold",
                        isMe ? "text-white/70" : "text-muted-foreground"
                    )}>
                        {isPlaying || currentTime > 0
                            ? formatTime(currentTime)
                            : formatTime(totalDuration)
                        }
                    </span>
                    <Mic className={cn(
                        "w-3 h-3",
                        isMe ? "text-white/40" : "text-muted-foreground/40"
                    )} />
                </div>
            </div>
        </div>
    );
}
