import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Package, Clock, User, Search, Truck, FolderKanban,
  CheckCircle2, AlertTriangle, Zap, ShoppingCart,
  ArrowRight, FileCheck, RefreshCw, Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProgressLog {
  id: string;
  material_request_id: string;
  update_text: string;
  status_update: string | null;
  updated_by_name: string | null;
  created_at: string;
  material_request?: {
    project?: {
      project_name: string;
    };
  };
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  sourcing: { label: 'Sourcing', color: 'text-blue-400', bgColor: 'bg-blue-500/15 border-blue-500/20', icon: Search },
  quotes_collected: { label: 'Quotes Collected', color: 'text-violet-400', bgColor: 'bg-violet-500/15 border-violet-500/20', icon: FileCheck },
  quoted: { label: 'Quoted', color: 'text-violet-400', bgColor: 'bg-violet-500/15 border-violet-500/20', icon: FileCheck },
  pending_approval: { label: 'Pending Approval', color: 'text-amber-400', bgColor: 'bg-amber-500/15 border-amber-500/20', icon: Clock },
  pending_gm: { label: 'Pending GM', color: 'text-amber-400', bgColor: 'bg-amber-500/15 border-amber-500/20', icon: Clock },
  pending_admin: { label: 'Pending Admin', color: 'text-amber-400', bgColor: 'bg-amber-500/15 border-amber-500/20', icon: Clock },
  pending_ceo: { label: 'Pending CEO', color: 'text-amber-400', bgColor: 'bg-amber-500/15 border-amber-500/20', icon: Clock },
  ordered: { label: 'Ordered', color: 'text-indigo-400', bgColor: 'bg-indigo-500/15 border-indigo-500/20', icon: ShoppingCart },
  in_transit: { label: 'In Transit', color: 'text-cyan-400', bgColor: 'bg-cyan-500/15 border-cyan-500/20', icon: Truck },
  partial_delivery: { label: 'Partial Delivery', color: 'text-orange-400', bgColor: 'bg-orange-500/15 border-orange-500/20', icon: Package },
  delivered: { label: 'Delivered', color: 'text-emerald-400', bgColor: 'bg-emerald-500/15 border-emerald-500/20', icon: CheckCircle2 },
  issue: { label: 'Issue', color: 'text-red-400', bgColor: 'bg-red-500/15 border-red-500/20', icon: AlertTriangle },
};

function getStatusInfo(status: string | null) {
  if (!status) return null;
  return statusConfig[status] || { label: status, color: 'text-muted-foreground', bgColor: 'bg-white/5 border-white/10', icon: Activity };
}

function getInitials(name: string | null): string {
  if (!name || name === 'System Auto') return 'SY';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string | null): string {
  if (!name || name === 'System Auto') return 'from-slate-600 to-slate-700';
  const colors = [
    'from-blue-600 to-blue-700',
    'from-emerald-600 to-emerald-700',
    'from-amber-600 to-amber-700',
    'from-rose-600 to-rose-700',
    'from-purple-600 to-purple-700',
    'from-cyan-600 to-cyan-700',
    'from-orange-600 to-orange-700',
    'from-teal-600 to-teal-700',
  ];
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function PurchaseUpdatesWidget() {
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('purchase_progress_logs')
          .select(`
            *,
            material_request:material_requests(
              project:projects(project_name)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setLogs((data || []) as ProgressLog[]);
      } catch (error) {
        console.error('Error fetching progress logs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();

    const channel = supabase
      .channel('purchase-updates-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'purchase_progress_logs' },
        () => { fetchLogs(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.update_text.toLowerCase().includes(term) ||
      log.updated_by_name?.toLowerCase().includes(term) ||
      log.material_request?.project?.project_name?.toLowerCase().includes(term)
    );
  });

  // Group logs by date
  const groupedLogs: Record<string, ProgressLog[]> = {};
  filteredLogs.forEach(log => {
    const dateKey = format(new Date(log.created_at), 'yyyy-MM-dd');
    if (!groupedLogs[dateKey]) groupedLogs[dateKey] = [];
    groupedLogs[dateKey].push(log);
  });

  const dateGroups = Object.entries(groupedLogs);

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-black/30 backdrop-blur-xl">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2.5 text-base font-black text-white/90">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            Purchase Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 border-[3px] border-primary/40 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground animate-pulse">Loading activity...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-black/30 backdrop-blur-xl overflow-hidden relative">
      {/* Subtle bg gradient */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <CardHeader className="relative z-10 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-base font-black tracking-tight text-white/90">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            Purchase Feed
            {logs.length > 0 && (
              <span className="text-[10px] font-bold text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                {logs.length} updates
              </span>
            )}
          </CardTitle>
          {/* Live pulse indicator */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Live</span>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search updates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/5 text-xs h-8 focus-visible:ring-primary/30 placeholder:text-muted-foreground/50"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0 relative z-10">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
              <Truck className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="font-bold text-sm text-white/60 mb-1">No Activity Yet</p>
            <p className="text-xs text-muted-foreground/60 max-w-[220px] mx-auto leading-relaxed">
              Updates from purchase team will stream here in real-time.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[520px]">
            <div className="px-4 pb-4 space-y-1">
              {dateGroups.map(([dateKey, dayLogs], groupIdx) => {
                const date = new Date(dateKey);
                const isToday = format(new Date(), 'yyyy-MM-dd') === dateKey;
                const isYesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') === dateKey;
                const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : format(date, 'dd MMM yyyy');

                return (
                  <div key={dateKey}>
                    {/* Date Separator */}
                    <div className="flex items-center gap-3 py-3 sticky top-0 z-20 bg-gradient-to-b from-card/95 via-card/90 to-transparent backdrop-blur-sm">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/5" />
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full border",
                        isToday
                          ? "text-primary bg-primary/10 border-primary/20"
                          : "text-muted-foreground/60 bg-white/[0.02] border-white/5"
                      )}>
                        {dateLabel}
                      </span>
                      <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/5" />
                    </div>

                    {/* Day's Logs */}
                    <div className="space-y-2">
                      {dayLogs.map((log, idx) => {
                        const statusInfo = getStatusInfo(log.status_update);
                        const StatusIcon = statusInfo?.icon || Activity;

                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min((groupIdx * dayLogs.length + idx) * 0.03, 0.4), duration: 0.3 }}
                            className="group"
                          >
                            <div className={cn(
                              "flex gap-3 p-3 rounded-xl border transition-all duration-200",
                              "border-white/[0.04] bg-white/[0.015]",
                              "hover:bg-white/[0.04] hover:border-white/[0.08]"
                            )}>
                              {/* Avatar */}
                              <div className={cn(
                                "w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 text-[10px] font-black text-white shadow-lg",
                                getAvatarColor(log.updated_by_name)
                              )}>
                                {getInitials(log.updated_by_name)}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                {/* Top Row: Name + Time */}
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-xs font-bold text-white/85 truncate">
                                    {log.updated_by_name || 'System'}
                                  </p>
                                  <span className="text-[9px] text-muted-foreground/50 font-medium shrink-0 tabular-nums">
                                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                  </span>
                                </div>

                                {/* Update Text */}
                                <p className="text-[12px] leading-[1.6] text-white/55 group-hover:text-white/70 transition-colors line-clamp-2">
                                  {log.update_text}
                                </p>

                                {/* Bottom Row: Project + Status */}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {log.material_request?.project?.project_name && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary/80 bg-primary/[0.08] px-2 py-0.5 rounded-md border border-primary/10">
                                      <FolderKanban className="w-2.5 h-2.5" />
                                      {log.material_request.project.project_name}
                                    </span>
                                  )}
                                  {statusInfo && (
                                    <span className={cn(
                                      "inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border",
                                      statusInfo.bgColor, statusInfo.color
                                    )}>
                                      <StatusIcon className="w-2.5 h-2.5" />
                                      {statusInfo.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
