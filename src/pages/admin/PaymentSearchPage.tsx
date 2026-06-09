import { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search, IndianRupee, Clock, Check, X, Pause, FileText, ExternalLink,
  Building2, Tractor, Briefcase, Filter, Eye, CheckCircle
} from 'lucide-react';
import { useRealtimePayments } from '@/hooks/useRealtimePayments';
import { PaymentSearchFilters, PaymentFilters } from '@/components/PaymentSearchFilters';
import { PaymentFlowAnalytics } from '@/components/PaymentFlowAnalytics';
import { ExportButtons } from '@/components/ExportButtons';
import { cn } from '@/lib/utils';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PaymentDetailsModal } from '@/components/PaymentDetailsModal';
import { PaymentReceipt } from '@/components/payment/PaymentReceipt';

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  // Workflow-specific statuses
  smo_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending SMO', icon: Clock },
  gmo_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending GMO', icon: Clock },
  boi_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending BOI', icon: Clock },
  gm_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending GM', icon: Clock },
  director_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending Director', icon: Clock },
  admin_audit: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending Admin', icon: Clock },
  ceo_audit: { bg: 'bg-status-late/20', text: 'text-status-late', label: 'Pending CEO', icon: Clock },
  // Legacy statuses
  pending: { bg: 'bg-muted/30', text: 'text-muted-foreground', label: 'Pending (Legacy)', icon: Clock },
  admin_approved: { bg: 'bg-status-late/20', text: 'text-status-late', label: 'Admin Approved', icon: Clock },
  // Final statuses
  ceo_approved: { bg: 'bg-status-live/20', text: 'text-status-live', label: 'Ready for Payment', icon: Check },
  ceo_hold: { bg: 'bg-authority-ceo/20', text: 'text-authority-ceo', label: 'On Hold', icon: Pause },
  rejected: { bg: 'bg-status-missed/20', text: 'text-status-missed', label: 'Rejected', icon: X },
  paid: { bg: 'bg-status-live/20', text: 'text-status-live', label: 'Paid', icon: Check },
  // Accounts/Bank statuses
  accounts_execution: { bg: 'bg-primary/20', text: 'text-primary', label: 'Processing', icon: Clock },
  bulk_prepared: { bg: 'bg-primary/20', text: 'text-primary', label: 'Batch Ready', icon: Clock },
  bank_uploaded: { bg: 'bg-primary/20', text: 'text-primary', label: 'Bank Processing', icon: Clock },
};

const defaultFilters: PaymentFilters = {
  search: '',
  status: [],
  urgency: [],
  dateFrom: undefined,
  dateTo: undefined,
  amountMin: '',
  amountMax: '',
  department: '',
};

const getDepartmentIcon = (dept: string) => {
  if (dept === 'engineering') return Building2;
  if (dept === 'agri') return Tractor;
  return Briefcase;
};

const getDepartmentColor = (dept: string) => {
  if (dept === 'engineering') return 'bg-blue-500/20 text-blue-600';
  if (dept === 'agri') return 'bg-green-500/20 text-green-600';
  return 'bg-purple-500/20 text-purple-600';
};

export function PaymentSearchPage() {
  const { requests, isLoading } = useRealtimePayments(undefined, ['draft']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<PaymentFilters>({
    ...defaultFilters,
    search: searchParams.get('q') ?? '',
  });
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<'all' | 'engineering' | 'agri' | 'others'>('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [voucherRequest, setVoucherRequest] = useState<any>(null);

  // Sync URL ?q= param → search filter whenever it changes (e.g. new topbar search)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    setFilters(prev => ({ ...prev, search: q }));
  }, [searchParams]);

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('department')
        .order('department');

      if (data) {
        const uniqueDepts = [...new Set(data.map(d => d.department))];
        setDepartments(uniqueDepts);
      }
    };
    fetchDepartments();
  }, []);

  // Apply filters
  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      // Department tab filter
      if (departmentFilter !== 'all') {
        if (departmentFilter === 'engineering' && request.department !== 'engineering') return false;
        if (departmentFilter === 'agri' && request.department !== 'agri') return false;
        if (departmentFilter === 'others' && (request.department === 'engineering' || request.department === 'agri')) return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          request.purpose.toLowerCase().includes(searchLower) ||
          request.vendor_name.toLowerCase().includes(searchLower) ||
          request.id.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(request.status)) {
        return false;
      }

      // Urgency filter
      if (filters.urgency.length > 0 && !filters.urgency.includes(request.urgency)) {
        return false;
      }

      // Date range filter
      const requestDate = new Date(request.created_at);
      if (filters.dateFrom && isBefore(requestDate, startOfDay(filters.dateFrom))) {
        return false;
      }
      if (filters.dateTo && isAfter(requestDate, endOfDay(filters.dateTo))) {
        return false;
      }

      // Amount range filter
      const amount = Number(request.amount);
      if (filters.amountMin && amount < Number(filters.amountMin)) {
        return false;
      }
      if (filters.amountMax && amount > Number(filters.amountMax)) {
        return false;
      }

      return true;
    });
  }, [requests, filters, departmentFilter]);

  const totalAmount = filteredRequests.reduce((sum, r) => sum + Number(r.amount), 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-black tracking-tight" style={{ color: '#111827' }}>
            Payment Search & Analytics
          </h1>
          <p className="text-[12px] mt-0.5 font-medium" style={{ color: '#6B7280' }}>
            Advanced search with real-time departmental flow analytics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ExportButtons
            data={filteredRequests.map(r => ({
              id: `PAY-${r.id.slice(0, 6).toUpperCase()}`,
              department: r.department || 'others',
              purpose: r.purpose,
              vendor: r.vendor_name,
              amount: r.amount,
              status: statusConfig[r.status]?.label || r.status,
              urgency: r.urgency,
              created: format(new Date(r.created_at), 'dd MMM yyyy'),
              cutoff: `${r.cutoff_date} ${r.cutoff_time}`,
              proof_url: r.payment_proof_url || 'N/A'
            }))}
            filename="payment-requests-report"
            title="Payment Requests Report"
            headers={[
              { key: 'id', label: 'ID' },
              { key: 'department', label: 'Department' },
              { key: 'purpose', label: 'Purpose' },
              { key: 'vendor', label: 'Vendor' },
              { key: 'amount', label: 'Amount' },
              { key: 'status', label: 'Status' },
              { key: 'urgency', label: 'Urgency' },
              { key: 'created', label: 'Created' },
              { key: 'cutoff', label: 'Cutoff' },
              { key: 'proof_url', label: 'Payment Proof' },
            ]}
          />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#9CA3AF' }}>Total Value</p>
            <p className="text-[22px] font-black flex items-center justify-end tabular-nums" style={{ color: '#111827' }}>
              <IndianRupee className="w-5 h-5" />
              {totalAmount.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Widgets */}
      <PaymentFlowAnalytics requests={requests} />

      {/* Search & Filters */}
      <div className="authority-card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold">Search & Filter</h3>
        </div>
        <PaymentSearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          departments={departments}
        />
      </div>

      {/* Department Tabs + Results */}
      <Tabs value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v as any)}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="p-1.5 h-auto gap-0.5 rounded-2xl"
            style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
            <TabsTrigger value="all"
              className="px-3 py-1.5 rounded-xl text-[12px] font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              style={{ color: '#6B7280' }}>
              All ({requests.length})
            </TabsTrigger>
            <TabsTrigger value="engineering"
              className="gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              style={{ color: '#6B7280' }}>
              <Building2 className="w-3.5 h-3.5" />
              Engineering
            </TabsTrigger>
            <TabsTrigger value="agri"
              className="gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              style={{ color: '#6B7280' }}>
              <Tractor className="w-3.5 h-3.5" />
              Agri
            </TabsTrigger>
            <TabsTrigger value="others"
              className="gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
              style={{ color: '#6B7280' }}>
              <Briefcase className="w-3.5 h-3.5" />
              Others
            </TabsTrigger>
          </TabsList>

          <p className="text-[12px] font-medium" style={{ color: '#6B7280' }}>
            Showing {filteredRequests.length} requests
          </p>
        </div>

        <TabsContent value={departmentFilter} className="mt-0">
          <div className="space-y-3">
            {filteredRequests.map((request, index) => {
              const status = statusConfig[request.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const DeptIcon = getDepartmentIcon(request.department || 'others');

              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  className="cursor-pointer transition-all duration-200 rounded-2xl p-4 relative overflow-hidden"
                  style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#BFDBFE'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', status.bg)}>
                        <StatusIcon className={cn('w-5 h-5', status.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            PAY-{request.payment_number || request.id.slice(0, 6).toUpperCase()}
                          </span>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getDepartmentColor(request.department || 'others'))}>
                            <DeptIcon className="w-3 h-3 mr-1" />
                            {request.department || 'others'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0',
                              request.urgency === 'emergency' ? 'bg-status-missed/20 text-status-missed border-status-missed/30' :
                                request.urgency === 'important' ? 'bg-status-late/20 text-status-late border-status-late/30' :
                                  'bg-status-live/20 text-status-live border-status-live/30'
                            )}
                          >
                            {request.urgency}
                          </Badge>
                        </div>
                        <p className="font-semibold truncate" style={{ color: '#111827' }}>{request.purpose}</p>
                        <p className="text-[12px] truncate" style={{ color: '#6B7280' }}>
                          {request.vendor_name} • {format(new Date(request.created_at), 'dd MMM yyyy')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(request.bill_url, '_blank');
                          }}
                          title="View Proof Folder"
                        >
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(request.work_proof_url, '_blank');
                          }}
                        >
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </Button>

                        {request.status === 'paid' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVoucherRequest(request);
                            }}
                            title="View Official Voucher"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRequest(request);
                          }}
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-[16px] font-black flex items-center justify-end tabular-nums" style={{ color: '#111827' }}>
                          <IndianRupee className="w-3.5 h-3.5" />
                          {Number(request.amount).toLocaleString('en-IN')}
                        </p>
                        <Badge className={cn('text-[10px]', status.bg, status.text)}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filteredRequests.length === 0 && (
              <div className="rounded-2xl text-center py-12"
                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                <Search className="w-10 h-10 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
                <p className="text-[15px] font-bold" style={{ color: '#374151' }}>No Results Found</p>
                <p className="text-[12px] mt-1" style={{ color: '#9CA3AF' }}>Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Payment Details Modal */}
      {selectedRequest && (
        <PaymentDetailsModal
          payment={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
        />
      )}

      {/* Payment Receipt / Voucher Modal */}
      {voucherRequest && (
        <PaymentReceipt
          isOpen={!!voucherRequest}
          onClose={() => setVoucherRequest(null)}
          payment={{
            id: voucherRequest.id,
            payment_number: voucherRequest.payment_number || 0,
            vendor_name: voucherRequest.vendor_name,
            amount: voucherRequest.amount,
            purpose: voucherRequest.purpose,
            created_at: voucherRequest.created_at,
            paid_at: voucherRequest.paid_at || voucherRequest.created_at,
            utr_number: voucherRequest.utr_number,
            requester_name: voucherRequest.requester?.name || 'Unknown',
            department: voucherRequest.requester?.department || 'Others',
            is_split_payment: voucherRequest.is_split_payment,
            splits: voucherRequest.splits,
            bank_name: voucherRequest.vendor_bank_details,
            account_number: voucherRequest.vendor_account_number,
            ifsc_code: voucherRequest.vendor_ifsc_code,
          }}
        />
      )}
    </motion.div>
  );
}
