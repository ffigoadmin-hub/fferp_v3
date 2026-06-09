import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Check, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SelfieCaptureProps {
  onCapture: (imageUrl: string) => void;
  onClose: () => void;
  title?: string;
  selfieType: 'morning_login' | 'afternoon_break' | 'evening_break';
}

export function SelfieCapture({ onCapture, onClose, title = 'Take Selfie', selfieType }: SelfieCaptureProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCameraReady(false);

      // Stop any existing stream first
      stopCamera();

      console.log('Requesting camera access...');

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      console.log('Camera access granted:', mediaStream.getTracks());

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          videoRef.current?.play().then(() => {
            console.log('Video playing');
            setCameraReady(true);
            setIsLoading(false);
          }).catch(err => {
            console.error('Video play error:', err);
            setError('Failed to start video playback');
            setIsLoading(false);
          });
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera and try again.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is in use by another application. Please close other apps using the camera.');
      } else {
        setError(`Camera error: ${err.message || 'Unknown error'}`);
      }
      setIsLoading(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && cameraReady) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob && isMounted.current) {
            setCapturedImage(blob);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            stopCamera();
          }
        }, 'image/jpeg', 0.85);
      }
    }
  };

  const retake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCapturedImage(null);
    setPreviewUrl(null);
    startCamera();
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    stopCamera();
    onClose();
  };

  const confirmPhoto = async () => {
    if (!capturedImage || !user) return;

    setIsUploading(true);

    try {
      const blob = capturedImage;

      const today = format(new Date(), 'yyyy-MM-dd');
      const timestamp = Date.now();
      const fileName = `${user.id}/${today}/${selfieType}_${timestamp}.jpg`;

      console.log('Uploading selfie to:', fileName);

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-selfies')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get public URL (bucket is public, URLs never expire)
      const { data: urlData } = supabase.storage
        .from('employee-selfies')
        .getPublicUrl(fileName);

      const selfieUrl = urlData?.publicUrl || fileName;

      const capturedAt = new Date();

      // Save record to database
      const { error: dbError } = await supabase
        .from('selfie_records')
        .insert({
          user_id: user.id,
          date: today,
          selfie_type: selfieType,
          selfie_url: selfieUrl,
          captured_at: capturedAt.toISOString()
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      // Auto-LOP for late morning login based on selfie timestamp
      if (selfieType === 'morning_login') {
        // Calculate IST time
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(capturedAt.getTime() + istOffset);
        const hours = istTime.getUTCHours();
        const minutes = istTime.getUTCMinutes();
        const totalMinutes = hours * 60 + minutes;

        // 10:16 AM = 616 minutes (0.25 LOP threshold)
        // 11:00 AM = 660 minutes (0.5 LOP threshold)
        const lateThreshold = 10 * 60 + 16; // 10:16 AM
        const severeLateThreshold = 11 * 60; // 11:00 AM

        let lopType: string | null = null;
        let lopReason = '';

        if (totalMinutes >= severeLateThreshold) {
          lopType = '0.5_day';
          lopReason = `Severe Late Login (After 11:00 AM) - Logged in at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} IST`;
        } else if (totalMinutes >= lateThreshold) {
          lopType = '0.25_day';
          lopReason = `Late Login (After 10:16 AM) - Logged in at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} IST`;
        }

        if (lopType) {
          // Check if LOP already exists for this date (any late login source)
          const { data: existingLOP } = await supabase
            .from('lop_entries')
            .select('id')
            .eq('employee_id', user.id)
            .eq('lop_date', today)
            .in('source', ['SYSTEM_LATE_LOGIN', 'SYSTEM_TIME_TRAP'])
            .maybeSingle();

          if (!existingLOP) {
            const { error: lopError } = await supabase
              .from('lop_entries')
              .insert({
                employee_id: user.id,
                created_by: user.id,
                lop_date: today,
                lop_type: lopType,
                reason: lopReason,
                auto_reason: `Auto-generated from morning selfie timestamp`,
                evidence_url: selfieUrl,
                source: 'SYSTEM_TIME_TRAP',
                status: 'approved',
              });

            if (lopError) {
              console.error('Error creating late login LOP:', lopError);
            } else {
              console.log(`Late login LOP created: ${lopType}`);
              toast.error(`⚠️ ${lopType === '0.5_day' ? '0.5' : '0.25'} Day LOP applied for late login`);
            }
          }
        }
      }

      toast.success('Selfie captured successfully!');
      onCapture(selfieUrl);
    } catch (err: any) {
      console.error('Error uploading selfie:', err);
      toast.error('Failed to upload selfie: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !isUploading && handleClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {title}
          </h3>
          <Button variant="ghost" size="icon" onClick={handleClose} disabled={isUploading}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-4">
          {isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
              <p className="text-sm text-muted-foreground">Starting camera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-destructive text-sm font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={startCamera}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}

          {!capturedImage && !error && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // Mirror for selfie view
            />
          )}

          {previewUrl && (
            <img src={previewUrl} alt="Captured selfie" className="w-full h-full object-cover" />
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex gap-3">
          {!capturedImage ? (
            <Button
              onClick={capturePhoto}
              className="flex-1 h-12"
              disabled={isLoading || !!error || !cameraReady}
            >
              <Camera className="w-5 h-5 mr-2" />
              {isLoading ? 'Starting Camera...' : 'Capture Selfie'}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={retake} className="flex-1 h-12" disabled={isUploading}>
                <RefreshCw className="w-5 h-5 mr-2" />
                Retake
              </Button>
              <Button onClick={confirmPhoto} className="flex-1 h-12" disabled={isUploading}>
                {isUploading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Check className="w-5 h-5 mr-2" />
                )}
                {isUploading ? 'Uploading...' : 'Confirm & Save'}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
