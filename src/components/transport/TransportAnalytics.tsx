import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTransportExpenses } from '@/hooks/useTransportExpenses';
import { getCategoryColor } from '@/lib/transportHelpers';
import { IndianRupee, Route, TrendingUp, BarChart3, Loader2 } from 'lucide-react';

export function TransportAnalytics() {
    const { expenses, isLoading } = useTransportExpenses();

    const stats = useMemo(() => {
        const totalAmount = expenses.reduce((s, e) => s + e.total_amount, 0);
        const totalKm = expenses.reduce((s, e) => s + e.total_km, 0);
        const totalTrips = expenses.length;
        const avgPerTrip = totalTrips > 0 ? totalAmount / totalTrips : 0;

        const byCategory: Record<string, { count: number; amount: number; km: number }> = {};
        expenses.forEach(e => {
            if (!byCategory[e.category_code]) byCategory[e.category_code] = { count: 0, amount: 0, km: 0 };
            byCategory[e.category_code].count++;
            byCategory[e.category_code].amount += e.total_amount;
            byCategory[e.category_code].km += e.total_km;
        });

        const byStatus: Record<string, number> = {};
        expenses.forEach(e => {
            byStatus[e.status] = (byStatus[e.status] || 0) + 1;
        });

        return { totalAmount, totalKm, totalTrips, avgPerTrip, byCategory, byStatus };
    }, [expenses]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { icon: IndianRupee, label: 'Total Amount', value: `₹${stats.totalAmount.toLocaleString('en-IN')}`, color: 'text-emerald-400' },
                    { icon: Route, label: 'Total KM', value: stats.totalKm.toFixed(1), color: 'text-blue-400' },
                    { icon: BarChart3, label: 'Total Trips', value: stats.totalTrips.toString(), color: 'text-violet-400' },
                    { icon: TrendingUp, label: 'Avg / Trip', value: `₹${stats.avgPerTrip.toFixed(0)}`, color: 'text-amber-400' },
                ].map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-4 rounded-xl border border-border bg-card"
                    >
                        <card.icon className={`w-5 h-5 ${card.color} mb-2`} />
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="text-lg font-bold mt-0.5">{card.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Category Breakdown */}
            <div className="p-4 rounded-xl border border-border bg-card">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> By Category
                </h3>
                <div className="space-y-2">
                    {Object.entries(stats.byCategory)
                        .sort(([, a], [, b]) => b.amount - a.amount)
                        .map(([code, data]) => {
                            const pct = stats.totalAmount > 0 ? (data.amount / stats.totalAmount) * 100 : 0;
                            return (
                                <div key={code} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ background: getCategoryColor(code) }} />
                                            <span className="font-medium uppercase">{code.replace('_', ' ')}</span>
                                        </span>
                                        <span className="text-muted-foreground">
                                            {data.count} trips · ₹{data.amount.toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.6, ease: 'easeOut' }}
                                            className="h-full rounded-full"
                                            style={{ background: getCategoryColor(code) }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
        </div>
    );
}
