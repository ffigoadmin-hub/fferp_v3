import { useState, useEffect } from 'react';
import { CreditCard, Upload, QrCode, Loader2, AlertTriangle } from 'lucide-react';
import { useCafeSettings } from '@/hooks/useCafeSettings';
import { useCafeMenu } from '@/hooks/useCafeMenu';
import { useToast } from '@/hooks/use-toast';

export function PaymentSettings() {
  const { settings, isLoading, updateSettings } = useCafeSettings();
  const { uploadImage, isUploading } = useCafeMenu();
  const { toast } = useToast();
  const [upiId, setUpiId] = useState('');
  const [merchantName, setMerchantName] = useState('');

  useEffect(() => {
    if (settings) {
      setUpiId(settings.upi_id || '');
      setMerchantName(settings.merchant_name || '');
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({ upi_id: upiId, merchant_name: merchantName });
      toast({ title: '✅ Payment Details Updated!' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      await updateSettings.mutateAsync({ qr_code_url: url });
      toast({ title: '📸 QR Code Updated Successfully!' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="p-8 rounded-3xl border border-primary/20 bg-card/50 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground">Payment Configuration</h3>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Manage UPI & QR Presence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block px-1">Merchant Name</label>
                <input
                  value={merchantName}
                  onChange={e => setMerchantName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-primary/10 focus:border-primary/50 outline-none transition-all text-sm font-bold"
                  placeholder="e.g., Palm Cafe - IGO Group"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block px-1">UPI ID / VPA</label>
                <input
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-primary/10 focus:border-primary/50 outline-none transition-all text-sm font-bold text-primary"
                  placeholder="e.g., palmcafe@paytm"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={updateSettings.isPending}
              className="w-full py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
            >
              {updateSettings.isPending ? 'Syncing...' : 'Save Payment Details'}
            </button>
          </div>

          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary/10 rounded-3xl bg-primary/5 group relative overflow-hidden">
             <input type="file" accept="image/*" onChange={handleQrUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
             
             {settings?.qr_code_url ? (
               <div className="relative">
                 <img src={settings.qr_code_url} className="w-48 h-48 object-contain rounded-2xl bg-white p-2 shadow-xl" alt="QR Code" />
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-2xl gap-2 backdrop-blur-sm">
                   <Upload className="w-8 h-8 text-white animate-bounce" />
                   <span className="text-[10px] text-white font-black uppercase tracking-widest">Update QR Code</span>
                 </div>
               </div>
             ) : (
               <div className="flex flex-col items-center gap-4 py-10">
                 <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                   <QrCode className="w-8 h-8 text-primary opacity-40" />
                 </div>
                 <div className="text-center">
                   <p className="text-sm font-black text-foreground">No QR Code Uploaded</p>
                   <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Click to browse image</p>
                 </div>
               </div>
             )}
             
             {isUploading && (
               <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-20">
                 <Loader2 className="w-8 h-8 animate-spin text-primary" />
               </div>
             )}
          </div>
        </div>

        <div className="mt-8 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          <p className="text-xs text-yellow-500/80 font-medium leading-relaxed">
            Changing the UPI ID or QR Code will reflect immediately for all employees. Please ensure the details are verified to avoid payment failures.
          </p>
        </div>
      </div>
    </div>
  );
}
