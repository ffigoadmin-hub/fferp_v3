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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle, CheckCircle, Upload, X, FileText, Image, Mic, Camera, Phone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ResolveTicketModalProps {
  open: boolean;
  onClose: () => void;
  onResolve: (data: ResolveData) => Promise<void>;
  ticketId: string;
  ticketType: 'escalation' | 'critical' | 'site_visit';
  isSaving: boolean;
}

export interface ResolveData {
  resolutionText: string;
  proofUrl: string;
  clientConfirmed?: boolean;
  callRecordingUrl?: string;
  screenshotUrls?: string[];
}

export function ResolveTicketModal({
  open,
  onClose,
  onResolve,
  ticketId,
  ticketType,
  isSaving,
}: ResolveTicketModalProps) {
  const { user } = useAuth();
  const [resolutionText, setResolutionText] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [wasCallConducted, setWasCallConducted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // New states for audio and screenshots
  const [callRecordingUrl, setCallRecordingUrl] = useState('');
  const [callRecordingName, setCallRecordingName] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [screenshotNames, setScreenshotNames] = useState<string[]>([]);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP images and PDF files are allowed');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${ticketType}/${ticketId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('escalation-proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('escalation-proofs')
        .getPublicUrl(filePath);

      setFileName(file.name);
      setProofUrl(publicUrl);
      if (errors.proofUrl) {
        setErrors({ ...errors, proofUrl: '' });
      }
      toast.success('File uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, [ticketId, ticketType, errors]);

  const handleAudioUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 50MB for audio)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Audio file size must be less than 50MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/m4a', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|m4a)$/i)) {
      toast.error('Only audio files (MP3, WAV, OGG, WebM, M4A) are allowed');
      return;
    }

    setIsUploadingAudio(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `call-recordings/${ticketType}/${ticketId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('escalation-proofs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('escalation-proofs')
        .getPublicUrl(filePath);

      setCallRecordingName(file.name);
      setCallRecordingUrl(publicUrl);
      toast.success('Call recording uploaded successfully');
    } catch (error: any) {
      console.error('Audio upload error:', error);
      toast.error(error.message || 'Failed to upload call recording');
    } finally {
      setIsUploadingAudio(false);
    }
  }, [ticketId, ticketType]);

  const handleScreenshotUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingScreenshot(true);
    try {
      const uploadedUrls: string[] = [];
      const uploadedNames: string[] = [];

      for (const file of Array.from(files)) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`${file.name} is not a valid image format`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const filePath = `screenshots/${ticketType}/${ticketId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('escalation-proofs')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

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
        toast.success(`${uploadedUrls.length} screenshot(s) uploaded`);
      }
    } catch (error: any) {
      console.error('Screenshot upload error:', error);
      toast.error(error.message || 'Failed to upload screenshots');
    } finally {
      setIsUploadingScreenshot(false);
    }
  }, [ticketId, ticketType]);

  const handleRemoveFile = useCallback(() => {
    setFileName(null);
    setProofUrl('');
  }, []);

  const handleRemoveAudio = useCallback(() => {
    setCallRecordingName(null);
    setCallRecordingUrl('');
  }, []);

  const handleRemoveScreenshot = useCallback((index: number) => {
    setScreenshotUrls(prev => prev.filter((_, i) => i !== index));
    setScreenshotNames(prev => prev.filter((_, i) => i !== index));
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!resolutionText.trim()) {
      newErrors.resolutionText = 'Remedies taken is required';
    } else if (resolutionText.trim().length < 20) {
      newErrors.resolutionText = 'Please provide more detail (min 20 characters)';
    }

    // MODULE 1: Evidence Logic
    if (ticketType === 'escalation') {
      if (wasCallConducted) {
        if (!callRecordingUrl) {
          newErrors.callRecording = 'Call recording is mandatory for client calls';
        }
      } else {
        if (screenshotUrls.length === 0) {
          newErrors.screenshots = 'Proof of fix (screenshots) is mandatory';
        }
      }

      if (!clientConfirmed) {
        newErrors.clientConfirmed = 'You must confirm client communication';
      }
    } else {
      // Criticals - always require screenshots
      if (screenshotUrls.length === 0) {
        newErrors.screenshots = 'Proof of fix (screenshots) is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await onResolve({
        resolutionText: resolutionText.trim(),
        proofUrl: proofUrl || '',
        clientConfirmed: ticketType === 'escalation' ? clientConfirmed : undefined,
        callRecordingUrl: callRecordingUrl || undefined,
        screenshotUrls: screenshotUrls.length > 0 ? screenshotUrls : undefined,
      });

      // Reset form
      setResolutionText('');
      setProofUrl('');
      setFileName(null);
      setClientConfirmed(false);
      setWasCallConducted(false);
      setCallRecordingUrl('');
      setCallRecordingName(null);
      setScreenshotUrls([]);
      setScreenshotNames([]);
      setErrors({});
    } catch (error) {
      console.error('Failed to resolve:', error);
    }
  };

  const handleClose = () => {
    setResolutionText('');
    setProofUrl('');
    setFileName(null);
    setClientConfirmed(false);
    setCallRecordingUrl('');
    setCallRecordingName(null);
    setScreenshotUrls([]);
    setScreenshotNames([]);
    setErrors({});
    onClose();
  };

  const isImage = proofUrl?.match(/\.(jpg|jpeg|png|webp)/i);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Submit Resolution Proof {ticketId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Remedies Taken */}
          <div className="space-y-2">
            <Label htmlFor="resolution" className="flex items-center gap-1">
              Remedies Taken <span className="text-destructive">*</span>
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

          {/* Evidence Vault */}
          <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-amber-500" />
              Evidence Vault
            </h3>

            {/* Escalation Specific Logic */}
            {ticketType === 'escalation' && (
              <div className="space-y-3 mb-4">
                <Label className="text-white/80">How was this resolved with the client?</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWasCallConducted(true)}
                    className={`h-auto p-4 flex flex-col items-center gap-2 transition-all border-2 ${wasCallConducted
                      ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'bg-background border-white/10 hover:border-amber-500/50'
                      }`}
                  >
                    <Phone className={`w-5 h-5 ${wasCallConducted ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${wasCallConducted ? 'text-amber-500' : 'text-foreground/70'}`}>
                      Client Call
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWasCallConducted(false)}
                    className={`h-auto p-4 flex flex-col items-center gap-2 transition-all border-2 ${!wasCallConducted
                      ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                      : 'bg-background border-white/10 hover:border-amber-500/50'
                      }`}
                  >
                    <MessageSquare className={`w-5 h-5 ${!wasCallConducted ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${!wasCallConducted ? 'text-amber-500' : 'text-foreground/70'}`}>
                      Chat / Email
                    </span>
                  </Button>
                </div>
              </div>
            )}

            {/* Audio Upload - Only for Escalations with Call */}
            {(ticketType === 'escalation' && wasCallConducted) && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="flex items-center gap-1">
                  <Mic className="w-4 h-4" />
                  Call Recording <span className="text-destructive">*</span>
                </Label>

                {callRecordingUrl ? (
                  <div className="relative p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-primary" />
                      <span className="text-sm truncate flex-1">{callRecordingName || 'Call recording'}</span>
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
                    <audio controls src={callRecordingUrl} className="w-full mt-2" />
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
                    <div className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg transition-colors ${isUploadingAudio ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'
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
                {errors.callRecording && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.callRecording}
                  </p>
                )}
              </div>
            )}

            {/* Screenshots - Mandatory for Escalations (No Call) or Criticals */}
            {((ticketType === 'escalation' && !wasCallConducted) || ticketType === 'critical') && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label className="flex items-center gap-1">
                  <Camera className="w-4 h-4" />
                  Proof of Fix (Screenshots) <span className="text-destructive">*</span>
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
                  <div className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg transition-colors ${isUploadingScreenshot ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'
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
            )}

            {/* Optional other files */}
            <div className="space-y-2 pt-2 border-t mt-2">
              <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                Additional Documents (PDF/Images) <span className="text-[10px]">(Optional)</span>
              </Label>

              {proofUrl ? (
                <div className="relative p-2 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    {isImage ? (
                      <Image className="w-4 h-4 text-primary" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary" />
                    )}
                    <span className="text-xs truncate flex-1">{fileName || 'Uploaded file'}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={isUploading}
                  />
                  <div className="flex items-center justify-center p-2 border border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Upload additional file
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Client Confirmation (Escalations Only) */}
          {ticketType === 'escalation' && (
            <div className="space-y-2">
              <div
                className={`flex items-start space-x-3 p-3 rounded-lg border ${errors.clientConfirmed ? 'border-destructive bg-destructive/5' : 'bg-green-500/5 border-green-200'
                  }`}
              >
                <Checkbox
                  id="clientConfirmed"
                  checked={clientConfirmed}
                  onCheckedChange={(checked) => {
                    setClientConfirmed(checked as boolean);
                    if (errors.clientConfirmed) {
                      setErrors({ ...errors, clientConfirmed: '' });
                    }
                  }}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="clientConfirmed"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Resolution Confirmed
                  </label>
                  <p className="text-xs text-muted-foreground">
                    I confirm that the client has accepted this resolution {wasCallConducted ? 'on the call' : 'via chat/email'}.
                  </p>
                </div>
              </div>
              {errors.clientConfirmed && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.clientConfirmed}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving || isUploading || isUploadingAudio || isUploadingScreenshot}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || isUploading || isUploadingAudio || isUploadingScreenshot}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Submit Proof
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
