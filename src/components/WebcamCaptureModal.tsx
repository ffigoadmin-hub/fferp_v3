// Live webcam capture for desktop browsers — <input type="file" capture> only
// opens a real camera on mobile; on desktop it's silently ignored and just
// shows the OS file picker. This gives desktop users an actual "open camera,
// see live preview, capture" experience via getUserMedia, matching what
// mobile already gets natively. Used only on non-touch devices — mobile keeps
// its existing (working) native-camera file input untouched.
import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, X, Check, AlertTriangle } from 'lucide-react';

interface WebcamCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export default function WebcamCaptureModal({ open, onClose, onCapture }: WebcamCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) { stopStream(); setCapturedUrl(null); setCapturedBlob(null); setError(null); return; }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e: any) {
        if (!cancelled) setError(e?.name === 'NotAllowedError'
          ? 'Camera permission denied — allow camera access in your browser and try again.'
          : 'Could not access a camera on this device.');
      }
    })();

    return () => { cancelled = true; stopStream(); };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.9);
  };

  const retake = () => { setCapturedUrl(null); setCapturedBlob(null); };

  const usePhoto = () => {
    if (!capturedBlob) return;
    onCapture(new File([capturedBlob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Camera className="h-4 w-4" /> Take Photo
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          {error ? (
            <div className="p-6 text-center text-white/90">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
              <p className="text-sm">{error}</p>
            </div>
          ) : capturedUrl ? (
            <img src={capturedUrl} alt="Captured" className="w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
          )}
        </div>

        <div className="p-4 flex items-center justify-center gap-3">
          {error ? (
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
              Close
            </button>
          ) : capturedUrl ? (
            <>
              <button onClick={retake} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
                <RotateCcw className="h-4 w-4" /> Retake
              </button>
              <button onClick={usePhoto} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                <Check className="h-4 w-4" /> Use Photo
              </button>
            </>
          ) : (
            <button onClick={capture} className="h-14 w-14 rounded-full border-4 border-gray-300 bg-white hover:border-gray-400 transition-colors" aria-label="Capture" />
          )}
        </div>
      </div>
    </div>
  );
}
