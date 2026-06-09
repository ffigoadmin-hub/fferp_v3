import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  src: string;
  className?: string;
  compact?: boolean;
}

export function AudioWaveform({ src, className, compact = false }: AudioWaveformProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);

  // Generate random waveform visualization (simulated)
  useEffect(() => {
    // Create a pseudo-random waveform based on the src string for consistency
    const seed = src.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const bars = compact ? 20 : 35;
    const data: number[] = [];

    for (let i = 0; i < bars; i++) {
      // Generate heights between 20% and 100%
      const height = 0.2 + (Math.sin(seed * (i + 1) * 0.1) * 0.5 + 0.5) * 0.8;
      data.push(height);
    }

    setWaveformData(data);
  }, [src, compact]);

  const updateProgress = useCallback(() => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 1;
      setCurrentTime(current);
      setProgress((current / dur) * 100);

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(updateProgress);
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateProgress);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, updateProgress]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;

    audioRef.current.currentTime = percentage * audioRef.current.duration;
    setProgress(percentage * 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-lg bg-muted/50",
      compact ? "p-1.5" : "p-2",
      className
    )}>
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Play/Pause Button */}
      <Button
        size="sm"
        variant="ghost"
        className={cn(
          "rounded-full flex-shrink-0",
          compact ? "h-7 w-7 p-0" : "h-8 w-8 p-0"
        )}
        onClick={togglePlay}
      >
        {isPlaying ? (
          <Pause className={cn(compact ? "w-3 h-3" : "w-4 h-4")} />
        ) : (
          <Play className={cn(compact ? "w-3 h-3" : "w-4 h-4", "ml-0.5")} />
        )}
      </Button>

      {/* Waveform Visualization */}
      <div
        className={cn(
          "flex items-center gap-0.5 flex-1 cursor-pointer",
          compact ? "h-6" : "h-8"
        )}
        onClick={handleWaveformClick}
      >
        {waveformData.map((height, index) => {
          const barProgress = (index / waveformData.length) * 100;
          const isActive = barProgress <= progress;

          return (
            <div
              key={index}
              className={cn(
                "flex-1 rounded-full transition-all duration-75",
                compact ? "min-w-[2px] max-w-[3px]" : "min-w-[3px] max-w-[4px]",
                isActive ? "bg-primary" : "bg-primary/30"
              )}
              style={{
                height: `${height * 100}%`,
                minHeight: compact ? '3px' : '4px'
              }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className={cn(
        "font-mono text-muted-foreground flex-shrink-0",
        compact ? "text-[10px]" : "text-xs"
      )}>
        {formatTime(currentTime)}/{formatTime(duration)}
      </span>
    </div>
  );
}

// Inline recorder with waveform preview
interface InlineVoiceRecorderProps {
  onAudioRecorded: (audioBlob: Blob, duration: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InlineVoiceRecorder({ onAudioRecorded, disabled, className }: InlineVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(15).fill(0.1));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Setup audio analyzer for live waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      const startTime = Date.now();

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const finalDuration = Math.floor((Date.now() - startTime) / 1000);

        stream.getTracks().forEach(track => track.stop());
        audioContext.close();

        if (blob.size > 0) {
          setIsUploading(true);
          try {
            await onAudioRecorded(blob, finalDuration);
          } finally {
            setIsUploading(false);
          }
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      // Update duration every 100ms
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 100);

      // Animate waveform based on audio levels
      const updateLevels = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          // Sample 15 points from the frequency data
          const levels: number[] = [];
          const step = Math.floor(dataArray.length / 15);
          for (let i = 0; i < 15; i++) {
            const value = dataArray[i * step] / 255;
            levels.push(Math.max(0.1, value));
          }
          setAudioLevels(levels);
        }
        animationRef.current = requestAnimationFrame(updateLevels);
      };
      animationRef.current = requestAnimationFrame(updateLevels);

    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, [onAudioRecorded]); // Removed recordingDuration as a dependency to avoid closure issues

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingDuration(0);
      setAudioLevels(Array(15).fill(0.1));

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isUploading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Sending voice message...</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isRecording ? (
        <>
          {/* Live waveform during recording */}
          <div className="flex items-center gap-0.5 h-6 flex-1">
            {audioLevels.map((level, index) => (
              <div
                key={index}
                className="flex-1 min-w-[2px] max-w-[4px] bg-destructive rounded-full transition-all duration-75"
                style={{
                  height: `${level * 100}%`,
                  minHeight: '4px'
                }}
              />
            ))}
          </div>

          <span className="text-xs font-mono text-destructive animate-pulse">
            {formatDuration(recordingDuration)}
          </span>

          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2 text-xs"
            onClick={stopRecording}
          >
            Send
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1"
          onClick={startRecording}
          disabled={disabled}
        >
          <Mic className="w-3 h-3" />
          Record
        </Button>
      )}
    </div>
  );
}
