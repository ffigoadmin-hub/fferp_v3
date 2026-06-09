import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, CheckCircle, X, Mic, Camera, Send, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SubmitProofModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitProof: (data: ProofSubmissionData) => Promise<void>;
  ticketId: string;
  ticketType: 'escalation' | 'critical';
  isSaving: boolean;
}

export interface ProofSubmissionData {
  resolutionText: string;
  screenshotUrls: string[];
  audioUrl?: string;
}

export function SubmitProofModal({
  open,
  onClose,
  onSubmitProof,
  ticketId,
  ticketType,
  isSaving,
}: SubmitProofModalProps) {
  const { user } = useAuth();
  const [resolutionText, setResolutionText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Screenshot states
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [screenshotNames, setScreenshotNames] = useState<string[]>([]);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
  
  // Audio states
  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  const handleScreenshotUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingScreenshot(true);
    try {
      const uploadedUrls: string[] = [];
      const uploadedNames: string[] = [];

      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`${file.name} is not a valid image format`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const filePath = `proof-screenshots/${ticketType}/${ticketId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('escalation-proofs')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          console.error('Screenshot upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('escalation-proofs')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
        uploadedNames.push(file.name);
      }

      if (uploadedUrls.length > 0) {
        setScreenshotUrls(prev => [...prev, ...uploadedUrls]);
        setScreenshotNames(prev => [...prev, ...uploadedNames]);
        if (errors.screenshots) {
          setErrors(prev => ({ ...prev, screenshots: '' }));
        }
        toast.success(`${uploadedUrls.length} screenshot(s) uploaded`);
      }
    } catch (error: any) {
      console.error('Screenshot upload error:', error);
      toast.error(error.message || 'Failed to upload screenshots');
    } finally {
      setIsUploadingScreenshot(false);
    }
  }, [ticketId, ticketType, errors]);

  const handleAudioUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Audio file size must be less than 50MB');
      return;
    }

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|m4a)$/i)) {
      toast.error('Only audio files (MP3, WAV, OGG, WebM, M4A) are allowed');
      return;
    }

    setIsUploadingAudio(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `proof-recordings/${ticketType}/${ticketId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('escalation-proofs')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('escalation-proofs')
        .getPublicUrl(filePath);

      setAudioName(file.name);
      setAudioUrl(publicUrl);
      toast.success('Audio uploaded successfully');
    } catch (error: any) {
      console.error('Audio upload error:', error);
      toast.error(error.message || 'Failed to upload audio');
    } finally {
      setIsUploadingAudio(false);
    }
  }, [ticketId, ticketType]);

  const handleRemoveScreenshot = useCallback((index: number) => {
    setScreenshotUrls(prev => prev.filter((_, i) => i !== index));
    setScreenshotNames(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleRemoveAudio = useCallback(() => {
    setAudioName(null);
    setAudioUrl('');
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!resolutionText.trim()) {
      newErrors.resolutionText = 'Description of work done is required';
    } else if (resolutionText.trim().length < 20) {
      newErrors.resolutionText = 'Please provide more detail (min 20 characters)';
    }

    if (screenshotUrls.length === 0) {
      newErrors.screenshots = 'At least one screenshot proof is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await onSubmitProof({
        resolutionText: resolutionText.trim(),
        screenshotUrls,
        audioUrl: audioUrl || undefined,
      });
      
      // Reset form
      setResolutionText('');
      setScreenshotUrls([]);
      setScreenshotNames([]);
      setAudioUrl('');
      setAudioName(null);
      setErrors({});
    } catch (error) {
      console.error('Failed to submit proof:', error);
    }
  };

  const handleClose = () => {
    setResolutionText('');
    setScreenshotUrls([]);
    setScreenshotNames([]);
    setAudioUrl('');
    setAudioName(null);
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Submit Resolution Proof
          </DialogTitle>
        </DialogHeader>

        {/* Info Banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-primary">CEO/Admin Approval Required</p>
            <p className="text-muted-foreground">
              Your proof will be reviewed. Ticket will only be closed after CEO or Admin approval.
            </p>
          </div>
        </div>

        <div className="space-y-4 py-2">
          {/* Work Done Description */}
          <div className="space-y-2">
            <Label htmlFor="resolution" className="flex items-center gap-1">
              Work Done / Resolution <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="resolution"
              value={resolutionText}
              onChange={(e) => {
                setResolutionText(e.target.value);
                if (errors.resolutionText) {
                  setErrors({ ...errors, resolutionText: '' });
                }
              }}
              placeholder="Describe in detail the steps taken to resolve this issue..."
              rows={4}
              className={errors.resolutionText ? 'border-destructive' : ''}
            />
            {errors.resolutionText && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.resolutionText}
              </p>
            )}
          </div>

          {/* Screenshots Upload - MANDATORY */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Camera className="w-4 h-4" />
              Proof Screenshots <span className="text-destructive">*</span>
            </Label>
            
            {screenshotUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {screenshotUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <img src={url} alt={screenshotNames[index]} className="w-full h-20 object-cover rounded border" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveScreenshot(index)}
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="relative">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleScreenshotUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                disabled={isUploadingScreenshot}
              />
              <div className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg transition-colors ${
                isUploadingScreenshot ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'
              }`}>
                {isUploadingScreenshot ? (
                  <>
                    <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Upload proof screenshot(s)</p>
                    <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP (max 10MB each)</p>
                  </>
                )}
              </div>
            </div>
            {errors.screenshots && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.screenshots}
              </p>
            )}
          </div>

          {/* Audio Recording Upload - OPTIONAL */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Mic className="w-4 h-4" />
              Call Recording <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            
            {audioUrl ? (
              <div className="relative p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-3">
                  <Mic className="w-5 h-5 text-primary" />
                  <span className="text-sm truncate flex-1">{audioName || 'Audio recording'}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAudio}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <audio controls src={audioUrl} className="w-full mt-2" />
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
                  onChange={handleAudioUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  disabled={isUploadingAudio}
                />
                <div className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg transition-colors ${
                  isUploadingAudio ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'
                }`}>
                  {isUploadingAudio ? (
                    <>
                      <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Mic className="w-6 h-6 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Upload call recording</p>
                      <p className="text-xs text-muted-foreground mt-1">MP3, WAV, OGG, M4A (max 50MB)</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSaving || screenshotUrls.length === 0}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit for Approval
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
