import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coffee, DollarSign, TrendingUp, ShoppingBag, Star, LayoutGrid, ArrowUpRight, ArrowDownRight, IndianRupee, Calendar, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { usePalmCafeAnalysis } from '@/hooks/usePalmCafeAnalysis';
import { format, subDays } from 'date-fns';

export function PalmCafeAnalysis() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const { stats, isLoading } = usePalmCafeAnalysis(startDate, endDate);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground italic">Syncing Cafe Intelligence...</p>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Today's Revenue", value: `₹${stats?.todaySales.toLocaleString()}`, sub: "Live Net Sales", icon: IndianRupee, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Orders Count", value: stats?.todayOrderCount, sub: "Today's Volume", icon: ShoppingBag, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Total Menu", value: stats?.totalMenuCount, sub: "Active Dishes", icon: LayoutGrid, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Range Sales", value: `₹${stats?.totalSales.toLocaleString()}`, sub: "Period Registry", icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 p-4 sm:p-0"
    >
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase italic leading-none">
            PALM CAFE <span className="text-primary">Intelligence</span>
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">Executive Sales & Performance Analytics</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker Range */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-3xl shadow-2xl">
            <Calendar className="w-4 h-4 text-primary" />
            <input 
              type="date" 
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="bg-transparent text-[10px] font-black uppercase text-foreground outline-none border-none [color-scheme:dark]"
            />
            <span className="text-muted-foreground text-[10px] font-black">—</span>
            <input 
              type="date" 
              value={format(endDate, 'yyyy-MM-dd')}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              className="bg-transparent text-[10px] font-black uppercase text-foreground outline-none border-none [color-scheme:dark]"
            />
          </div>

          <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-3xl shadow-2xl shadow-primary/10">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80 italic">Live Stream Terminal</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="p-6 rounded-3xl border border-white/5 bg-secondary/20 backdrop-blur-md shadow-2xl relative group overflow-hidden">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className={`w-12 h-12 rounded-2xl ${kpi.bg} flex items-center justify-center border border-white/5 shrink-0 shadow-lg`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{kpi.label}</span>
                <span className="text-2xl font-black text-foreground mt-1 tracking-tighter italic">{kpi.value}</span>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between text-[10px] relative z-10">
              <span className="text-muted-foreground font-black uppercase tracking-widest">{kpi.sub}</span>
              <div className={`flex items-center gap-1 ${kpi.color} font-black uppercase italic`}>
                 <TrendingUp className="w-3 h-3" />
                 Stable
              </div>
            </div>

            {/* Micro Pattern */}
            <div className="absolute -bottom-2 -right-2 opacity-10 scale-150 rotate-12 group-hover:rotate-0 transition-transform duration-700">
               <kpi.icon className={`w-24 h-24 ${kpi.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 p-8 rounded-[2.5rem] border border-white/10 bg-secondary/30 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                   <h3 className="text-xl font-black text-foreground tracking-tight uppercase italic flex items-center gap-3">
                      <TrendingUp className="w-6 h-6 text-primary" />
                      Daily Sales Velocity
                   </h3>
                   <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">7 Day Transaction Inflow History</p>
                </div>
            </div>
            
            <div className="h-[300px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.salesHistory}>
                        <defs>
                            <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis 
                            dataKey="label" 
                            stroke="rgba(255,255,255,0.3)" 
                            fontSize={10} 
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis 
                            stroke="rgba(255,255,255,0.3)" 
                            fontSize={10} 
                            fontWeight="bold"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `₹${v}`}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '20px',
                                backdropFilter: 'blur(20px)',
                                color: '#fff'
                            }}
                            itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="amount" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={4}
                            fillOpacity={1} 
                            fill="url(#colorAmt)" 
                            animationDuration={2000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Top Performer List */}
        <div className="p-8 rounded-[2.5rem] border border-white/10 bg-secondary/30 backdrop-blur-3xl shadow-2xl relative group h-full">
            <h3 className="text-xl font-black text-foreground tracking-tight uppercase italic flex items-center gap-3 mb-8">
                <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                Top Gastronomy
            </h3>
            
            <div className="space-y-4">
                {stats?.topDishes.map((dish: any, i: number) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group/item">
                        <div className="w-12 h-12 rounded-xl border border-white/10 overflow-hidden shrink-0">
                            <img src={dish.item_image_url || '/placeholder.png'} className="w-full h-full object-cover group-hover/item:scale-125 transition-transform duration-700" alt="" />
                        </div>
                        <div className="flex-1 min-w-0">
                             <h4 className="text-[10px] font-black text-foreground uppercase truncate group-hover/item:text-primary transition-colors">{dish.item_name}</h4>
                             <div className="flex items-center gap-2 mt-1">
                                 <div className="flex items-center gap-0.5">
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                    <span className="text-[10px] font-black text-foreground">{dish.average_rating}</span>
                                 </div>
                                 <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">•</span>
                                 <span className="text-[10px] font-bold text-muted-foreground uppercase">{dish.total_orders || 0} Orders</span>
                             </div>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-black text-emerald-400">₹{dish.price}</p>
                           <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1 italic">Active</p>
                        </div>
                    </div>
                ))}
            </div>

            <button className="w-full mt-6 py-4 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-95">
                View All Catalog
            </button>
        </div>

      </div>

      {/* History Table Banner */}
      <div className="p-8 rounded-[2.5rem] border border-white/10 bg-secondary/30 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
           <div className="flex items-center justify-between mb-8">
                <div>
                   <h3 className="text-xl font-black text-foreground tracking-tight uppercase italic flex items-center gap-3">
                      <LayoutGrid className="w-6 h-6 text-purple-400" />
                      Historical Closing Registry
                   </h3>
                   <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Daily settlement archives</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="pb-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date Segment</th>
                            <th className="pb-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4 text-center">Inflow Orders</th>
                            <th className="pb-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4 text-center">Settled Volume</th>
                            <th className="pb-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Revenue (Gross)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {stats?.salesHistory.slice().reverse().map((day, i) => (
                            <tr key={i} className="group hover:bg-white/5 transition-colors">
                                <td className="py-5 font-black text-xs text-foreground uppercase italic tracking-tighter">
                                   {format(new Date(day.date), 'EEEE, MMMM dd, yyyy')}
                                </td>
                                <td className="py-5 text-center px-4 font-black text-sm text-foreground">
                                   {day.orders}
                                </td>
                                <td className="py-5 text-center px-4">
                                   <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase">
                                       <ShoppingBag className="w-2.5 h-2.5" />
                                       Volume Stable
                                   </div>
                                </td>
                                <td className="py-5 text-right font-black text-sm text-emerald-400">
                                   ₹{day.amount.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
      </div>
    </motion.div>
  );
}
