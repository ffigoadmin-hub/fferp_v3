import { useState, useCallback } from 'react';
import { Upload, X, FileText, Image, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useStorageUrl } from '@/hooks/useStorageUrl';

const BUCKET = 'payment-documents';

interface FileUploadProps {
  onUploadComplete: (filePath: string) => void;
  accept?: string;
  label: string;
  currentUrl?: string;
}

/**
 * File upload component for payment documents.
 * 
 * IMPORTANT: onUploadComplete now returns the FILE PATH (e.g. "userId/1234.jpg"),
 * NOT a signed URL. Always store the file path in the DB.
 * Use useStorageUrl() hook to display the file from DB.
 */
export function FileUpload({ onUploadComplete, accept = "image/*,application/pdf", label, currentUrl }: FileUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  // Store either a freshly-uploaded path OR the currentUrl prop as a display path
  const [storedPath, setStoredPath] = useState<string | null>(currentUrl || null);

  // Auto-refresh signed URL from stored path
  const { url: displayUrl } = useStorageUrl(BUCKET, storedPath);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const filePath = `${user?.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Store the file PATH (not a signed URL) so it never expires in the DB
      setFileName(file.name);
      setStoredPath(filePath);
      onUploadComplete(filePath); // Always pass path to parent
      toast.success('File uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, [user?.id, onUploadComplete]);

  const handleRemove = useCallback(() => {
    setFileName(null);
    setStoredPath(null);
    onUploadComplete('');
  }, [onUploadComplete]);

  const isImage = displayUrl?.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) ||
    storedPath?.match(/\.(jpg|jpeg|png|webp)$/i);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium block">{label} *</label>

      {storedPath ? (
        <div className="relative p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-3">
            {isImage ? (
              <Image className="w-5 h-5 text-primary" />
            ) : (
              <FileText className="w-5 h-5 text-primary" />
            )}
            <span className="text-sm truncate flex-1">{fileName || 'Uploaded file'}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          {isImage && displayUrl && (
            <img
              src={displayUrl}
              alt="Preview"
              className="mt-3 rounded-md max-h-32 object-cover"
            />
          )}
          {displayUrl && (
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
            >
              <ExternalLink className="w-3 h-3" /> View file
            </a>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            disabled={isUploading}
          />
          <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors ${isUploading ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'
            }`}>
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click or drag file to upload</p>
                <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, PDF (max 10MB)</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
