import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TransportCategory {
    id: string;
    category_code: string;
    category_name: string;
    category_description: string | null;
    icon_name: string | null;
    color_code: string | null;
    is_active: boolean;
}

export interface TransportVehicle {
    id: string;
    vehicle_number: string;
    vehicle_type: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    ownership_type: string;
    is_active: boolean;
}

export interface TransportDriver {
    id: string;
    driver_name: string;
    driver_phone: string | null;
    vendor_company: string | null;
    is_active: boolean;
}

export function useTransportMasters() {
    const [categories, setCategories] = useState<TransportCategory[]>([]);
    const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
    const [drivers, setDrivers] = useState<TransportDriver[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [catRes, vehRes, drvRes] = await Promise.all([
                    (supabase.from('transport_categories') as any).select('*').eq('is_active', true).order('category_name'),
                    (supabase.from('transport_vehicles') as any).select('*').eq('is_active', true).order('vehicle_number'),
                    (supabase.from('transport_drivers') as any).select('*').eq('is_active', true).order('driver_name'),
                ]);

                if (catRes.data) setCategories(catRes.data);
                if (vehRes.data) setVehicles(vehRes.data);
                if (drvRes.data) setDrivers(drvRes.data);
            } catch (error) {
                console.error('Error fetching transport masters:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAll();
    }, []);

    return { categories, vehicles, drivers, isLoading };
}
