// @ts-nocheck
import { useState } from 'react';
import { useCafeManager } from '@/hooks/useCafeManager';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Upload, Download, FileText, Loader2 } from 'lucide-react';

export function BulkUploadManager() {
  const { addMenuItem, addMasterItem, masterMenuItems } = useCafeManager();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const downloadTemplate = () => {
    const headers = "item_name,item_description,category,price,available_date,is_veg,stock_quantity,spice_level,item_image_url,prep_time_minutes,allergens\n";
    const example = "Chicken Biryani,Spicy and aromatic,lunch,150,2026-03-20,FALSE,50,spicy,https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?q=80&w=200&auto=format&fit=crop,30,none\n" +
                    "Veg Thali,Healthy meal with 5 items,lunch,100,2026-03-20,TRUE,100,mild,https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=200&auto=format&fit=crop,15,dairy\n" +
                    "Cold Coffee,Refreshment,beverages,60,2026-03-20,TRUE,200,none,,10,caffeine\n" +
                    "Onion Pakoda,Crispy evening snack,evening_snacks,40,2026-03-20,TRUE,50,medium,,20,gluten";
    const blob = new Blob([headers + example], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palm_cafe_bulk_template.csv';
    a.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length <= 1) {
        toast({ title: 'CSV is empty or invalid', variant: 'destructive' });
        setIsProcessing(false);
        return;
      }
      
      const headerRow = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rows = lines.slice(1);

      let successCount = 0;
      let masterAddedCount = 0;
      let failCount = 0;

      for (const row of rows) {
        const values = row.split(',').map(v => v.trim());
        if (values.length < 4) continue;
        
        const csvItem: any = {};
        headerRow.forEach((h, i) => csvItem[h] = values[i]);

        try {
          const itemName = csvItem.item_name;
          const price = parseFloat(csvItem.price) || 0;
          const isVeg = csvItem.is_veg?.toUpperCase() === 'TRUE';
          
          // 1. Check if it exists in Master Menu
          let masterItem = masterMenuItems?.find(m => m.item_name.toLowerCase() === itemName.toLowerCase());
          
          if (!masterItem) {
            // Create in Master Menu if missing
            console.log('[BulkUpload] Creating master item:', itemName);
            masterItem = await addMasterItem.mutateAsync({
              item_name: itemName,
              category: csvItem.category || 'lunch',
              item_description: csvItem.item_description || '',
              price: price, // Changed from default_price
              item_image_url: csvItem.item_image_url || null,
              spice_level: csvItem.spice_level || 'medium',
              prep_time_minutes: parseInt(csvItem.prep_time_minutes) || 20,
              allergens: csvItem.allergens || '',
              is_veg: isVeg,
              is_non_veg: !isVeg,
              is_active: true
            });
            masterAddedCount++;
          }

          // 2. Add to Daily Menu
          await addMenuItem.mutateAsync({
            item_name: itemName,
            item_description: csvItem.item_description,
            category: csvItem.category || 'lunch',
            price: price,
            available_date: csvItem.available_date || format(new Date(), 'yyyy-MM-dd'),
            is_veg: isVeg,
            is_non_veg: !isVeg,
            stock_quantity: csvItem.stock_quantity ? parseInt(csvItem.stock_quantity) : undefined,
            spice_level: csvItem.spice_level || 'medium',
            item_image_url: csvItem.item_image_url || undefined,
            master_item_id: masterItem.id
          });

          successCount++;
        } catch (e) {
          console.error('Failed to add bulk item:', csvItem.item_name, e);
          failCount++;
        }
      }
      
      setIsProcessing(false);
      toast({ 
        title: 'Bulk Upload Complete', 
        description: `Successfully added ${successCount} items to today's menu. (${masterAddedCount} new items added to Master Menu). ${failCount > 0 ? `${failCount} failed.` : ''}` 
      });
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="p-8 rounded-3xl border border-primary/20 bg-card/50 backdrop-blur-md shadow-2xl flex flex-col items-center text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center shadow-inner">
          <Upload className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-foreground tracking-tight">Bulk Menu Intelligence</h3>
          <p className="text-muted-foreground mt-2 max-w-md text-sm font-medium">
            Automate your kitchen operations. Upload a CSV to populate the entire day's menu in seconds.
            <span className="block mt-1 text-primary/60 font-bold">Supports: Categories, Images, Stock & Spice Levels</span>
          </p>
        </div>
        
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={downloadTemplate} 
            className="group p-6 rounded-2xl border border-primary/10 bg-background/40 hover:bg-primary/5 hover:border-primary/30 transition-all flex flex-col items-center gap-3 text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Download className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">Get CSV Template</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Ready with best practices</p>
            </div>
          </button>

          <div className="relative group">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleUpload} 
              className="absolute inset-0 opacity-0 cursor-pointer z-10" 
              disabled={isProcessing} 
            />
            <div className="p-6 rounded-2xl border border-primary/20 bg-primary/5 group-hover:bg-primary/10 group-hover:border-primary/40 transition-all flex flex-col items-center gap-3 text-center h-full">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <FileText className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-black text-primary">Upload Data Source</p>
                <p className="text-[10px] text-primary/60 font-bold uppercase mt-1">Insert CSV File Here</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted/20 border border-border/50 text-left w-full max-w-2xl">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 px-1">CSV Field Guide</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'item_name', desc: 'Required' },
              { label: 'category', desc: 'lunch, breakfast, etc' },
              { label: 'price', desc: 'Numeric value' },
              { label: 'is_veg', desc: 'TRUE/FALSE' },
              { label: 'spice_level', desc: 'spicy, mild, none' },
              { label: 'item_image_url', desc: 'Https Image URL' },
            ].map(guide => (
              <div key={guide.label} className="p-2 rounded-lg bg-background/50 border border-border/50">
                <p className="text-[10px] font-black text-primary truncate">{guide.label}</p>
                <p className="text-[9px] text-muted-foreground font-bold">{guide.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
