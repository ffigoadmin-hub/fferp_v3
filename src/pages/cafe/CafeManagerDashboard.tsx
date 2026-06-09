import { useState, useEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCafeManager } from '@/hooks/useCafeManager';
import { useCafeMenu } from '@/hooks/useCafeMenu';
import { CafeOrder, CafeOrderItem } from '@/hooks/useCafeOrders';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AdFlash } from '@/components/cafe/manager/AdFlash';
import { supabase } from '@/integrations/supabase/client';
import { AdsManager } from '@/components/cafe/manager/AdsManager';

import { ClosingManager } from '@/components/cafe/manager/ClosingManager';
import { ManagerOrderCard } from '@/components/cafe/manager/ManagerOrderCard';
import { RatingList } from '@/components/cafe/manager/RatingList';
import { PaymentSettings } from '@/components/cafe/manager/PaymentSettings';
import { useCafeAds } from '@/hooks/useCafeAds';
import { useCafeSettings } from '@/hooks/useCafeSettings';
import {
  Coffee,
  UtensilsCrossed,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  ChefHat,
  Package,
  Star,
  AlertTriangle,
  CreditCard,
  Image as ImageIcon,
  Loader2,
  Clock,
  IndianRupee,
  Ban,
  Shield,
  Eye,
  Plus,
  Minus,
  TrendingUp,
  Users,
  BarChart3,
  RefreshCw,
  Sparkles,
  X,
  Upload,
  Download,
  FileText,
  Trash2,
  QrCode,
  Settings,
  ListChecks,
  Search,
  CheckSquare,
  Square,
  Check,
  Power,
  ChevronDown,
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'pending_verification', label: 'Verify Payment', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'preparing', label: 'Preparing', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { id: 'ready', label: 'Ready', color: 'text-green-400', bg: 'bg-green-500/10' },
  { id: 'collected', label: 'Collected', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  { id: 'cancelled', label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10' },
  { id: 'all', label: 'All Orders', color: 'text-foreground', bg: 'bg-muted' },
] as const;

const DISH_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snack', label: 'Snacks' },
  { id: 'cool_drinks', label: 'Cool Drinks' },
  { id: 'hot_drinks', label: 'Hot Drinks' },
  { id: 'fresh_drinks', label: 'Fresh Drinks' },
  { id: 'smoothies', label: 'Smoothies' },
  { id: 'hydrants', label: 'Hydrants' },
  { id: 'dinner', label: 'Dinner' },
] as const;

function DishFlash() {
  const [activeDish, setActiveDish] = useState<any>(null);
  const { allMenuItems } = useCafeManager();
  const prevCount = useRef(allMenuItems?.length || 0);

  useEffect(() => {
    if (allMenuItems && allMenuItems.length > prevCount.current) {
      const newItems = allMenuItems.filter(item => {
        const itemDate = new Date(item.created_at || '');
        const now = new Date();
        return now.getTime() - itemDate.getTime() < 5000;
      });
      if (newItems.length > 0) {
        setActiveDish(newItems[0]);
        const timer = setTimeout(() => setActiveDish(null), 6000);
        return () => clearTimeout(timer);
      }
    }
    prevCount.current = allMenuItems?.length || 0;
  }, [allMenuItems]);

  if (!activeDish) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] animate-in fade-in duration-500" />
      <div className="relative w-full max-w-sm pointer-events-auto">
        <div className="absolute -inset-4 bg-gradient-to-r from-primary via-orange-500 to-primary opacity-30 blur-2xl animate-pulse" />
        <div className="relative p-1 rounded-[32px] bg-gradient-to-b from-white/20 to-transparent border border-white/10 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-orange-500/20 animate-gradient-x" />
          <div className="relative bg-card rounded-[28px] overflow-hidden flex flex-col items-center">
            <div className="w-full py-3 bg-primary/10 flex items-center justify-center gap-2 border-b border-primary/10">
              <Sparkles className="w-4 h-4 text-primary animate-spin-slow" />
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">New Masterpiece Added!</span>
              <Sparkles className="w-4 h-4 text-primary animate-spin-slow" />
            </div>
            <div className="w-full aspect-[11/14] p-4">
              <div className="w-full h-full rounded-2xl overflow-hidden border-4 border-white/5 shadow-2xl relative group">
                {activeDish.item_image_url ? (
                  <img src={activeDish.item_image_url} alt="" className="w-full h-full object-cover animate-in zoom-in-110 [animation-duration:3000ms] ease-out fill-mode-backwards" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                    <ChefHat className="w-20 h-20 text-primary/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 animate-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-backwards">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Signature Dish</span>
                    </div>
                    <h4 className="text-3xl font-black text-white uppercase italic tracking-tighter drop-shadow-2xl leading-none mb-2">{activeDish.item_name}</h4>
                    <div className="flex items-center gap-4 mt-3">
                        <div className="px-4 py-1.5 rounded-full bg-primary text-white text-sm font-black shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)] italic border border-white/20">
                            ₹{activeDish.price}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                            <span className="text-[10px] font-black text-white/90 uppercase tracking-widest bg-white/10 px-2 py-1 rounded-md backdrop-blur-md border border-white/10">
                                {activeDish.category}
                            </span>
                        </div>
                    </div>
                </div>
              </div>
            </div>
            <div className="w-full p-4 pt-0">
              <button
                onClick={() => setActiveDish(null)}
                className="w-full py-3 rounded-xl bg-muted/50 hover:bg-muted text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                Awesome! <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ManagerView = 'orders' | 'menu' | 'ads' | 'closing' | 'payment-settings' | 'ratings';

export function CafeManagerDashboard({ activeAd, setActiveAd }: { activeAd: any, setActiveAd: (ad: any) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const manager = useCafeManager();
  const { uploadImage, addMenuItem, updateMenuItem, deleteMenuItem, isUploading } = useCafeMenu();
  const ads = useCafeAds();
  const { settings: cafeSettings, updateSettings: updateCafeSettings } = useCafeSettings();

  const [activeTab, setActiveTab] = useState('pending_verification');
  const [view, setView] = useState<ManagerView>('orders');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CafeOrder | null>(null);
  const [orderItems, setOrderItems] = useState<CafeOrderItem[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [showProofModal, setShowProofModal] = useState<string | null>(null);

  // Quick Add Today's Menu
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddSelected, setQuickAddSelected] = useState<Set<string>>(new Set());
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddPublishing, setQuickAddPublishing] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [menuForm, setMenuForm] = useState({
    item_name: '',
    item_description: '',
    category: 'lunch',
    price: '',
    available_date: format(new Date(), 'yyyy-MM-dd'),
    available_from: '',
    available_to: '',
    is_veg: true,
    is_non_veg: false,
    stock_quantity: '',
    unlimited_stock: true,
    prep_time_minutes: '',
    spice_level: '',
    master_item_id: '',
  });

  const [masterForm, setMasterForm] = useState({
    item_name: '',
    item_description: '',
    category: 'lunch',
    price: '',
    is_veg: true,
    is_non_veg: false,
    prep_time_minutes: '',
    spice_level: '',
    allergens: '',
  });

  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);

  // Get unique dishes (deduplicated by name) for quick add
  const uniqueDishes = useMemo(() => {
    if (!manager.allMenuItems) return [];
    const map = new Map<string, typeof manager.allMenuItems[0]>();
    manager.allMenuItems.forEach(item => {
      // Keep the most recent version of each dish
      if (!map.has(item.item_name)) {
        map.set(item.item_name, item);
      }
    });
    return Array.from(map.values());
  }, [manager.allMenuItems]);

  const filteredQuickAddDishes = useMemo(() => {
    // Primary source: Master Catalog (only active items for the browser)
    const masterItems = (manager.masterMenuItems || []).filter(m => m.is_active);
    
    // Fallback/Legacy: Unique items from history (for transition)
    const historyItems = uniqueDishes.filter(hd => 
      !masterItems.some(mi => mi.item_name.toLowerCase() === hd.item_name.toLowerCase())
    );

    const pool = [
      ...masterItems.map(m => ({ 
        ...m, 
        isMaster: true, 
        price: m.price,
        is_active: true,
        available_from: '',
        available_to: '',
        stock_quantity: null,
        unlimited_stock: true,
        item_description: (m as any).item_description || (m as any).description || '',
        is_veg: (m as any).is_veg ?? true,
        is_non_veg: (m as any).is_non_veg ?? false,
      })), 
      ...historyItems.map(h => ({ 
        ...h, 
        isMaster: false,
        is_active: true 
      }))
    ];

    if (!quickAddSearch.trim()) return pool;
    const q = quickAddSearch.toLowerCase();
    return pool.filter(d =>
      d.item_name.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
    );
  }, [manager.masterMenuItems, uniqueDishes, quickAddSearch]);

  const toggleQuickAddItem = (itemId: string) => {
    setQuickAddSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleQuickAddPublishOne = async (masterId: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    try {
      const source = filteredQuickAddDishes.find(d => d.id === masterId);
      if (!source) return;

      const { error } = await supabase
        .from('cafe_menu_items')
        .insert({
          item_name: source.item_name,
          item_description: source.item_description,
          category: source.category,
          price: source.price,
          available_date: todayStr,
          available_from: (source as any).available_from || null,
          available_to: (source as any).available_to || null,
          is_veg: (source as any).is_veg ?? true,
          is_non_veg: (source as any).is_non_veg ?? false,
          stock_quantity: (source as any).stock_quantity || null,
          unlimited_stock: (source as any).unlimited_stock ?? true,
          prep_time_minutes: source.prep_time_minutes || null,
          spice_level: source.spice_level || null,
          allergens: source.allergens || null,
          item_image_url: source.item_image_url,
          is_available: true,
          master_item_id: (source as any).isMaster ? masterId : null,
          created_by: user!.id,
        } as any);

      if (error) throw error;
      toast({ title: `✅ ${source.item_name} added to today's menu!` });
      queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleEditMaster = (item: any) => {
    setMasterForm({
      item_name: item.item_name,
      item_description: item.item_description || '',
      category: item.category,
      price: (item.price ?? 0).toString(),
      is_veg: item.is_veg ?? true,
      is_non_veg: item.is_non_veg ?? false,
      prep_time_minutes: item.prep_time_minutes?.toString() || '',
      spice_level: item.spice_level || '',
      allergens: item.allergens || '',
    });
    setEditingMasterId(item.id);
    setImagePreview(item.item_image_url || null);
    setSelectedFile(null);
    setView('menu');
    toast({ title: '📋 Editing Master Dish' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickAddPublish = async () => {
    if (quickAddSelected.size === 0) return;
    setQuickAddPublishing(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let successCount = 0;
    try {
      for (const itemId of quickAddSelected) {
        const source = filteredQuickAddDishes.find(d => d.id === itemId);
        if (!source) continue;
        const { error } = await supabase
          .from('cafe_menu_items')
          .insert({
            item_name: source.item_name,
            item_description: source.item_description,
            category: source.category,
            price: source.price,
            available_date: todayStr,
            available_from: source.available_from || null,
            available_to: source.available_to || null,
            is_veg: source.is_veg,
            is_non_veg: source.is_non_veg,
            stock_quantity: source.stock_quantity || null,
            unlimited_stock: source.unlimited_stock ?? true,
            prep_time_minutes: source.prep_time_minutes || null,
            spice_level: source.spice_level || null,
            allergens: source.allergens || null,
            item_image_url: source.item_image_url,
            is_available: true,
            master_item_id: (source as any).isMaster ? source.id : undefined,
            created_by: user!.id,
          });
        if (!error) successCount++;
      }
      toast({ title: `✅ ${successCount} dishes added to today's menu!` });
      setQuickAddSelected(new Set());
      setShowQuickAdd(false);
      // Properly invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setQuickAddPublishing(false);
    }
  };

  const handleReuse = (item: any) => {
    setEditingItemId(null);
    setMenuForm({
      item_name: item.item_name,
      item_description: item.item_description || '',
      category: item.category,
      price: item.price.toString(),
      available_date: format(new Date(), 'yyyy-MM-dd'),
      available_from: item.available_from || '',
      available_to: item.available_to || '',
      is_veg: item.is_veg,
      is_non_veg: item.is_non_veg,
      stock_quantity: item.stock_quantity?.toString() || '',
      unlimited_stock: item.unlimited_stock,
      prep_time_minutes: item.prep_time_minutes?.toString() || '',
      spice_level: item.spice_level || '',
      master_item_id: item.master_item_id || '',
    });
    setImagePreview(item.item_image_url || null);
    setSelectedFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({ title: '📋 Item details copied! Set a date to save.' });
  };

  const handleEdit = (item: any) => {
    setEditingItemId(item.id);
    setMenuForm({
      item_name: item.item_name,
      item_description: item.item_description || '',
      category: item.category,
      price: item.price.toString(),
      available_date: item.available_date,
      available_from: item.available_from || '',
      available_to: item.available_to || '',
      is_veg: item.is_veg,
      is_non_veg: item.is_non_veg,
      stock_quantity: item.stock_quantity?.toString() || '',
      unlimited_stock: item.unlimited_stock,
      prep_time_minutes: item.prep_time_minutes?.toString() || '',
      spice_level: item.spice_level || '',
      master_item_id: item.master_item_id || '',
    });
    setImagePreview(item.item_image_url || null);
    setSelectedFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setMenuForm({
      item_name: '',
      item_description: '',
      category: 'lunch',
      price: '',
      available_date: format(new Date(), 'yyyy-MM-dd'),
      available_from: '',
      available_to: '',
      is_veg: true,
      is_non_veg: false,
      stock_quantity: '',
      unlimited_stock: true,
      prep_time_minutes: '',
      spice_level: '',
      master_item_id: '',
    });
    setImagePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const loadOrderItems = async (orderId: string) => {
    try {
      const items = await manager.fetchOrderItems(orderId);
      setOrderItems(items);
    } catch {
      setOrderItems([]);
    }
  };

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Maximum size is 2MB', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  const filteredOrders = (activeTab === 'all' ? manager.allOrders || [] : manager.todayOrders).filter(order => {
    if (activeTab === 'all') return order.order_status !== 'cancelled';
    if (activeTab === 'pending_verification') {
      return (order.payment_status === 'proof_uploaded' || order.payment_status === 'pending_proof') && 
             order.order_status !== 'cancelled';
    }
    return order.order_status === activeTab;
  });

  const handleVerify = async (orderId: string) => {
    try {
      await manager.verifyAndPrepare.mutateAsync(orderId);
      toast({ title: '✅ Payment Verified & Preparing!' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleReject = async (orderId: string) => {
    if (!rejectReason.trim()) return;
    try {
      await manager.rejectPayment.mutateAsync({ orderId, reason: rejectReason });
      setShowRejectModal(null);
      setRejectReason('');
      toast({ title: '❌ Payment Rejected' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleTrust = async (orderId: string) => {
    try {
      await manager.trustAndPrepare.mutateAsync(orderId);
      toast({ title: '🍳 Trust & Prepare!' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleReady = async (orderId: string) => {
    try {
      await manager.markReady.mutateAsync(orderId);
      toast({ title: '🎉 Marked Ready!' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleCollected = async (orderId: string) => {
    try {
      await manager.markCollected.mutateAsync(orderId);
      toast({ title: '✅ Marked as Collected' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await deleteMenuItem.mutateAsync(itemId);
      toast({ title: '🗑️ Item Deleted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleAddMenu = async () => {
    if (!menuForm.item_name || !menuForm.price) {
      toast({ title: 'Fill required fields', variant: 'destructive' });
      return;
    }

    try {
      let imageUrl: string | undefined = undefined;
      
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile);
      } else if (editingItemId) {
        imageUrl = imagePreview || undefined;
      } else if (imagePreview && !selectedFile) {
        imageUrl = imagePreview;
      }

      if (editingItemId) {
        await updateMenuItem.mutateAsync({
          id: editingItemId,
          itemName: menuForm.item_name,
          description: menuForm.item_description || undefined,
          category: menuForm.category,
          price: parseFloat(menuForm.price),
          availableDate: new Date(menuForm.available_date),
          availableFrom: menuForm.available_from || undefined,
          availableTo: menuForm.available_to || undefined,
          isVeg: menuForm.is_veg,
          isNonVeg: menuForm.is_non_veg,
          stockQuantity: menuForm.stock_quantity ? parseInt(menuForm.stock_quantity) : undefined,
          unlimitedStock: menuForm.unlimited_stock,
          prepTimeMinutes: menuForm.prep_time_minutes ? parseInt(menuForm.prep_time_minutes) : undefined,
          spiceLevel: menuForm.spice_level || undefined,
          imageUrl,
          masterItemId: menuForm.master_item_id || undefined,
        });
        toast({ title: '✅ Menu Item Updated!' });
      } else {
        await addMenuItem.mutateAsync({
          itemName: menuForm.item_name,
          description: menuForm.item_description || undefined,
          category: menuForm.category,
          price: parseFloat(menuForm.price),
          availableDate: new Date(menuForm.available_date),
          availableFrom: menuForm.available_from || undefined,
          availableTo: menuForm.available_to || undefined,
          isVeg: menuForm.is_veg,
          isNonVeg: menuForm.is_non_veg,
          stockQuantity: menuForm.stock_quantity ? parseInt(menuForm.stock_quantity) : undefined,
          unlimitedStock: menuForm.unlimited_stock,
          prepTimeMinutes: menuForm.prep_time_minutes ? parseInt(menuForm.prep_time_minutes) : undefined,
          spiceLevel: menuForm.spice_level || undefined,
          imageUrl,
          masterItemId: menuForm.master_item_id || undefined,
        });
        toast({ title: '✅ Menu Item Added!' });
      }

      handleCancelEdit();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleMasterSubmit = async () => {
    if (!masterForm.item_name || !masterForm.price) {
      toast({ title: 'Fill required fields', variant: 'destructive' });
      return;
    }

    try {
      let imageUrl: string | undefined = undefined;
      if (selectedFile) {
        imageUrl = await uploadImage(selectedFile); // We use the same bucket for now or a different one
      } else if (editingMasterId) {
        imageUrl = imagePreview || undefined;
      }

      const payload = {
        item_name: masterForm.item_name,
        category: masterForm.category,
        price: parseFloat(masterForm.price),
        is_veg: masterForm.is_veg,
        is_non_veg: masterForm.is_non_veg,
        prep_time_minutes: masterForm.prep_time_minutes ? parseInt(masterForm.prep_time_minutes) : undefined,
        spice_level: masterForm.spice_level || undefined,
        allergens: masterForm.allergens || undefined,
        item_image_url: imageUrl,
        item_description: masterForm.item_description || null,
        is_active: true,
      };

      if (editingMasterId) {
        await manager.updateMasterItem.mutateAsync({ id: editingMasterId, ...payload });
        toast({ title: '✅ Master Menu Item Updated!' });
      } else {
        await manager.addMasterItem.mutateAsync(payload);
        toast({ title: '✅ Added to Master Menu!' });
      }

      setEditingMasterId(null);
      setMasterForm({
        item_name: '',
        item_description: '',
        category: 'lunch',
        price: '',
        is_veg: true,
        is_non_veg: false,
        prep_time_minutes: '',
        spice_level: '',
        allergens: '',
      });
      setImagePreview(null);
      setSelectedFile(null);
      setShowAddForm(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };



  const handleCopyToMaster = (item: any) => {
    setEditingMasterId(null);
    setMasterForm({
      item_name: item.item_name,
      item_description: item.item_description || '',
      category: item.category,
      price: item.price.toString(),
      is_veg: item.is_veg,
      is_non_veg: item.is_non_veg,
      prep_time_minutes: item.prep_time_minutes?.toString() || '',
      spice_level: item.spice_level || '',
      allergens: item.allergens || '',
    });
    setImagePreview(item.item_image_url || null);
    setSelectedFile(null);
    setView('menu');
    toast({ title: '📋 Copied to Master Form. Review and save.' });
  };

  const NAV_ITEMS: { id: ManagerView; label: string; icon: typeof Coffee }[] = [
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'menu', label: 'Menu', icon: ListChecks },
    { id: 'ads', label: 'Ads/Flash', icon: Sparkles },
    { id: 'ratings', label: 'Ratings', icon: Star },
    { id: 'closing', label: 'Closing', icon: Ban },
  ];
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Helper to check if a master item is published AND available for today
  const isPublishedActiveToday = (masterItemId: string) => {
    return (manager.allMenuItems as any[])?.some(item =>
      item.master_item_id === masterItemId && item.available_date === todayStr && item.is_available
    );
  };

  // Legacy helper (keep for backward compat in quick-add section)
  const isTargetDatePublished = (masterItemId: string, date: string) => {
    return (manager.allMenuItems as any[])?.some(item =>
      item.master_item_id === masterItemId && item.available_date === date
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12 selection:bg-primary/30">
      <div className="bg-background/80 backdrop-blur-3xl border-b border-white/[0.05] py-2 px-4 mb-4 shadow-lg">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative group/logo">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-0 group-hover/logo:scale-150 transition-transform duration-1000" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/40 flex items-center justify-center shadow-lg shrink-0 border border-white/20 transform group-hover/logo:rotate-3 transition-transform duration-500">
                <ChefHat className="w-5 h-5 text-white drop-shadow-md" />
              </div>
            </div>
            <div className="min-w-0 flex flex-col gap-0">
              <h1 className="text-lg font-[1000] text-white tracking-[-0.04em] leading-none uppercase italic">Cafe Manager</h1>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="flex items-center gap-1.5 px-1.5 py-0.25 rounded-full bg-white/[0.02] border border-white/5">
                  <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                  <p className="text-[7.5px] text-primary font-black uppercase tracking-[0.1em] opacity-80">
                    {format(new Date(), 'EEEE, d MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide py-1">
            <div className="flex items-center bg-white/[0.02] p-1 rounded-[18px] border border-white/[0.05] backdrop-blur-3xl shadow-inner-xl shrink-0">
              {NAV_ITEMS.map(item => {
                const isActive = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-[14px] text-[9px] font-black tracking-[0.1em] uppercase transition-all duration-300 relative group/nav ${
                      isActive
                        ? 'bg-primary text-white shadow-[0_8px_16px_rgba(var(--primary),0.2)] scale-105'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon className={`w-3 h-3 relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover/nav:scale-105'}`} />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
               {/* Performance Badge */}
               <div className="flex items-center gap-2 px-3 py-2 rounded-[18px] bg-white/[0.02] border border-white/5 shadow-inner group/reviews transition-all hover:bg-white/[0.04]">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]" />
                <div className="flex flex-col">
                  <span className="text-sm font-black text-white leading-none">{manager.stats.totalReviews}</span>
                  <span className="text-[7px] font-black text-muted-foreground uppercase tracking-widest opacity-40">PERF</span>
                </div>
              </div>

              <button
                onClick={() => updateCafeSettings.mutate({ is_open: cafeSettings?.is_open !== true })}
                disabled={updateCafeSettings.isPending || !cafeSettings}
                className={`group flex items-center gap-2 px-4 py-2.5 rounded-[18px] border font-black text-[9px] uppercase tracking-widest transition-all duration-500 disabled:opacity-50 ${
                  cafeSettings?.is_open === true
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 shadow-emerald-500/10'
                    : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                }`}
              >
                <Power className={`w-3.5 h-3.5 group-hover:rotate-12 transition-transform ${cafeSettings?.is_open === true ? '' : 'animate-pulse'}`} />
                <span>{cafeSettings?.is_open === true ? 'ON' : 'OFF'}</span>
              </button>
              
              <button
                onClick={() => setView('payment-settings')}
                className={`w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/5 transition-all group active:scale-95 shadow-md ${view === 'payment-settings' ? 'text-primary border-primary/40 bg-primary/10' : 'text-white/30 hover:text-white hover:border-white/20'}`}
              >
                <Settings className={`w-3.5 h-3.5 transition-transform duration-1000 ${view === 'payment-settings' ? 'rotate-180' : 'group-hover:rotate-90'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1700px] mx-auto px-4">
        {/* Global Stats - Ultra Dense Analytics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Today', value: manager.stats.totalToday, icon: ShoppingCart, color: 'text-sky-400', bg: 'bg-sky-500/10' },
            { label: 'Verify', value: manager.stats.pendingVerification, icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Kitchen', value: manager.stats.preparing, icon: ChefHat, color: 'text-orange-400', bg: 'bg-orange-500/10' },
            { label: 'Revenue', value: `₹${manager.stats.totalRevenue.toLocaleString()}`, icon: IndianRupee, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(stat => (
            <div key={stat.label} className="group relative p-3 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-3xl shadow-sm overflow-hidden transition-all duration-500 hover:bg-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-6 h-6 rounded-md ${stat.bg} border border-white/5 flex items-center justify-center`}>
                  <stat.icon className={`w-3 h-3 ${stat.color}`} />
                </div>
                <div className="text-[6px] font-black text-muted-foreground uppercase tracking-[0.1em] opacity-30">{stat.label}</div>
              </div>
              <h4 className="text-lg font-black text-white tracking-tighter tabular-nums truncate">
                {stat.value}
              </h4>
            </div>
          ))}
        </div>

      {/* ===== ORDERS VIEW ===== */}
      {view === 'orders' && (
        <>
          {/* Order Status Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-8 bg-white/[0.02] p-2 rounded-[24px] border border-white/5">
            {STATUS_TABS.map(tab => {
              const count = tab.id === 'all'
                ? (manager.allOrders?.filter(o => o.order_status !== 'cancelled') || []).length
                : tab.id === 'pending_verification'
                  ? (manager.todayOrders?.filter(o => (o.payment_status === 'proof_uploaded' || o.payment_status === 'pending_proof') && o.order_status !== 'cancelled') || []).length
                  : tab.id === 'cancelled'
                    ? (manager.allOrders?.filter(o => o.order_status === 'cancelled') || []).length
                    : (manager.todayOrders?.filter(o => o.order_status === tab.id) || []).length;

              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border ${
                    isActive
                      ? `${tab.bg} ${tab.color} border-current/30 shadow-[0_8px_20px_rgba(0,0,0,0.4)] scale-[1.02]`
                      : 'text-muted-foreground border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-current animate-pulse' : 'bg-muted-foreground/20'}`} />
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                    isActive ? 'bg-current/10' : 'bg-white/5 opacity-40'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Order Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {manager.ordersLoading ? (
              <div className="col-span-full flex flex-col items-center justify-center py-32 gap-4">
                <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em]">Syncing Orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="col-span-full py-24 rounded-[40px] border border-dashed border-white/10 bg-white/[0.01] flex flex-col items-center">
                <Coffee className="w-16 h-16 text-muted-foreground/10 mb-6" />
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Kitchen Empty</h3>
                <p className="text-[9px] text-muted-foreground/40 mt-2 uppercase tracking-widest">Awaiting incoming orders</p>
              </div>
            ) : (
              filteredOrders.map(order => (
                <ManagerOrderCard
                  key={order.id}
                  order={order}
                  onVerify={() => handleVerify(order.id)}
                  onReject={() => setShowRejectModal(order.id)}
                  onReady={() => handleReady(order.id)}
                  onCollected={() => handleCollected(order.id)}
                  onViewProof={() => setShowProofModal(order.payment_proof_url)}
                  onViewItems={() => { setSelectedOrder(order); loadOrderItems(order.id); }}
                  isVerifying={manager.verifyAndPrepare.isPending}
                />
              ))
            )}
          </div>
        </>
      )}


           {/* ===== UNIFIED MENU VIEW ===== */}
      {view === 'menu' && (
        <div className="px-4 space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-5 duration-500">
          {/* Layout Container: Optimized for 100% Zoom */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
            
            {/* Left Column: Sticky "New Dish" Sidebar */}
            <div className="xl:col-span-1 xl:sticky xl:top-4 self-start">
              <div className="space-y-4">
                <div className="relative p-5 rounded-[32px] border border-white/5 bg-white/[0.02] backdrop-blur-3xl shadow-2xl overflow-hidden group/form transition-all duration-700 hover:bg-white/[0.04]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[60px] group-hover/form:bg-primary/20 transition-all duration-1000" />
                  
                  <div className="relative mb-6 flex flex-col gap-2">
                    <div className="flex items-center justify-between w-full">
                      <div className="space-y-1">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">
                          {editingMasterId ? 'Edit Dish' : 'New Dish'}
                        </h3>
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                           <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">
                             {editingMasterId ? 'Update catalog' : 'Create entry'}
                           </p>
                        </div>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-lg shadow-primary/5">
                        <ChefHat className="w-5 h-5 text-primary group-hover/form:rotate-12 transition-transform duration-500" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Image Upload Area */}
                    <div className="relative aspect-square w-full rounded-[32px] border-2 border-dashed border-white/5 hover:border-primary/40 transition-all duration-500 flex flex-col items-center justify-center gap-4 bg-white/[0.01] group/upload overflow-hidden shadow-inner">
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover/upload:scale-110" alt="Preview" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/upload:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-md">
                            <button onClick={() => { setImagePreview(null); setSelectedFile(null); }} className="p-4 bg-red-500/80 text-white rounded-[24px] shadow-2xl hover:bg-red-500 transition-all active:scale-90 border border-white/20">
                              <Trash2 className="w-6 h-6" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 rounded-[24px] bg-primary/5 flex items-center justify-center group-hover/upload:scale-110 group-hover/upload:bg-primary/10 transition-all duration-700 shadow-xl border border-white/5">
                            <Upload className="w-8 h-8 text-primary/60 group-hover/upload:text-primary transition-colors" />
                          </div>
                          <div className="text-center space-y-1">
                            <p className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Upload Dish Visual</p>
                            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">PNG, JPG • MAX 2MB</p>
                          </div>
                          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                        </>
                      )}
                    </div>

                    {/* Identity Section */}
                    <div className="space-y-5">
                      <div className="space-y-2.5">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-2 opacity-50">Dish Identity</label>
                        <div className="relative group/input">
                          <input
                            placeholder="e.g., Signature Garlic Pasta"
                            value={masterForm.item_name}
                            onChange={(e) => setMasterForm({ ...masterForm, item_name: e.target.value })}
                            className="w-full h-14 bg-white/[0.03] border border-white/5 focus:border-primary/50 outline-none rounded-2xl px-6 text-sm font-black text-white transition-all placeholder:text-white/10"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2.5">
                          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-2 opacity-50">Price (₹)</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={masterForm.price}
                            onChange={(e) => setMasterForm({ ...masterForm, price: e.target.value })}
                            className="w-full h-14 bg-white/[0.03] border border-white/5 focus:border-primary/50 outline-none rounded-2xl px-6 text-sm font-black text-white transition-all"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-2 opacity-50">Category</label>
                          <div className="relative group/category">
                            <select
                              value={masterForm.category}
                              onChange={(e) => setMasterForm({ ...masterForm, category: e.target.value })}
                              className="w-full h-14 bg-white/[0.03] border border-white/5 focus:border-primary/50 outline-none rounded-2xl pl-6 pr-10 text-[10px] font-black text-white transition-all appearance-none cursor-pointer uppercase tracking-[0.1em] relative z-10"
                            >
                              {DISH_CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.id} className="bg-[#0a0a0a] text-white py-2">
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-40 group-focus-within/category:opacity-100 z-20 pointer-events-none transition-all" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <button 
                          onClick={() => setMasterForm({ ...masterForm, is_veg: true, is_non_veg: false })}
                          className={`h-12 rounded-2xl border font-black text-[9px] uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3 ${masterForm.is_veg ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-[0_8px_20px_rgba(16,185,129,0.1)]' : 'bg-white/[0.02] border-white/5 text-muted-foreground/30 hover:bg-white/5'}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${masterForm.is_veg ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-white/10'}`} />
                          VEG
                        </button>
                        <button 
                          onClick={() => setMasterForm({ ...masterForm, is_veg: false, is_non_veg: true })}
                          className={`h-12 rounded-2xl border font-black text-[9px] uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3 ${masterForm.is_non_veg ? 'bg-red-500/10 border-red-500/40 text-red-500 shadow-[0_8px_20px_rgba(239,68,68,0.1)]' : 'bg-white/[0.02] border-white/5 text-muted-foreground/30 hover:bg-white/5'}`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${masterForm.is_non_veg ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-white/10'}`} />
                          NON-VEG
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-2 opacity-50">Flavor Profile (Optional)</label>
                        <textarea
                          placeholder="Describe the taste, ingredients, and soul of this dish..."
                          value={masterForm.item_description || ''}
                          onChange={(e) => setMasterForm({ ...masterForm, item_description: e.target.value })}
                          className="w-full min-h-[100px] bg-white/[0.03] border border-white/5 focus:border-primary/50 outline-none rounded-3xl font-medium px-6 py-5 text-xs text-white/80 resize-none transition-all placeholder:text-white/10 leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <button
                        onClick={handleMasterSubmit}
                        disabled={isUploading}
                        className="w-full h-12 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 skew-x-[35deg]" />
                        {editingMasterId ? 'Commit Update' : 'Live to Catalog'}
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                      </button>
                      {editingMasterId && (
                        <button
                          onClick={() => {
                            setEditingMasterId(null);
                            setMasterForm({ item_name: '', item_description: '', category: 'lunch', price: '', is_veg: true, is_non_veg: false, prep_time_minutes: '', spice_level: '', allergens: '' });
                            setImagePreview(null);
                          }}
                          className="w-full h-12 bg-white/5 hover:bg-white/10 text-muted-foreground font-black text-[9px] uppercase tracking-widest rounded-2xl transition-all"
                        >
                          Discard Edits
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Master Catalog Grid */}
            <div className="xl:col-span-3 space-y-6">
              <div className="flex items-center justify-between px-2">
                 <div className="flex flex-col">
                    <h2 className="text-xl font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                      Unified Menu Catalog
                      <span className="text-[8px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                        MASTER
                      </span>
                    </h2>
                    <p className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-0.5">Manage all dishes and their historical performance</p>
                 </div>
                 
                 <div className="flex items-center gap-3">
                    <div className="relative group/search">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground opacity-40 group-focus-within/search:text-primary transition-all" />
                      <input 
                        placeholder="Search catalog..."
                        value={quickAddSearch}
                        onChange={(e) => setQuickAddSearch(e.target.value)}
                        className="w-48 pl-9 pr-3 py-1.5 bg-secondary/20 border border-border/50 rounded-lg text-[10px] font-bold focus:outline-none focus:border-primary/50 focus:w-64 transition-all duration-300"
                      />
                    </div>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pr-2">
                  {filteredQuickAddDishes.map((item) => {
                    const isItemMaster = (item as any).isMaster || (!!item.id && !(item as any).master_item_id);
                    const isOnToday = (manager.allMenuItems as any[])?.some(mi => {
                      if (isItemMaster) {
                        // Count as ON if a master-linked row OR a same-named legacy row is available today
                        return (
                          (mi.master_item_id === item.id || (!mi.master_item_id && mi.item_name === item.item_name))
                          && mi.available_date === todayStr
                          && mi.is_available
                        );
                      } else {
                        return mi.item_name === item.item_name && !(mi as any).master_item_id && mi.available_date === todayStr && mi.is_available;
                      }
                    });
                    
                    return (
                      <div key={item.id} className="group relative rounded-[32px] border border-border/40 bg-card/40 backdrop-blur-xl hover:bg-card/60 transition-all duration-500 overflow-hidden flex flex-col shadow-2xl hover:shadow-primary/5 min-h-[420px]">
                        {/* Image Header */}
                        <div className="relative aspect-video w-full overflow-hidden">
                          <img 
                            src={item.item_image_url || '/placeholder.png'} 
                            alt="" 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          
                          <div className="absolute top-4 left-4 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
                            <span className="text-[9px] font-black text-white/90 uppercase tracking-[0.15em] bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-xl">
                              {DISH_CATEGORIES.find(c => c.id === item.category)?.label || item.category.replace('_', ' ')}
                            </span>
                          </div>

                          {isOnToday && (
                            <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-emerald-500 shadow-[0_5px_15px_rgba(16,185,129,0.3)] text-[8px] font-black text-white border border-emerald-400/50 animate-pulse">
                              LIVE TODAY
                            </div>
                          )}

                          <div className="absolute bottom-4 right-4">
                            <button
                              onClick={async () => {
                                try {
                                  await manager.toggleMasterItemForToday.mutateAsync({ 
                                    masterItem: item as any, 
                                    enable: !isOnToday,
                                    isLegacy: !isItemMaster
                                  });
                                  toast({ title: !isOnToday ? `🟢 ${item.item_name} is now LIVE` : `⚪ ${item.item_name} is now HIDDEN` });
                                } catch (error: any) {
                                  toast({ title: "Toggle Failed", description: error.message, variant: "destructive" });
                                }
                              }}
                              className={`relative w-[56px] h-7 rounded-full transition-all duration-500 cursor-pointer shadow-xl border-2 ${
                                isOnToday 
                                  ? 'bg-emerald-500 border-emerald-400' 
                                  : 'bg-white/10 border-white/20 backdrop-blur-md'
                              }`}
                            >
                              <div className={`absolute top-0.5 aspect-square h-5 rounded-full bg-white shadow-2xl transition-all duration-300 ${isOnToday ? 'left-[28px]' : 'left-0.5'}`} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="p-5 space-y-4 flex-1 flex flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-base font-black text-foreground uppercase truncate tracking-tight group-hover:text-primary transition-colors duration-300">
                                {item.item_name}
                              </h4>
                              <p className="text-[10px] text-muted-foreground font-medium italic truncate mt-0.5 opacity-60">
                                {item.item_description || 'No description provided'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-black text-primary tracking-tight">₹{item.price}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-auto">
                             <div className="p-2 flex flex-col gap-1 transition-colors">
                                <div className="flex items-center gap-1.5">
                                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                  <span className="text-[11px] font-black text-foreground">{(item.average_rating || 0).toFixed(1)}</span>
                                </div>
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter opacity-50">{item.review_count || 0} Reviews</span>
                             </div>
                             <div className="p-2 flex flex-col gap-1 transition-colors">
                                <div className="flex items-center gap-1.5">
                                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[11px] font-black text-foreground">{(item as any).total_orders || 0}</span>
                                </div>
                                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter opacity-50">Total Orders</span>
                             </div>
                          </div>

                          <div className="pt-5 border-t border-white/5 mt-auto flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                              <p className={`text-[9px] font-black uppercase tracking-[0.1em] flex items-center gap-1.5 ${isOnToday ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnToday ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-muted-foreground/20'}`} />
                                {isOnToday ? 'Published' : 'Cataloged'}
                              </p>
                              <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-widest pl-3">Entry Status</span>
                            </div>

                            <div className="flex items-center gap-2">
                               <button
                                 onClick={async () => {
                                   try {
                                     console.log('Toggle clicked for item:', item.item_name, 'isMaster:', isItemMaster, 'itemId:', item.id);

                                     if (isOnToday) {
                                       // Delegate to hook so both master-linked AND legacy rows are disabled
                                       await manager.toggleMasterItemForToday.mutateAsync({
                                         masterItem: item as any,
                                         enable: false,
                                         isLegacy: !isItemMaster,
                                       });
                                       toast({ title: 'Item removed from today' });
                                     } else {
                                       console.log('Adding item to today:', item.item_name, 'isMaster:', isItemMaster);

                                       const addPayload: any = {
                                         itemName: item.item_name,
                                         description: item.item_description,
                                         category: item.category,
                                         price: item.price,
                                         availableDate: new Date(),
                                         isVeg: item.is_veg,
                                         isNonVeg: item.is_non_veg,
                                         prepTimeMinutes: item.prep_time_minutes,
                                         spiceLevel: item.spice_level,
                                         allergens: item.allergens,
                                         imageUrl: item.item_image_url,
                                       };

                                       // Only set masterItemId if it's actually a master item with a valid ID
                                       if (isItemMaster && item.id && !(item as any).master_item_id) {
                                         console.log('Item is from master catalog, using masterItemId:', item.id);
                                         addPayload.masterItemId = item.id;
                                       } else {
                                         console.log('Item is legacy/history item, NOT setting masterItemId (will be null)');
                                       }

                                       try {
                                         const result = await addMenuItem.mutateAsync(addPayload);
                                         console.log('Add result:', result);
                                         toast({ title: 'Item added to today' });
                                       } catch (addError: any) {
                                         // If we get foreign key constraint error AND we tried to set masterItemId, retry without it
                                         if (addError?.message?.includes('foreign key constraint') && addPayload.masterItemId) {
                                           console.warn('Foreign key constraint error with masterItemId, retrying without it...');
                                           delete addPayload.masterItemId;
                                           const retryResult = await addMenuItem.mutateAsync(addPayload);
                                           console.log('Retry result:', retryResult);
                                           toast({ title: 'Item added to today' });
                                         } else {
                                           throw addError;
                                         }
                                       }
                                     }
                                   } catch (error: any) {
                                     console.error('Full error object:', error);
                                     console.error('Error message:', error?.message);
                                     console.error('Error data:', error?.data);
                                     const errorMsg = error?.message || JSON.stringify(error);
                                     toast({ title: 'Error', description: `Failed to toggle: ${errorMsg}`, variant: 'destructive' });
                                   }
                                 }}
                                 disabled={addMenuItem.isPending || updateMenuItem.isPending}
                                 className={`h-9 px-3 rounded-xl border font-black text-[9px] uppercase tracking-[0.1em] transition-all duration-300 flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                   isOnToday
                                     ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500 hover:text-white shadow-lg shadow-emerald-500/5'
                                     : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white shadow-lg shadow-primary/5'
                                 }`}
                                 title={isOnToday ? 'Remove from Today' : 'Add to Today'}
                               >
                                 <Power className={`w-3.5 h-3.5 ${isOnToday ? '' : 'opacity-60'}`} />
                                 <span className="hidden sm:inline">{isOnToday ? 'ON' : 'OFF'}</span>
                               </button>

                               <button
                                 onClick={() => handleEditMaster(item)}
                                 className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all duration-300 cursor-pointer shadow-lg shadow-primary/5 active:scale-95"
                                 title="Edit Entry"
                               >
                                 <RefreshCw className="w-4 h-4" />
                               </button>
                               <button
                                 onClick={() => {
                                   if (confirm('Permanently remove this dish from catalog?')) manager.deleteMasterItem.mutate(item.id);
                                 }}
                                 className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all duration-300 cursor-pointer shadow-lg shadow-red-500/5 active:scale-95"
                                 title="Delete Entry"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Empty State */}
              {filteredQuickAddDishes.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-border/40 rounded-[32px] bg-card/20 backdrop-blur-md">
                   <UtensilsCrossed className="w-16 h-16 mx-auto text-muted-foreground/10 mb-4" />
                   <h4 className="text-sm font-black text-muted-foreground/40 uppercase tracking-[0.3em]">No matching dishes</h4>
                   <p className="text-[10px] text-muted-foreground/30 mt-2 uppercase font-bold">Try adjusting your search or add a new dish</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {view === 'closing' && <div className="px-4"><ClosingManager stats={manager.stats} allOrders={manager.allOrders || []} fetchOrdersByRange={manager.fetchOrdersByRange} /></div>}
      {view === 'ads' && <div className="px-4"><AdsManager onFlash={setActiveAd} /></div>}
      {view === 'payment-settings' && <div className="px-4"><PaymentSettings /></div>}
      {view === 'ratings' && <div className="px-4"><RatingList items={manager.masterMenuItems || []} /></div>}

      {/* ===== MODALS & OVERLAYS ===== */}
      
      {selectedOrder && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-card rounded-3xl border border-white/10 shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-foreground mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-mono">#</div>
              Order: {selectedOrder.order_number}
            </h3>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 scrollbar-hide">
              {orderItems.map((item, i) => (
                <div key={i} className="flex flex-col py-3 border-b border-border/50 last:border-0 gap-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight leading-tight">{item.item_name}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-black text-emerald-400 text-sm">₹{item.item_price * item.quantity}</p>
                  </div>
                  {item.special_request && (
                    <div className="px-3 py-1.5 rounded-lg bg-orange-500/5 border border-orange-500/10">
                      <p className="text-[10px] font-medium text-orange-400 italic">"Request: {item.special_request}"</p>
                    </div>
                  )}
                </div>
              ))}

              {selectedOrder.special_instructions && (
                <div className="mt-6 p-5 rounded-[28px] bg-amber-500 transition-all shadow-[0_15px_30px_rgba(245,158,11,0.2)] animate-in slide-in-from-top-4 duration-700">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-white/60 uppercase tracking-widest block leading-none">Important</span>
                      <span className="text-xs font-black text-white uppercase tracking-wider">
                        Overall Special Instructions
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-black text-white leading-relaxed pl-12 drop-shadow-sm">
                    "{selectedOrder.special_instructions}"
                  </p>
                </div>
              )}
            </div>
            <button 
              onClick={() => setSelectedOrder(null)} 
              className="w-full mt-8 py-4 rounded-xl bg-muted font-black uppercase tracking-widest text-[10px] hover:bg-muted/80 transition-all"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-card rounded-3xl border border-white/10 shadow-2xl p-8 animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-foreground mb-4 flex items-center gap-3 italic">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              Reject Payment?
            </h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-4">Please provide a reason for rejecting this transaction</p>
            <textarea 
              className="w-full px-4 py-3 rounded-2xl bg-muted/50 border border-white/5 outline-none mb-6 min-h-[120px] text-sm focus:border-red-500/30 transition-all" 
              placeholder="e.g., Payment proof is invalid or blurry..." 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)} 
            />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowRejectModal(null)} className="py-4 rounded-xl bg-muted font-bold text-[10px] uppercase tracking-widest">Cancel</button>
              <button 
                onClick={() => handleReject(showRejectModal)} 
                className="py-4 rounded-xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {showProofModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm" onClick={() => setShowProofModal(null)}>
          <button className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
            <X className="w-6 h-6" />
          </button>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <img src={showProofModal} className="w-full h-auto rounded-3xl shadow-2xl border border-white/10" alt="Proof" />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function DashboardWrapper() {
  const [activeAd, setActiveAd] = useState<any | null>(null);
  
  return (
    <div className="min-h-screen bg-[#050505]">
      <CafeManagerDashboard activeAd={activeAd} setActiveAd={setActiveAd} />
      <DishFlash />
      {activeAd && (
        <AdFlash ad={activeAd} onClose={() => setActiveAd(null)} />
      )}
    </div>
  );
}
