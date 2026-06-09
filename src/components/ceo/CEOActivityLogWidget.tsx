import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { 
  History, Check, Pause, X, IndianRupee, FileText, 
  ClipboardList, ShoppingCart, AlertTriangle, RotateCcw,
  Loader2, ChevronDown, ChevronUp, Filter, Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface CEOActivityLog {
  id: string;
  action: string;
  record_type: string;
  record_id: string | null;
  before_state: any;
  after_state: any;
  remarks: string | null;
  created_at: string;
}

const actionConfig: Record<string, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  'approve': { icon: Check, bg: 'bg-status-live/20', text: 'text-status-live', label: 'Approved' },
  'ceo_approve': { icon: Check, bg: 'bg-status-live/20', text: 'text-status-live', label: 'CEO Approved' },
  'ceo_approved': { icon: Check, bg: 'bg-status-live/20', text: 'text-status-live', label: 'CEO Approved' },
  'hold': { icon: Pause, bg: 'bg-status-late/20', text: 'text-status-late', label: 'Put on Hold' },
  'ceo_hold': { icon: Pause, bg: 'bg-status-late/20', text: 'text-status-late', label: 'CEO Hold' },
  'reject': { icon: X, bg: 'bg-status-missed/20', text: 'text-status-missed', label: 'Rejected' },
  'ceo_reject': { icon: X, bg: 'bg-status-missed/20', text: 'text-status-missed', label: 'CEO Rejected' },
  'reversal_approve': { icon: RotateCcw, bg: 'bg-primary/20', text: 'text-primary', label: 'Reversal Approved' },
  'reversal_reject': { icon: X, bg: 'bg-status-missed/20', text: 'text-status-missed', label: 'Reversal Rejected' },
  'batch_verify': { icon: Check, bg: 'bg-status-live/20', text: 'text-status-live', label: 'Batch Verified' },
  'lop_approve': { icon: Check, bg: 'bg-status-live/20', text: 'text-status-live', label: 'LOP Approved' },
  'lop_reject': { icon: X, bg: 'bg-status-missed/20', text: 'text-status-missed', label: 'LOP Rejected' },
};

const recordTypeConfig: Record<string, { icon: React.ElementType; label: string }> = {
  'payment_request': { icon: IndianRupee, label: 'Payment' },
  'payment_requests': { icon: IndianRupee, label: 'Payment' },
  'work_order': { icon: ClipboardList, label: 'Work Order' },
  'work_orders': { icon: ClipboardList, label: 'Work Order' },
  'purchase_order': { icon: ShoppingCart, label: 'Purchase Order' },
  'purchase_orders': { icon: ShoppingCart, label: 'Purchase Order' },
  'lop_entry': { icon: AlertTriangle, label: 'LOP Entry' },
  'lop_entries': { icon: AlertTriangle, label: 'LOP Entry' },
  'lop_reversal': { icon: RotateCcw, label: 'LOP Reversal' },
  'batch': { icon: FileText, label: 'Batch' },
  'bulk_batch': { icon: FileText, label: 'Batch' },
};

export function CEOActivityLogWidget() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['ceo-activity-logs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('performed_by', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data as CEOActivityLog[];
    },
    enabled: !!user,
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const filteredLogs = (logs || []).filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.record_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.remarks && log.remarks.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || log.record_type.includes(filterType);
    
    return matchesSearch && matchesType;
  });

  // Group logs by date
  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = format(new Date(log.created_at), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {} as Record<string, CEOActivityLog[]>);

  const getActionStyle = (action: string) => {
    const key = Object.keys(actionConfig).find(k => action.toLowerCase().includes(k));
    return key ? actionConfig[key] : { icon: History, bg: 'bg-muted/30', text: 'text-muted-foreground', label: action };
  };

  const getRecordTypeStyle = (recordType: string) => {
    const key = Object.keys(recordTypeConfig).find(k => recordType.toLowerCase().includes(k));
    return key ? recordTypeConfig[key] : { icon: FileText, label: recordType };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="authority-card bg-status-live/10 border-status-live/20">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-status-live" />
            <span className="text-xs font-bold uppercase text-status-live/70">Approvals</span>
          </div>
          <p className="text-2xl font-black text-status-live">
            {(logs || []).filter(l => l.action.toLowerCase().includes('approve') && !l.action.toLowerCase().includes('reject')).length}
          </p>
        </div>
        <div className="authority-card bg-status-late/10 border-status-late/20">
          <div className="flex items-center gap-2 mb-1">
            <Pause className="w-4 h-4 text-status-late" />
            <span className="text-xs font-bold uppercase text-status-late/70">Holds</span>
          </div>
          <p className="text-2xl font-black text-status-late">
            {(logs || []).filter(l => l.action.toLowerCase().includes('hold')).length}
          </p>
        </div>
        <div className="authority-card bg-status-missed/10 border-status-missed/20">
          <div className="flex items-center gap-2 mb-1">
            <X className="w-4 h-4 text-status-missed" />
            <span className="text-xs font-bold uppercase text-status-missed/70">Rejections</span>
          </div>
          <p className="text-2xl font-black text-status-missed">
            {(logs || []).filter(l => l.action.toLowerCase().includes('reject')).length}
          </p>
        </div>
        <div className="authority-card bg-primary/10 border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <History className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase text-primary/70">Total Actions</span>
          </div>
          <p className="text-2xl font-black text-primary">{(logs || []).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl bg-muted/30 border">
        <div className="flex-1 relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, types, remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="payment">Payments</SelectItem>
            <SelectItem value="work_order">Work Orders</SelectItem>
            <SelectItem value="purchase_order">Purchase Orders</SelectItem>
            <SelectItem value="lop">LOP Entries</SelectItem>
            <SelectItem value="batch">Batches</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Timeline */}
      {Object.keys(groupedLogs).length === 0 ? (
        <div className="authority-card text-center py-16">
          <History className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-xl font-semibold text-muted-foreground">No Activity Found</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Your actions will appear here</p>
        </div>
      ) : (
        <div className="space-y-8">
          <AnimatePresence>
            {Object.entries(groupedLogs).map(([date, dayLogs]) => (
              <motion.div 
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Date Header */}
                <div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg">{format(new Date(date), 'EEEE, MMMM d, yyyy')}</h3>
                  <Badge variant="outline" className="ml-2">{dayLogs.length} actions</Badge>
                </div>

                {/* Day's Logs */}
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  {dayLogs.map((log) => {
                    const actionStyle = getActionStyle(log.action);
                    const recordStyle = getRecordTypeStyle(log.record_type);
                    const ActionIcon = actionStyle.icon;
                    const RecordIcon = recordStyle.icon;
                    const isExpanded = expandedId === log.id;

                    return (
                      <Collapsible 
                        key={log.id} 
                        open={isExpanded}
                        onOpenChange={() => setExpandedId(isExpanded ? null : log.id)}
                      >
                        <div className={cn(
                          'rounded-xl border p-4 transition-all hover:border-primary/30',
                          actionStyle.bg
                        )}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-start justify-between cursor-pointer">
                              <div className="flex items-start gap-3">
                                <div className={cn('p-2 rounded-lg', actionStyle.bg)}>
                                  <ActionIcon className={cn('w-4 h-4', actionStyle.text)} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={cn(actionStyle.bg, actionStyle.text, 'border-0')}>
                                      {actionStyle.label}
                                    </Badge>
                                    <Badge variant="secondary" className="gap-1">
                                      <RecordIcon className="w-3 h-3" />
                                      {recordStyle.label}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-medium">
                                    {log.remarks || `${actionStyle.label} - ${recordStyle.label}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(log.created_at), 'h:mm a')}
                                  </p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="shrink-0">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                              {log.record_id && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Record ID:</span>
                                  <code className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
                                    {log.record_id}
                                  </code>
                                </div>
                              )}
                              {log.after_state && (
                                <div className="space-y-2">
                                  <span className="text-sm text-muted-foreground">Details:</span>
                                  <pre className="text-xs p-3 rounded-lg bg-muted/50 overflow-x-auto max-h-40">
                                    {JSON.stringify(log.after_state, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
