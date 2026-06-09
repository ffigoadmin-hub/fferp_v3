import React, { useState, useMemo } from 'react';
import { useRealtimePayments } from '@/hooks/useRealtimePayments';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Clock,
  Filter,
  SortAsc,
  SortDesc,
  Search,
  RefreshCw
} from 'lucide-react';
import { usePaymentRequests, PaymentStatus } from '@/hooks/usePaymentRequests';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeDepartment } from '@/lib/paymentWorkflow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { PaymentAuditCard } from './PaymentAuditCard';
import { PaymentAuditInsights } from './PaymentAuditInsights';
import { cn } from '@/lib/utils';
import { usePaymentTags } from '@/hooks/usePaymentTags';

interface EnhancedPaymentAuditWidgetProps {
  roles: string[];
  targetStatuses: PaymentStatus[];
  title: string;
  subtitle: string;
  roleLabel?: string;
  jvOnly?: boolean;    // show only JV Engineering payments
  excludeJV?: boolean; // hide JV Engineering payments
}

type SortOption = 'newest' | 'oldest' | 'amount_high' | 'amount_low' | 'urgency' | 'cutoff';
type FilterOption = 'all' | 'emergency' | 'important' | 'normal';

export function EnhancedPaymentAuditWidget({
  roles,
  targetStatuses,
  title,
  subtitle,
  roleLabel,
  jvOnly = false,
  excludeJV = false,
}: EnhancedPaymentAuditWidgetProps) {
  const { user } = useAuth();
  // Fetch real-time data
  const { requests: rawRequests, isLoading, refresh: refetch } = useRealtimePayments(targetStatuses);
  // Get actions from hook (without fetching data again if possible, or just ignore its data)
  const { isSaving, updateStatus, deletePaymentRequest } = usePaymentRequests({ skipFetch: true });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('urgency');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showInsights, setShowInsights] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Fetch available tags for filter dropdown
  const { tags: availableTags } = usePaymentTags();

  // useRealtimePayments handles refresh internally, 
  // but if we need manual refresh we can use refetch exposed above.


  // Helper: is a request from JV Engineering?
  const isJVRequest = (r: any) => {
    const dept = (r.requester?.department || r.department || '').toLowerCase();
    return r.is_jv_payment === true || dept.includes('jv');
  };

  // Filter requests based on role and department
  const roleFilteredRequests = useMemo(() => {
    return rawRequests.filter(r => {
      // JV scoping filters
      if (jvOnly && !isJVRequest(r)) return false;
      if (excludeJV && isJVRequest(r)) return false;

      if (roles.includes('smo')) {
        const auditorDept = normalizeDepartment(user?.department);
        const requestDept = normalizeDepartment(r.requester?.department);

        // Strict departmental silo for SMOs
        if (auditorDept === 'jv_engineering') return requestDept === 'jv_engineering';
        if (auditorDept === 'engineering') return requestDept === 'engineering';
        if (auditorDept === 'agri' || auditorDept === 'agri_mart') return requestDept === 'agri' || requestDept === 'agri_mart';
        if (auditorDept === 'purchase') return requestDept === 'purchase';
        if (auditorDept === 'r_and_d') return requestDept === 'r_and_d';
        if (auditorDept === 'farmers_factory') return requestDept === 'farmers_factory';
      }
      return true;
    });
  }, [rawRequests, roles, user?.department, jvOnly, excludeJV]);

  // Apply search, sort, and filter
  const requests = useMemo(() => {
    let filtered = [...roleFilteredRequests];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.vendor_name.toLowerCase().includes(query) ||
        r.purpose.toLowerCase().includes(query) ||
        r.requester?.name?.toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query)
      );
    }

    // Urgency filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(r => r.urgency === filterBy);
    }

    // Tag filter
    if (tagFilter !== 'all') {
      filtered = filtered.filter(r => {
        const requestTags = (r as any).tags || [];
        return requestTags.includes(tagFilter);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'amount_high':
          return Number(b.amount) - Number(a.amount);
        case 'amount_low':
          return Number(a.amount) - Number(b.amount);
        case 'urgency':
          const urgencyOrder = { emergency: 0, important: 1, normal: 2 };
          return urgencyOrder[a.urgency as keyof typeof urgencyOrder] - urgencyOrder[b.urgency as keyof typeof urgencyOrder];
        case 'cutoff':
          return new Date(`${a.cutoff_date}T${a.cutoff_time}`).getTime() - new Date(`${b.cutoff_date}T${b.cutoff_time}`).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [roleFilteredRequests, searchQuery, sortBy, filterBy, tagFilter]);

  /**
   * Enterprise Payment Workflow Routing
   */
  const getNextStatus = (currentStatus: PaymentStatus, department: string, pettyCashOverride: boolean = false): PaymentStatus => {
    const rawDept = department?.toLowerCase();
    const isJvEng = rawDept === 'jv engineering' || rawDept === 'jv_engineering' || rawDept === 'jv eng';
    const dept = isJvEng ? 'jv_engineering' : rawDept === 'agrimart' ? 'agri_mart' : (rawDept?.includes('r&d') || rawDept === 'rnd' || rawDept === 'r_and_d') ? 'r_and_d' : (rawDept?.includes('agri') || rawDept?.includes('farm')) ? 'agri' : rawDept;

    if (currentStatus === 'admin_audit' && pettyCashOverride) {
      return 'ceo_approved';
    }

    switch (currentStatus) {
      case 'smo_audit':
        if (dept === 'jv_engineering') return 'director_audit'; // JV: SMO -> Director (skip GMO/BOI)
        if (dept === 'engineering') return 'gmo_audit';
        if (dept?.includes('agri')) return 'boi_audit';
        return 'boi_audit';
      case 'gmo_audit':
        return 'boi_audit';
      case 'boi_audit':
        if (dept === 'engineering') return 'gm_audit';
        if (dept?.includes('agri')) return 'director_audit';
        return 'admin_audit';
      case 'director_audit':
        if (dept === 'jv_engineering') return 'gm_audit'; // JV: Director -> GM
        return 'admin_audit'; // Agri: Director -> Admin
      case 'gm_audit':
      case 'gm_hold':
        return 'admin_audit';
      case 'admin_audit':
        return 'ceo_audit';
      case 'ceo_audit':
        return 'ceo_approved';
      default:
        return 'ceo_approved';
    }
  };

  const handleApprove = async (id: string, currentStatus: PaymentStatus, department: string, note: string, isPettyCash: boolean) => {
    const nextStatus = getNextStatus(currentStatus, department, isPettyCash);
    const res = await updateStatus(id, nextStatus, {
      holdReason: note,
      isPettyCash
    });
    if (res.success) {
      toast.success(isPettyCash
        ? `Petty Cash Approved (CEO Bypassed)`
        : `Forwarded to: ${nextStatus.replace(/_/g, ' ').toUpperCase()}`
      );
      setExpandedId(null);
    }
  };

  const handleReject = async (id: string, note: string) => {
    if (!note.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    const res = await updateStatus(id, 'rejected', { rejectionReason: note });
    if (res.success) {
      toast.success('Request rejected');
      setExpandedId(null);
      // Ensure local state is refreshed immediately
      refetch();
    }
  };

  const handleHold = async (id: string, note: string) => {
    const res = await updateStatus(id, 'gm_hold', { holdReason: note });
    if (res.success) {
      toast.success('Payment put on Hold');
      setExpandedId(null);
      // Ensure local state is refreshed immediately
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to PERMANENTLY delete this payment request? This action cannot be undone.')) {
      const res = await deletePaymentRequest(id);
      if (res.success) {
        setExpandedId(null);
        // Ensure local state is refreshed immediately
        refetch();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Clock className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            {title}
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 ml-2 h-4 text-[10px]">
              {requests.length} Pending
            </Badge>
          </h2>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInsights(!showInsights)}
            className={cn(showInsights && "bg-primary/10")}
          >
            {showInsights ? 'Hide' : 'Show'} Insights
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            className="h-9 w-9"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Glassmorphism Insights Panel */}
      {showInsights && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative p-0.5 rounded-xl bg-white/[0.02] border border-white/5 backdrop-blur-3xl"
        >
          <PaymentAuditInsights requests={roleFilteredRequests} roleLabel={roleLabel} />
        </motion.div>
      )}

      {/* Pro Max Search & Filter Bar - SUPER COMPACT */}
      {roleFilteredRequests.length > 0 && (
        <div className="flex flex-col xl:flex-row gap-2 p-1.5 rounded-xl bg-black/20 border border-white/5 backdrop-blur-sm">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search vendor, purpose, requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 bg-black/40 border-white/10 text-xs focus-visible:ring-primary/20 rounded-lg placeholder:text-[10px]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Select value={filterBy} onValueChange={(v: FilterOption) => setFilterBy(v)}>
              <SelectTrigger className="w-28 h-9 bg-black/40 border-white/10 rounded-lg text-xs">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-white/40" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-xs">
                <SelectItem value="all">Global</SelectItem>
                <SelectItem value="emergency">🔴 Emergency</SelectItem>
                <SelectItem value="important">🟡 Important</SelectItem>
                <SelectItem value="normal">🟢 Normal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-32 h-9 bg-black/40 border-white/10 rounded-lg text-xs">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-xs">
                <SelectItem value="all">All Tags</SelectItem>
                {availableTags.map(tag => (
                  <SelectItem key={tag.code} value={tag.code} className="text-xs">
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
              <SelectTrigger className="w-32 h-9 bg-black/40 border-white/10 rounded-lg text-xs">
                <SortAsc className="w-3.5 h-3.5 mr-1.5 text-white/40" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-xs">
                <SelectItem value="urgency">By Urgency</SelectItem>
                <SelectItem value="cutoff">By Cutoff</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="amount_high">Amount ↓</SelectItem>
                <SelectItem value="amount_low">Amount ↑</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Request Cards */}
      {requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <ShieldCheck className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">
              {searchQuery || filterBy !== 'all' || tagFilter !== 'all' ? 'No Matching Requests' : 'All Clear!'}
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery || filterBy !== 'all' || tagFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'All payment requests in your queue have been processed.'}
            </p>
            {(searchQuery || filterBy !== 'all' || tagFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => { setSearchQuery(''); setFilterBy('all'); setTagFilter('all'); }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <PaymentAuditCard
                request={request}
                isExpanded={expandedId === request.id}
                onToggleExpand={() => setExpandedId(expandedId === request.id ? null : request.id)}
                onApprove={(note, isPettyCash) =>
                  handleApprove(request.id, request.status, request.requester?.department || '', note, isPettyCash)
                }
                onReject={(note) => handleReject(request.id, note)}
                onHold={(note) => handleHold(request.id, note)}
                onDelete={roles.includes('admin') ? () => handleDelete(request.id) : undefined}
                isSaving={isSaving}
                showPettyCashOption={request.status === 'admin_audit' && roles.includes('admin')}
                roleLabel={roleLabel}
                showHoldOption={roles.includes('gm')}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
