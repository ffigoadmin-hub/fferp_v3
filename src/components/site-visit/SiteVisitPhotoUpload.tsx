import { useState, useCallback, useRef } from 'react';
import { Camera, Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BUCKET = 'site-visit-photos';

interface SiteVisitPhotoUploadProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  minPhotos?: number;
  maxPhotos?: number;
}

export function SiteVisitPhotoUpload({
  photos,
  onPhotosChange,
  minPhotos = 2,
  maxPhotos = 10,
}: SiteVisitPhotoUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${user?.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return urlData.publicUrl;
  }, [user?.id]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    setIsUploading(true);

    try {
      const urls: string[] = [];
      for (const file of filesToUpload) {
        // Validate file
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 10MB limit`);
          continue;
        }
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) {
          toast.error(`${file.name} — unsupported format`);
          continue;
        }
        const url = await uploadFile(file);
        urls.push(url);
      }

      if (urls.length > 0) {
        onPhotosChange([...photos, ...urls]);
        toast.success(`${urls.length} photo${urls.length > 1 ? 's' : ''} uploaded`);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err?.message || 'Failed to upload photos');
    } finally {
      setIsUploading(false);
    }
  }, [photos, maxPhotos, uploadFile, onPhotosChange]);

  const removePhoto = (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-zinc-800 aspect-square">
              <img src={url} alt={`Site photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 h-6 w-6 bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                <span className="text-[9px] text-white/80 font-bold">{i + 1}/{photos.length}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading || photos.length >= maxPhotos}
          className="flex-1 h-12 border-dashed border-cyan-800/50 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-950/40 hover:text-cyan-300 transition-all"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Camera className="h-4 w-4 mr-2" />
          )}
          Take Photo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || photos.length >= maxPhotos}
          className="flex-1 h-12 border-dashed border-zinc-700 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300 transition-all"
        >
          <Upload className="h-4 w-4 mr-2" />
          Gallery
        </Button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Status badge */}
      <div className={cn(
        'text-[10px] font-bold px-2 py-1 rounded-md w-fit',
        photos.length >= minPhotos
          ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/30'
          : 'bg-amber-950/50 text-amber-400 border border-amber-800/30'
      )}>
        <ImageIcon className="h-3 w-3 inline mr-1" />
        {photos.length}/{minPhotos}+ photos {photos.length >= minPhotos ? '✓' : `(need ${minPhotos - photos.length} more)`}
      </div>
    </div>
  );
}
