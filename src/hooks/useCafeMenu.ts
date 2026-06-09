import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Database } from '@/integrations/supabase/types';

export type CafeMenuItem = Database['public']['Tables']['cafe_menu_items']['Row'];

export function useCafeMenu(date?: Date) {
  const queryClient = useQueryClient();
  const targetDate = date || new Date();
  const [isUploading, setIsUploading] = useState(false);

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ['cafe-menu', format(targetDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_menu_items')
        .select('*')
        .eq('available_date', format(targetDate, 'yyyy-MM-dd'))
        .eq('is_available', true)
        .eq('out_of_stock', false)
        .order('category')
        .order('item_name');

      if (error) throw error;
      return data;
    },
  });

  const menuByCategory = useMemo(() => {
    if (!menuItems) return {};
    
    return menuItems.reduce((acc: Record<string, CafeMenuItem[]>, item: CafeMenuItem) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, CafeMenuItem[]>);
  }, [menuItems]);

  const uploadImage = async (file: File) => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `menu-items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cafe-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cafe-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } finally {
      setIsUploading(false);
    }
  };

  const addMenuItem = useMutation({
    mutationFn: async (itemData: {
      itemName: string;
      description?: string;
      category: string;
      price: number;
      availableDate: Date;
      availableFrom?: string;
      availableTo?: string;
      isVeg?: boolean;
      isNonVeg?: boolean;
      stockQuantity?: number;
      unlimitedStock?: boolean;
      prepTimeMinutes?: number;
      spiceLevel?: string;
      allergens?: string;
      imageUrl?: string;
      masterItemId?: string;
    }) => {
      const insertData: Record<string, any> = {
        item_name: itemData.itemName,
        category: itemData.category,
        price: itemData.price,
        available_date: format(itemData.availableDate, 'yyyy-MM-dd'),
        is_veg: itemData.isVeg ?? true,
        is_non_veg: itemData.isNonVeg ?? false,
        unlimited_stock: itemData.unlimitedStock ?? false,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      };

      if (itemData.description !== undefined) insertData.item_description = itemData.description;
      if (itemData.availableFrom !== undefined) insertData.available_from = itemData.availableFrom;
      if (itemData.availableTo !== undefined) insertData.available_to = itemData.availableTo;
      if (itemData.stockQuantity !== undefined) insertData.stock_quantity = itemData.stockQuantity;
      if (itemData.prepTimeMinutes !== undefined) insertData.prep_time_minutes = itemData.prepTimeMinutes;
      if (itemData.spiceLevel !== undefined) insertData.spice_level = itemData.spiceLevel;
      if (itemData.allergens !== undefined) insertData.allergens = itemData.allergens;
      if (itemData.imageUrl !== undefined) insertData.item_image_url = itemData.imageUrl;
      if (itemData.masterItemId !== undefined) insertData.master_item_id = itemData.masterItemId;

      const { data, error } = await supabase
        .from('cafe_menu_items')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    },
  });

  const updateMenuItem = useMutation({
    mutationFn: async ({ id, ...itemData }: {
      id: string;
      itemName?: string;
      description?: string;
      category?: string;
      price?: number;
      availableDate?: Date;
      availableFrom?: string;
      availableTo?: string;
      isVeg?: boolean;
      isNonVeg?: boolean;
      stockQuantity?: number;
      unlimitedStock?: boolean;
      prepTimeMinutes?: number;
      spiceLevel?: string;
      isAvailable?: boolean;
      outOfStock?: boolean;
      imageUrl?: string;
      masterItemId?: string;
    }) => {
      const updateData: Record<string, any> = {};

      if (itemData.itemName !== undefined) updateData.item_name = itemData.itemName;
      if (itemData.description !== undefined) updateData.item_description = itemData.description;
      if (itemData.category !== undefined) updateData.category = itemData.category;
      if (itemData.price !== undefined) updateData.price = itemData.price;
      if (itemData.availableDate !== undefined) updateData.available_date = format(itemData.availableDate, 'yyyy-MM-dd');
      if (itemData.availableFrom !== undefined) updateData.available_from = itemData.availableFrom;
      if (itemData.availableTo !== undefined) updateData.available_to = itemData.availableTo;
      if (itemData.isVeg !== undefined) updateData.is_veg = itemData.isVeg;
      if (itemData.isNonVeg !== undefined) updateData.is_non_veg = itemData.isNonVeg;
      if (itemData.stockQuantity !== undefined) updateData.stock_quantity = itemData.stockQuantity;
      if (itemData.unlimitedStock !== undefined) updateData.unlimited_stock = itemData.unlimitedStock;
      if (itemData.prepTimeMinutes !== undefined) updateData.prep_time_minutes = itemData.prepTimeMinutes;
      if (itemData.spiceLevel !== undefined) updateData.spice_level = itemData.spiceLevel;
      if (itemData.imageUrl !== undefined) updateData.item_image_url = itemData.imageUrl;
      if (itemData.isAvailable !== undefined) updateData.is_available = itemData.isAvailable;
      if (itemData.outOfStock !== undefined) updateData.out_of_stock = itemData.outOfStock;
      if (itemData.masterItemId !== undefined) updateData.master_item_id = itemData.masterItemId;

      const { data, error } = await supabase
        .from('cafe_menu_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
      queryClient.invalidateQueries({ queryKey: ['cafe-manager-menu'] });
    },
  });

  const deleteMenuItem = useMutation({
    mutationFn: async (id: string) => {
      // First get the item to check for an image
      const { data: item } = await supabase
        .from('cafe_menu_items')
        .select('item_image_url')
        .eq('id', id)
        .single();

      // If there's an image, delete it from storage
      if (item?.item_image_url) {
        const path = item.item_image_url.split('/public/cafe-images/').pop();
        if (path) {
          await supabase.storage
            .from('cafe-images')
            .remove([path]);
        }
      }

      const { error } = await supabase
        .from('cafe_menu_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cafe-menu'] });
    },
  });

  return {
    menuItems: menuItems || [],
    menuByCategory,
    isLoading,
    isUploading,
    uploadImage,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
  };
}
