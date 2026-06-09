import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onAudioRecorded: (audioBlob: Blob, duration: number) => void;
  disabled?: boolean;
  className?: string;
}

export function AudioRecorder({ onAudioRecorded, disabled, className }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
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
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Update duration every 100ms
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const playAudio = useCallback(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioUrl]);

  const discardRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setIsPlaying(false);
  }, [audioUrl]);

  const submitRecording = useCallback(() => {
    if (audioBlob) {
      onAudioRecorded(audioBlob, duration);
      discardRecording();
    }
  }, [audioBlob, duration, onAudioRecorded, discardRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!audioBlob ? (
        // Recording controls
        <>
          {isRecording ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 rounded-lg">
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm font-mono text-destructive">
                  {formatDuration(duration)}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={stopRecording}
                disabled={disabled}
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={startRecording}
              disabled={disabled}
              className="gap-1"
            >
              <Mic className="w-4 h-4" />
              Record Audio
            </Button>
          )}
        </>
      ) : (
        // Playback and submit controls
        <>
          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <Mic className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-mono">{formatDuration(duration)}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={playAudio}
            disabled={isPlaying}
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={discardRecording}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submitRecording}
            disabled={disabled}
          >
            Send Audio
          </Button>
        </>
      )}
    </div>
  );
}
