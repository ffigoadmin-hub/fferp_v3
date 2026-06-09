import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Check, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ShiftSelfieCaptureProps {
    onCapture: (imageUrl: string) => void;
    onCancel: () => void;
    title?: string;
    folderPath?: string;
}

export function ShiftSelfieCapture({ onCapture, onCancel, title = 'Take Selfie', folderPath = 'shift-selfies' }: ShiftSelfieCaptureProps) {
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);

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

            streamRef.current = mediaStream;

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().then(() => {
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
            setError('Camera access denied or not available.');
            setIsLoading(false);
        }
    }, [stopCamera]);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
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

                const imageData = canvas.toDataURL('image/jpeg', 0.85);
                setCapturedImage(imageData);
                stopCamera();
            }
        }
    };

    const confirmPhoto = async () => {
        if (!capturedImage || !user) return;
        setIsUploading(true);

        try {
            const response = await fetch(capturedImage);
            const blob = await response.blob();

            const today = format(new Date(), 'yyyy-MM-dd');
            const timestamp = Date.now();
            const fileName = `${user.id}/${today}/${folderPath}_${timestamp}.jpg`;

            // Upload to Supabase storage
            // Using 'employee-selfies' bucket as it exists
            const { error: uploadError } = await supabase.storage
                .from('employee-selfies')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Get public URL (bucket is public, URLs never expire)
            const { data: urlData } = supabase.storage
                .from('employee-selfies')
                .getPublicUrl(fileName);

            const selfieUrl = urlData?.publicUrl || fileName;
            onCapture(selfieUrl);

        } catch (err: any) {
            console.error('Error uploading selfie:', err);
            toast.error('Failed to upload selfie');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Camera className="w-5 h-5 text-primary" />
                        {title}
                    </h3>
                    <Button variant="ghost" size="icon" onClick={onCancel} disabled={isUploading}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-4">
                    {isLoading && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="animate-spin w-10 h-10 text-primary" />
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
                            style={{ transform: 'scaleX(-1)' }}
                        />
                    )}

                    {capturedImage && (
                        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
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
                            Capture
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => { setCapturedImage(null); startCamera(); }} className="flex-1 h-12" disabled={isUploading}>
                                <RefreshCw className="w-5 h-5 mr-2" />
                                Retake
                            </Button>
                            <Button onClick={confirmPhoto} className="flex-1 h-12" disabled={isUploading}>
                                {isUploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                                Confirm
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
