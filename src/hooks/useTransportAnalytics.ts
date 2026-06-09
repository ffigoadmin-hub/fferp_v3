import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Categories to always exclude from transport analysis
const EXCLUDED_CATEGORY_CODES = ['SITE_VISIT', 'SITEVISIT', 'SITE-VISIT'];

const isOtherCategory = (code: string) =>
    ['OTHER', 'OTHERS', 'UNCATEGORIZED'].includes(code?.toUpperCase());

export interface TransportTripAnalytic {
    category_code: string;
    category_name: string;
    total_trips: number;
    total_km: number;
    total_amount: number;
    avg_amount_per_trip: number;
    color_code?: string;
}

export interface TransportMonthlyTrend {
    month: string;
    total_amount: number;
    total_trips: number;
    total_km: number;
}

export interface TransportTopRoute {
    from_location: string;
    to_location: string;
    trip_count: number;
    total_km: number;
    total_amount: number;
}

export interface TransportSummaryStats {
    total_requests: number;
    total_trips: number;
    total_amount: number;
    total_km: number;
    avg_cost_per_trip: number;
    pending_requests: number;
}

export interface MasterCategory {
    code: string;
    name: string;
    color_code?: string;
}

export interface RawTransportTrip {
    requester_name: string;
    requester_dept: string;
    request_id: string;
    trip_date: string;
    from_location: string;
    to_location: string;
    distance_km: number;
    amount: number;
    rate_per_km: number;
    category_code: string;
    category_name: string;
    purpose: string;
    driver_name: string;
    vehicle_number: string;
    status: string;
    created_at: string;
    paid_at: string | null;
    bulk_batch_id: string | null;
    batch_number: string | null;
}

export interface TransportAnalyticsData {
    summaryStats: TransportSummaryStats;
    categoryBreakdown: TransportTripAnalytic[];
    masterCategories: MasterCategory[];  // all from DB, for filter dropdown
    monthlyTrends: TransportMonthlyTrend[];
    topRoutes: TransportTopRoute[];
    rawTrips: RawTransportTrip[];        // for CSV export
    availableBatches: string[];          // list of unique batch IDs for filter
    isLoading: boolean;
}

export function useTransportAnalytics(
    dateRange: { from: string; to: string },
    statusFilter?: string,
    categoryFilter?: string,
    paymentTypeFilter?: 'all' | 'individual' | 'bulk',
    batchNumberFilter?: string
): TransportAnalyticsData {
    const [summaryStats, setSummaryStats] = useState<TransportSummaryStats>({
        total_requests: 0, total_trips: 0, total_amount: 0,
        total_km: 0, avg_cost_per_trip: 0, pending_requests: 0
    });
    const [categoryBreakdown, setCategoryBreakdown] = useState<TransportTripAnalytic[]>([]);
    const [masterCategories, setMasterCategories] = useState<MasterCategory[]>([]);
    const [monthlyTrends, setMonthlyTrends] = useState<TransportMonthlyTrend[]>([]);
    const [topRoutes, setTopRoutes] = useState<TransportTopRoute[]>([]);
    const [rawTrips, setRawTrips] = useState<RawTransportTrip[]>([]);
    const [availableBatches, setAvailableBatches] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch ALL master categories (excluding SITE_VISIT) for dropdown
                const { data: catMasterData } = await (supabase.from('transport_categories') as any)
                    .select('category_code, category_name, color_code')
                    .eq('is_active', true)
                    .order('category_name');

                const catMasterList: MasterCategory[] = [];
                const catMasterMap: Record<string, MasterCategory> = {};
                (catMasterData || []).forEach((c: any) => {
                    const upperCode = (c.category_code || '').toUpperCase().replace(/[-\s]/g, '_');
                    if (EXCLUDED_CATEGORY_CODES.includes(upperCode)) return; // skip SITE_VISIT in dropdown too
                    const entry = { code: c.category_code, name: c.category_name, color_code: c.color_code };
                    catMasterList.push(entry);
                    catMasterMap[c.category_code] = entry;
                });
                // Sort: non-other alpha, others last
                catMasterList.sort((a, b) => {
                    if (isOtherCategory(a.code) && !isOtherCategory(b.code)) return 1;
                    if (!isOtherCategory(a.code) && isOtherCategory(b.code)) return -1;
                    return a.name.localeCompare(b.name);
                });
                setMasterCategories(catMasterList);

                // 2. Fetch all payment requests in date range (filter status client-side for better summary stats)
                const { data, error } = await (supabase.from('payment_requests') as any)
                    .select('id, amount, status, transport_trips, created_at, paid_at, department, bulk_batch_id, bulk_batch:bulk_batches!payment_requests_bulk_batch_id_fkey(batch_id), employee:profiles!payment_requests_requester_id_fkey(name)')
                    .eq('is_transport_payment', true)
                    .gte('created_at', `${dateRange.from}T00:00:00.000Z`)
                    .lte('created_at', `${dateRange.to}T23:59:59.999Z`);

                if (error) throw error;
                const allRequests = data || [];

                // Calculate global pending stats before status filtering
                const pendingRequests = allRequests.filter((r: any) =>
                    !['paid', 'rejected'].includes(r.status)
                ).length;

                // Filter requests based on status for the main charts and breakdown
                const chartRequests = (statusFilter && statusFilter !== 'all')
                    ? allRequests.filter((r: any) => r.status === statusFilter)
                    : allRequests;

                // 3. Flatten ALL trips in range for summary counts
                const rawAllTrips: any[] = [];
                allRequests.forEach((req: any) => {
                    if (req.transport_trips && Array.isArray(req.transport_trips)) {
                        req.transport_trips.forEach((trip: any) => {
                            const upperCode = (trip.category_code || '').toUpperCase().replace(/[-\s]/g, '_');
                            if (EXCLUDED_CATEGORY_CODES.includes(upperCode)) return;
                            const master = catMasterMap[trip.category_code];
                            rawAllTrips.push({
                                ...trip,
                                _resolved_name: master?.name || trip.category_code || 'Uncategorized',
                                _color: master?.color_code,
                                _req_id: req.id,
                                _req_status: req.status,
                                _req_month: req.created_at?.slice(0, 7),
                                _req_date: req.created_at,
                                _paid_at: req.paid_at,
                                _bulk_batch_id: req.bulk_batch_id,
                                _batch_number: req.bulk_batch?.batch_id,
                                _requester: req.employee?.name || 'Unknown',
                                _dept: req.department || '',
                            });
                        });
                    }
                });

                // Extract early: unique batch numbers from ALL transport payments in this range
                const batchSet = new Set<string>();
                rawAllTrips.forEach(t => { if (t._batch_number) batchSet.add(t._batch_number); });
                setAvailableBatches(Array.from(batchSet).sort());

                // 4. Apply filters for Charts & Detailed Tables
                let filteredTrips = rawAllTrips;
                if (statusFilter && statusFilter !== 'all') {
                    filteredTrips = filteredTrips.filter(t => t._req_status === statusFilter);
                }
                if (categoryFilter && categoryFilter !== 'all') {
                    filteredTrips = filteredTrips.filter(t => t.category_code === categoryFilter);
                }
                if (paymentTypeFilter === 'individual') {
                    filteredTrips = filteredTrips.filter(t => !t.bulk_batch_id);
                } else if (paymentTypeFilter === 'bulk') {
                    filteredTrips = filteredTrips.filter(t => !!t.bulk_batch_id);
                    if (batchNumberFilter && batchNumberFilter !== 'all') {
                        filteredTrips = filteredTrips.filter(t => t._batch_number === batchNumberFilter);
                    }
                }

                // 5. Summary Stats (Total Requests should be based on scoped filter, but 'Pending' should be global for the range)
                const totalAmount = filteredTrips.reduce((s: number, t: any) => s + (t.amount || 0), 0);
                const totalKm = filteredTrips.reduce((s: number, t: any) => s + (t.distance_km || 0), 0);
                
                setSummaryStats({
                    total_requests: Array.from(new Set(filteredTrips.map(t => t._req_id))).length,
                    total_trips: filteredTrips.length,
                    total_amount: totalAmount,
                    total_km: totalKm,
                    avg_cost_per_trip: filteredTrips.length > 0 ? totalAmount / filteredTrips.length : 0,
                    pending_requests: pendingRequests // uses the global count from line 140
                });

                // 6. Category Breakdown
                const catMap: Record<string, TransportTripAnalytic> = {};
                filteredTrips.forEach((trip: any) => {
                    const code = trip.category_code || 'UNCATEGORIZED';
                    const name = trip._resolved_name;
                    if (!catMap[code]) {
                        catMap[code] = {
                            category_code: code, category_name: name,
                            total_trips: 0, total_km: 0, total_amount: 0, avg_amount_per_trip: 0,
                            color_code: trip._color
                        };
                    }
                    catMap[code].total_trips += 1;
                    catMap[code].total_km += trip.distance_km || 0;
                    catMap[code].total_amount += trip.amount || 0;
                });
                Object.values(catMap).forEach(c => {
                    c.avg_amount_per_trip = c.total_trips > 0 ? c.total_amount / c.total_trips : 0;
                });
                const sorted = Object.values(catMap).sort((a, b) => {
                    if (isOtherCategory(a.category_code) && !isOtherCategory(b.category_code)) return 1;
                    if (!isOtherCategory(a.category_code) && isOtherCategory(b.category_code)) return -1;
                    return b.total_amount - a.total_amount;
                });
                setCategoryBreakdown(sorted);

                // 7. Monthly Trends
                const monthMap: Record<string, TransportMonthlyTrend> = {};
                rawAllTrips.forEach((trip: any) => {
                    const month = trip._req_month;
                    if (!month) return;
                    if (statusFilter && statusFilter !== 'all' && trip._req_status !== statusFilter) return;
                    if (categoryFilter && categoryFilter !== 'all' && trip.category_code !== categoryFilter) return;
                    if (!monthMap[month]) monthMap[month] = { month, total_amount: 0, total_trips: 0, total_km: 0 };
                    monthMap[month].total_amount += trip.amount || 0;
                    monthMap[month].total_trips += 1;
                    monthMap[month].total_km += trip.distance_km || 0;
                });
                setMonthlyTrends(Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)));

                // 8. Top Routes
                const routeMap: Record<string, TransportTopRoute> = {};
                filteredTrips.forEach((trip: any) => {
                    const from = trip.from_location?.trim() || 'Unknown';
                    const to = trip.to_location?.trim() || 'Unknown';
                    const key = `${from}→${to}`;
                    if (!routeMap[key]) routeMap[key] = { from_location: from, to_location: to, trip_count: 0, total_km: 0, total_amount: 0 };
                    routeMap[key].trip_count += 1;
                    routeMap[key].total_km += trip.distance_km || 0;
                    routeMap[key].total_amount += trip.amount || 0;
                });
                setTopRoutes(
                    Object.values(routeMap).sort((a, b) => b.total_amount - a.total_amount).slice(0, 10)
                );

                // 9. Raw trips for CSV export
                setRawTrips(filteredTrips.map((trip: any) => ({
                    requester_name: trip._requester,
                    requester_dept: trip._dept,
                    request_id: trip._req_id,
                    trip_date: trip.trip_date || '',
                    from_location: trip.from_location || '',
                    to_location: trip.to_location || '',
                    distance_km: trip.distance_km || 0,
                    amount: trip.amount || 0,
                    rate_per_km: trip.rate_per_km || 0,
                    category_code: trip.category_code || '',
                    category_name: trip._resolved_name,
                    purpose: trip.purpose || '',
                    driver_name: trip.driver_name || '',
                    vehicle_number: trip.vehicle_number || '',
                    status: trip._req_status,
                    created_at: trip._req_date,
                    paid_at: trip._paid_at,
                    bulk_batch_id: trip._bulk_batch_id,
                    batch_number: trip._batch_number,
                })));

            } catch (err) {
                console.error('Error fetching transport analytics:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        // Real-time subscription for transport payments
        const channel = supabase
            .channel('transport_analytics_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'payment_requests',
                    filter: 'is_transport_payment=eq.true'
                },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [dateRange.from, dateRange.to, statusFilter, categoryFilter, paymentTypeFilter, batchNumberFilter]);

    return { summaryStats, categoryBreakdown, masterCategories, monthlyTrends, topRoutes, rawTrips, availableBatches, isLoading };
}
