
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight, ChevronDown, Package, Truck,
    MapPin, Clock, ArrowRight, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ProjectProcurementListProps {
    projects: any[];
    onSelectOrder: (order: any) => void;
}

export function ProjectProcurementList({ projects, onSelectOrder }: ProjectProcurementListProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            {projects.map((item: any, idx: number) => {
                const isExpanded = expandedId === item.project.id;
                const progress = Math.round((item.stats.delivered / item.stats.total) * 100) || 0;

                return (
                    <motion.div
                        key={item.project.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                            "group relative overflow-hidden rounded-xl border transition-all duration-300",
                            isExpanded
                                ? "bg-black/60 border-violet-500/30 shadow-[0_0_30px_rgba(124,58,237,0.1)]"
                                : "bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/40"
                        )}
                    >
                        {/* Header / Summary Card */}
                        <div
                            onClick={() => setExpandedId(isExpanded ? null : item.project.id)}
                            className="p-5 cursor-pointer grid grid-cols-12 gap-4 items-center"
                        >
                            {/* Project Info */}
                            <div className="col-span-12 md:col-span-4 flex items-center gap-4">
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                    isExpanded ? "bg-violet-500/20 text-violet-300" : "bg-white/5 text-zinc-400 group-hover:text-zinc-200"
                                )}>
                                    <Package className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className={cn(
                                        "font-bold text-lg tracking-tight transition-colors",
                                        isExpanded ? "text-violet-100" : "text-zinc-200 group-hover:text-white"
                                    )}>
                                        {item.project.project_name}
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                                        <span className="flex items-center">
                                            <MapPin className="w-3 h-3 mr-1" />
                                            {item.project.location || 'Site Location'}
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center text-emerald-400">
                                            <Wallet className="w-3 h-3 mr-1" />
                                            ₹{(item.stats.totalValue / 1000).toFixed(0)}k Value
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar & Stats */}
                            <div className="col-span-12 md:col-span-5 px-4 block">
                                <div className="flex justify-between text-xs mb-1.5 uppercase font-semibold tracking-wider text-zinc-500">
                                    <span>Procurement Progress</span>
                                    <span className={cn(progress === 100 ? "text-emerald-400" : "text-zinc-300")}>
                                        {progress}% Complete
                                    </span>
                                </div>
                                <Progress value={progress} className="h-1.5 bg-white/5" indicatorClassName={cn(
                                    progress === 100 ? "bg-emerald-500" : "bg-gradient-to-r from-violet-600 to-cyan-500"
                                )} />
                                <div className="flex gap-4 mt-2">
                                    <div className="text-xs text-zinc-500">
                                        <span className="text-cyan-400 font-bold">{item.stats.inTransit}</span> In Transit
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        <span className="text-zinc-300 font-bold">{item.stats.ordered - item.stats.inTransit - item.stats.delivered}</span> Processing
                                    </div>
                                </div>
                            </div>

                            {/* Actions / Metrics */}
                            <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-3">
                                {item.stats.inTransit > 0 && (
                                    <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse">
                                        <Truck className="w-3 h-3 mr-1" />
                                        {item.stats.inTransit} Arriving
                                    </Badge>
                                )}
                                <Button size="icon" variant="ghost" className="rounded-full w-8 h-8 text-zinc-500 group-hover:text-white">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Expanded Details (Orders) */}
                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-black/20 border-t border-white/5"
                                >
                                    <div className="p-4 grid gap-3">
                                        {item.requests.length === 0 ? (
                                            <p className="text-center text-zinc-500 py-4 text-sm">No active orders available.</p>
                                        ) : (
                                            item.requests.map((req: any) => (
                                                <div
                                                    key={req.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectOrder(req);
                                                    }}
                                                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-violet-500/30 cursor-pointer transition-all group/item"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            req.order_status === 'delivered' ? "bg-emerald-500" :
                                                                req.order_status === 'delayed' ? "bg-red-500" :
                                                                    "bg-cyan-500 animate-pulse"
                                                        )} />
                                                        <div>
                                                            <p className="text-sm font-medium text-zinc-200 group-hover/item:text-white">
                                                                {req.phase?.phase_name || 'Material Order'}
                                                                <span className="text-zinc-500 ml-2 font-normal">#{req.id.slice(0, 6)}</span>
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <Badge variant="secondary" className="h-5 text-[10px] px-1.5 bg-zinc-800 text-zinc-400">
                                                                    {(req.boq_items || []).length} Items
                                                                </Badge>
                                                                <span className="text-xs text-zinc-500 flex items-center">
                                                                    <Clock className="w-3 h-3 mr-1" />
                                                                    Updated {new Date(req.updated_at || req.created_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right hidden sm:block">
                                                            <p className="text-sm font-bold text-zinc-300">₹{(req.project?.budget || 50000).toLocaleString()}</p>
                                                            <p className="text-[10px] uppercase text-zinc-500 font-semibold">{req.order_status}</p>
                                                        </div>
                                                        <ArrowRight className="w-4 h-4 text-zinc-600 group-hover/item:text-violet-400 transition-transform group-hover/item:translate-x-1" />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Footer Stats for Project */}
                                    <div className="bg-black/40 px-5 py-3 flex justify-between items-center text-xs text-zinc-500 border-t border-white/5">
                                        <span>Vendor Count: {new Set(item.requests.map((r: any) => r.selected_quote_id)).size} Leads</span>
                                        <Button variant="link" className="h-auto p-0 text-violet-400 hover:text-violet-300">
                                            View All Project Logistics <ArrowRight className="w-3 h-3 ml-1" />
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
}
