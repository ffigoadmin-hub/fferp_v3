import { useState } from 'react';
import { useCafeAds } from '@/hooks/useCafeAds';
import { useCafeMenu } from '@/hooks/useCafeMenu';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Upload, Trash2 } from 'lucide-react';

export function AdsManager({ onFlash }: { onFlash: (ad: any) => void }) {
  const { allAds, createAd, toggleAd, deleteAd } = useCafeAds();
  const { uploadImage, isUploading } = useCafeMenu();
  const { toast } = useToast();
  const [msg, setMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!file) {
      toast({ title: 'Please select an image', variant: 'destructive' });
      return;
    }
    try {
      const url = await uploadImage(file);
      const res = await createAd.mutateAsync({ imageUrl: url, message: msg });
      setMsg(''); setFile(null); setPreview(null);
      toast({ title: '📢 Ad Published Successfully!' });
      // Automatically flash the new ad
      if (res) onFlash(res);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl border border-primary/20 bg-card/50 backdrop-blur-md shadow-xl">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Create New Flash Ad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block">Ad Message</label>
              <textarea
                value={msg}
                onChange={e => setMsg(e.target.value)}
                placeholder="Special Offer! Flat 50% off on all snacks today only..."
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-primary/10 outline-none h-24 text-sm"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={isUploading || createAd.isPending}
              className="w-full py-3 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Publish Advertisement'}
            </button>
          </div>
           <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5 min-h-[250px] w-full relative">
             <input type="file" accept="image/*" onChange={e => {
               const f = e.target.files?.[0];
               if(f) { setFile(f); setPreview(URL.createObjectURL(f)); }
             }} className="hidden" id="ad-image" />
             <label htmlFor="ad-image" className="cursor-pointer w-full flex flex-col items-center">
               {preview ? (
                 <div className="relative group w-full flex justify-center">
                   <img src={preview} className="max-h-[200px] w-auto rounded-xl shadow-2xl border border-white/20" alt="Preview" />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                     <span className="text-white text-[10px] font-black uppercase tracking-widest">Change Image</span>
                   </div>
                 </div>
               ) : (
                 <div className="flex flex-col items-center gap-3">
                   <Upload className="w-10 h-10 text-primary/40 animate-bounce" />
                   <div className="text-center">
                     <span className="text-[10px] text-muted-foreground font-bold uppercase block">Tap to Upload Flash Ad Image</span>
                     <span className="text-[8px] text-primary/60 font-medium uppercase mt-1 block">Supports Landscape (16:9) & Portrait</span>
                   </div>
                 </div>
               )}
             </label>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allAds?.map(ad => (
          <div key={ad.id} className="p-4 rounded-xl border border-border bg-card space-y-3 relative group">
            <img src={ad.image_url} alt="" className="w-full h-32 object-cover rounded-lg" />
            <p className="text-sm font-medium line-clamp-2">{ad.message}</p>
            <div className="flex items-center gap-2 pt-2">
               <button
                 onClick={() => toggleAd.mutate({ id: ad.id, isActive: !ad.is_active })}
                 className={`flex-1 text-[10px] font-black uppercase px-2 py-2 rounded-md border transition-all ${ad.is_active ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-muted text-muted-foreground border-border'}`}
               >
                 {ad.is_active ? 'Live' : 'Paused'}
               </button>
               <button
                 onClick={() => onFlash(ad)}
                 className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-md transition-all border border-primary/20"
                 title="Re-Flash Now"
               >
                 <Sparkles className="w-4 h-4" />
               </button>
               <button onClick={() => deleteAd.mutate(ad.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-md border border-red-500/10">
                 <Trash2 className="w-4 h-4" />
               </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
