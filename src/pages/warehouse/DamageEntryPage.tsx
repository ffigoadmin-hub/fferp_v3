// @ts-nocheck   ← wastage_entries is missing from types.ts (see fferp-database)
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, Camera, Image, Loader2, X } from 'lucide-react';
import WebcamCaptureModal from '@/components/WebcamCaptureModal';

// See QCInspection.tsx for why: capture="environment" only opens a real
// camera on touch devices; desktop needs WebcamCaptureModal instead.
const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

const REASONS = [
  'Damaged in transit',
  'Spoiled / rotten',
  'Handling damage',
  'Expired',
  'Other',
];

interface DamageFormData {
  product_id: string;
  quantity_kg: number;
  reason: string;
  notes?: string;
}

export default function DamageEntryPage() {
  const { user } = useAuth();
  const hubId = (user as any)?.hub_id ?? null;
  const queryClient = useQueryClient();

  const { data: hub } = useQuery({
    queryKey: ['hub-name', hubId],
    enabled: !!hubId,
    queryFn: async () => {
      const { data } = await supabase.from('hubs').select('name').eq('id', hubId).maybeSingle();
      return data;
    },
  });
  const hubName = hub?.name ?? '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [showWebcam, setShowWebcam] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<DamageFormData>();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id,name,unit').eq('is_active', true).order('name');
      if (error) { toast.error(`Failed to load products: ${error.message}`); throw error; }
      return data ?? [];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('products')
        .insert({ name: name.trim(), unit: 'kg', is_active: true })
        .select('id,name,unit')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      queryClient.setQueryData(['products'], (prev: any[] = []) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setValue('product_id', created.id);
      setAddingProduct(false);
      setNewProductName('');
      toast.success(`Added "${created.name}" — selected for this entry`);
    },
    onError: (e: any) => toast.error(`Failed to add product: ${e.message}`),
  });

  // Single-shot camera capture only — no `multiple` here on purpose, see
  // QCInspection.tsx: pairing multiple with capture makes most mobile browsers
  // fall back to a gallery picker instead of opening the camera.
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    addPhotos(files);
  };

  const addPhotos = (files: File[]) => {
    const updated = [...photos, ...files].slice(0, 2); // max 2, matches photo_1_url/photo_2_url
    setPhotos(updated);
    setPhotoPreviewUrls(updated.map(f => URL.createObjectURL(f)));
  };

  const openPhotoCapture = () => {
    if (isTouchDevice()) fileInputRef.current?.click();
    else setShowWebcam(true);
  };

  const removePhoto = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
    setPhotoPreviewUrls(updated.map(f => URL.createObjectURL(f)));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (!photos.length) return [];
    setUploadingPhotos(true);
    const urls: string[] = [];
    for (const file of photos) {
      const path = `${hubId ?? 'hub'}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('wastage-photos').upload(path, file, { upsert: true });
      if (!error && data) {
        const { data: pub } = supabase.storage.from('wastage-photos').getPublicUrl(data.path);
        if (pub?.publicUrl) urls.push(pub.publicUrl);
      }
    }
    setUploadingPhotos(false);
    return urls;
  };

  const createEntry = useMutation({
    mutationFn: async (form: DamageFormData) => {
      if (!hubId) throw new Error('No hub assigned to this account');
      const product = (products as any[]).find(p => p.id === form.product_id);
      const photoUrls = await uploadPhotos();

      // Inventory is deducted automatically by the inv_wastage_before_trg trigger on
      // wastage_entries (ADD_WAREHOUSE_INVENTORY_WASTAGE.sql, added 2026-09-25) whenever
      // product_id + quantity_kg are set on the row -- it also handles edits/deletes
      // correctly and never lets stock go negative. This used to also call
      // decrement_inventory() directly, which double-deducted every entry once the
      // trigger was added; removed in favour of letting the DB trigger be the single
      // source of truth for the stock movement.
      const { error } = await supabase.from('wastage_entries').insert({
        hub_id: hubId,
        hub_name: hubName,
        product_id: form.product_id,
        item_name: product?.name ?? '',
        quantity_kg: form.quantity_kg,
        reason: form.reason,
        notes: form.notes || null,
        photo_1_url: photoUrls[0] ?? null,
        photo_2_url: photoUrls[1] ?? null,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        submitted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Damage entry recorded — inventory updated');
      reset();
      setPhotos([]);
      setPhotoPreviewUrls([]);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e: any) => toast.error(`Failed: ${e.message}`),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12 pt-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 tracking-tight">Damage / Wastage Entry</h1>
          <p className="text-[13px] text-slate-500">Record damaged or spoiled stock — deducted from inventory immediately</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(data => createEntry.mutate(data))} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Item</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
            <select {...register('product_id', { required: true })}
              onChange={e => { if (e.target.value === '__add_new__') { setAddingProduct(true); setValue('product_id', ''); } }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">Select product</option>
              {(products as any[]).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ''}</option>
              ))}
              <option value="__add_new__">+ Add new product…</option>
            </select>
            {errors.product_id && <p className="text-xs text-red-500 mt-1">Required</p>}
            {addingProduct && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  placeholder="New product name"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button type="button" disabled={!newProductName.trim() || createProduct.isPending}
                  onClick={() => createProduct.mutate(newProductName)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-40">
                  {createProduct.isPending ? 'Adding…' : 'Add'}
                </button>
                <button type="button" onClick={() => { setAddingProduct(false); setNewProductName(''); }}
                  className="px-2 py-1.5 rounded-lg text-gray-400 hover:text-gray-600 text-xs">
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg) *</label>
              <input type="number" step="0.1" {...register('quantity_kg', { required: true, valueAsNumber: true, min: 0.1 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="0.0" />
              {errors.quantity_kg && <p className="text-xs text-red-500 mt-1">Required, must be more than 0</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <select {...register('reason', { required: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Select reason</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.reason && <p className="text-xs text-red-500 mt-1">Required</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea {...register('notes')} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              placeholder="Any additional detail…" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
              <Camera className="h-4 w-4" /> Photos
              <span className="text-xs text-gray-400 font-normal normal-case">({photos.length}/2)</span>
            </h3>
            {photos.length < 2 && (
              <button type="button" onClick={openPhotoCapture}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                <Image className="h-3.5 w-3.5" /> Add Photo
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <WebcamCaptureModal
            open={showWebcam}
            onClose={() => setShowWebcam(false)}
            onCapture={file => addPhotos([file])}
          />
          {photoPreviewUrls.length === 0 ? (
            <button type="button" onClick={openPhotoCapture}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-gray-300 transition-colors">
              <Camera className="h-8 w-8 text-gray-300 mx-auto mb-1" />
              <p className="text-sm text-gray-400">Tap to capture photo evidence</p>
            </button>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {photoPreviewUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                  <button type="button" onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-gray-200 p-0.5 hover:bg-red-50">
                    <X className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={createEntry.isPending || uploadingPhotos}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-40">
          {(createEntry.isPending || uploadingPhotos) ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          Record Damage — Deduct from Inventory
        </button>
      </form>
    </div>
  );
}
