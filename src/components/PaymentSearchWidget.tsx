import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Search, Loader2, IndianRupee, RefreshCw,
  ExternalLink, FileText, CheckCircle, Clock, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateVoucher } from '@/lib/exportUtils';
import { PaymentSearchFilters, PaymentFilters } from './PaymentSearchFilters';

interface PaymentRequest {
  id: string;
  payment_number: number;
  purpose: string;
  vendor_name: string;
  amount: number;
  urgency: string;
  status: string;
  created_at: string;
  cutoff_date: string;
  cutoff_time: string;
  requester?: { name: string; department: string };
  project?: { project_name: string };
  bill_url: string;
  work_proof_url: string;
  utr_number: string | null;
  payment_proof_url: string | null;
  payment_proof_screenshot?: string | null;
  audit_timeline: any[];
}

interface PaymentSearchWidgetProps {
  title?: string;
  requesterId?: string;
}

export function PaymentSearchWidget({ title = "Payment Search", requesterId }: PaymentSearchWidgetProps) {
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<PaymentFilters>({
    search: '',
    status: [],
    urgency: [],
    dateFrom: undefined,
    dateTo: undefined,
    amountMin: '',
    amountMax: '',
    department: '',
  });
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequest | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchPayments = useCallback(async () => {
    try {
      let query = supabase
        .from('payment_requests')
        .select(`
          *,
          requester:profiles!payment_requests_requester_id_fkey(name, department),
          project:projects!payment_requests_project_id_fkey(project_name)
        `)
        .order('created_at', { ascending: false });

      if (requesterId) {
        query = query.eq('requester_id', requesterId);
      }

      if (filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.urgency.length > 0) {
        query = query.in('urgency', filters.urgency);
      }

      if (filters.department) {
        query = query.ilike('requester.department', `%${filters.department}%`);
      }

      if (filters.amountMin) {
        query = query.gte('amount', parseInt(filters.amountMin));
      }

      if (filters.amountMax) {
        query = query.lte('amount', parseInt(filters.amountMax));
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setPayments((data || []) as PaymentRequest[]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to fetch payments');
    } finally {
      setIsLoading(false);
    }
  }, [requesterId]);

  useEffect(() => {
    fetchPayments();

    // Real-time subscription
    const channel = supabase
      .channel('payment-search-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => {
        fetchPayments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPayments]);

  const filteredPayments = payments.filter(p => {
    if (!filters.search) return true;
    const query = filters.search.toLowerCase();
    return (
      p.purpose.toLowerCase().includes(query) ||
      p.vendor_name.toLowerCase().includes(query) ||
      String(p.payment_number).includes(query) ||
      p.requester?.name?.toLowerCase().includes(query) ||
      p.project?.project_name?.toLowerCase().includes(query) ||
      p.status.toLowerCase().includes(query) ||
      (p.utr_number && p.utr_number.toLowerCase().includes(query))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-status-live">Paid</Badge>;
      case 'ceo_approved': return <Badge className="bg-primary">CEO Approved</Badge>;
      case 'admin_approved': return <Badge variant="secondary">Admin Approved</Badge>;
      case 'ceo_hold': return <Badge className="bg-status-late">On Hold</Badge>;
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return <Badge variant="destructive">🔴 Emergency</Badge>;
      case 'important': return <Badge className="bg-status-late">🟡 Important</Badge>;
      default: return <Badge variant="outline">🟢 Normal</Badge>;
    }
  };

  // Stats
  const totalPending = payments.filter(p => p.status === 'pending').length;
  const totalAdminApproved = payments.filter(p => p.status === 'admin_approved').length;
  const totalCEOApproved = payments.filter(p => p.status === 'ceo_approved').length;
  const totalPaid = payments.filter(p => p.status === 'paid').length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5" />
                {title}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                Search and view all payment requests
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Updated {format(lastUpdated, 'HH:mm:ss')}
                </span>
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchPayments()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Filters */}
          <div className="mt-4">
            <PaymentSearchFilters
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold">{totalPending}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/30 text-center">
              <p className="text-xs text-muted-foreground">Admin OK</p>
              <p className="text-lg font-bold text-secondary-foreground">{totalAdminApproved}</p>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-center">
              <p className="text-xs text-muted-foreground">CEO OK</p>
              <p className="text-lg font-bold text-primary">{totalCEOApproved}</p>
            </div>
            <div className="p-2 rounded-lg bg-status-live/10 text-center">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-lg font-bold text-status-live">{totalPaid}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {filteredPayments.length === 0 ? (
                <div className="text-center py-12">
                  <IndianRupee className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No payments found</p>
                </div>
              ) : (
                filteredPayments.map(payment => (
                  <div
                    key={payment.id}
                    onClick={() => setSelectedPayment(payment)}
                    className={cn(
                      "p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                      payment.urgency === 'emergency' && payment.status === 'pending' && 'border-destructive bg-destructive/5'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          PAY-{String(payment.payment_number).padStart(4, '0')}
                        </Badge>
                        {getUrgencyBadge(payment.urgency)}
                        {getStatusBadge(payment.status)}
                      </div>
                      <span className="text-lg font-bold">
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <h4 className="font-semibold mb-1">{payment.purpose}</h4>
                    <p className="text-sm text-muted-foreground mb-2">Vendor: {payment.vendor_name}</p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>By: {payment.requester?.name || 'N/A'} ({payment.requester?.department})</span>
                      <span>{format(new Date(payment.created_at), 'dd MMM yyyy')}</span>
                    </div>

                    {payment.utr_number && (
                      <div className="mt-2 p-2 bg-status-live/10 rounded text-xs">
                        <CheckCircle className="w-3 h-3 inline mr-1 text-status-live" />
                        UTR: {payment.utr_number}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5" />
              PAY-{String(selectedPayment?.payment_number).padStart(4, '0')}
            </DialogTitle>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getUrgencyBadge(selectedPayment.urgency)}
                {getStatusBadge(selectedPayment.status)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Purpose</label>
                  <p className="font-medium">{selectedPayment.purpose}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Amount</label>
                  <p className="font-bold text-xl">₹{selectedPayment.amount.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Vendor</label>
                  <p className="font-medium">{selectedPayment.vendor_name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Requester</label>
                  <p className="font-medium">{selectedPayment.requester?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Department</label>
                  <p>{selectedPayment.requester?.department || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Project</label>
                  <p>{selectedPayment.project?.project_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cutoff</label>
                  <p>{selectedPayment.cutoff_date} {selectedPayment.cutoff_time}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Created</label>
                  <p>{format(new Date(selectedPayment.created_at), 'dd MMM yyyy HH:mm')}</p>
                </div>
              </div>

              {selectedPayment.utr_number && (
                <div className="p-3 bg-status-live/10 rounded-lg">
                  <label className="text-xs text-muted-foreground">UTR Number</label>
                  <p className="font-mono font-bold text-status-live">{selectedPayment.utr_number}</p>
                </div>
              )}

              {/* Audit Timeline */}
              {selectedPayment.audit_timeline && selectedPayment.audit_timeline.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">Audit Timeline</label>
                  <div className="space-y-2 pl-2 border-l-2 border-muted">
                    {(() => {
                      const rawDept = (selectedPayment.requester?.department || 'others').toLowerCase();
                      const dept = rawDept === 'agrimart' ? 'agri_mart' : (rawDept.includes('agri') || rawDept.includes('farm')) ? 'agri' : rawDept;
                      const timeline = selectedPayment.audit_timeline || [];
                      const currentStatus = selectedPayment.status?.toLowerCase() || '';

                      let workflowSteps: { role: string; label: string; status: string }[] = [];
                      if (dept === 'engineering') {
                        workflowSteps = [
                          { role: 'requester', label: 'Payment Requested', status: 'smo_audit' },
                          { role: 'smo', label: 'SMO Audited', status: 'gmo_audit' },
                          { role: 'gmo', label: 'GMO Audited', status: 'boi_audit' },
                          { role: 'boi', label: 'BOI Audited', status: 'gm_audit' },
                          { role: 'gm', label: 'GM Audited', status: 'admin_audit' },
                          { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                          { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                          { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                        ];
                      } else if (dept === 'agri_mart') {
                        workflowSteps = [
                          { role: 'requester', label: 'Payment Requested', status: 'director_audit' },
                          { role: 'director', label: 'Director Audited', status: 'admin_audit' },
                          { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                          { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                          { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                        ];
                      } else if (dept === 'agri') {
                        workflowSteps = [
                          { role: 'requester', label: 'Payment Requested', status: 'smo_audit' },
                          { role: 'smo', label: 'SMO Audited', status: 'boi_audit' },
                          { role: 'boi', label: 'BOI Audited', status: 'director_audit' },
                          { role: 'director', label: 'Director Audited', status: 'admin_audit' },
                          { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                          { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                          { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                        ];
                      } else if (dept === 'accounts') {
                        workflowSteps = [
                          { role: 'requester', label: 'Payment Requested', status: 'director_audit' },
                          { role: 'director', label: 'Director Audited', status: 'admin_audit' },
                          { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                          { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                          { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                        ];
                      } else {
                        workflowSteps = [
                          { role: 'requester', label: 'Payment Requested', status: 'admin_audit' },
                          { role: 'admin', label: 'Admin Verified', status: 'ceo_audit' },
                          { role: 'ceo', label: 'CEO Approved', status: 'ceo_approved' },
                          { role: 'accounts', label: 'Payment Completed', status: 'paid' },
                        ];
                      }

                      const isRejected = currentStatus === 'rejected';
                      const requesterEntry = timeline[0];

                      return workflowSteps.map((step, idx) => {
                        let matchedEntry: any = null;
                        let isCompleted = false;
                        let isCurrent = false;

                        if (step.role === 'requester') {
                          matchedEntry = requesterEntry;
                          isCompleted = true;
                        } else {
                          matchedEntry = timeline.find((t: any) =>
                            t.role?.toLowerCase() === step.role &&
                            t.status !== 'rejected' &&
                            !t.notes?.includes('Reversed')
                          );
                          isCompleted = !!matchedEntry;

                          if (!isCompleted) {
                            const prevStep = workflowSteps[idx - 1];
                            if (prevStep) {
                              const prevCompleted = prevStep.role === 'requester' || !!timeline.find((t: any) =>
                                t.role?.toLowerCase() === prevStep.role &&
                                t.status !== 'rejected' &&
                                !t.notes?.includes('Reversed')
                              );
                              isCurrent = prevCompleted && !isRejected;
                            }
                          }
                        }

                        return (
                          <div key={idx} className="relative pl-4">
                            <div className={cn(
                              "absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-background border-2",
                              isCompleted ? "border-green-500 bg-green-500" : isCurrent ? "border-primary animate-pulse" : "border-muted-foreground/30"
                            )} />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-semibold text-sm",
                                  isCompleted ? "text-green-400" : isCurrent ? "text-primary" : "text-muted-foreground/50"
                                )}>
                                  {isCompleted ? `✓ ${step.label}` : isCurrent ? `⏳ Awaiting ${step.label.replace(' Audited', '').replace(' Verified', '').replace(' Approved', '').replace(' Completed', '')} Audit` : step.label}
                                </span>
                                {matchedEntry && isCompleted && (
                                  <span className="text-xs text-muted-foreground">{format(new Date(matchedEntry.timestamp), 'dd MMM HH:mm')}</span>
                                )}
                              </div>
                              {isCompleted && matchedEntry && (
                                <p className="text-xs text-muted-foreground">
                                  {step.role === 'requester' ? 'Requested by' : 'by'} {matchedEntry.user_name}
                                </p>
                              )}
                              {isCurrent && <p className="text-xs text-primary">Pending review...</p>}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Rejection entry */}
                    {selectedPayment.status === 'rejected' && (() => {
                      const rejEntry = (selectedPayment.audit_timeline as any[]).find(e => e.status === 'rejected');
                      return rejEntry ? (
                        <div className="relative pl-4">
                          <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-red-500 border-2 border-background" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm text-red-400">❌ Rejected</span>
                            <p className="text-xs text-muted-foreground">by {rejEntry.user_name} • {format(new Date(rejEntry.timestamp), 'dd MMM HH:mm')}</p>
                            {rejEntry.notes && <p className="text-xs mt-1 bg-muted/50 p-1.5 rounded italic text-red-400">"{rejEntry.notes}"</p>}
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedPayment.bill_url?.split(',')[0]?.trim()} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    View Proof Folder
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedPayment.work_proof_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Bank Proof
                  </a>
                </Button>
                {(selectedPayment.payment_proof_url || selectedPayment.payment_proof_screenshot) && (selectedPayment as any).utr_verified_at && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedPayment.payment_proof_url || selectedPayment.payment_proof_screenshot || ''} target="_blank" rel="noopener noreferrer">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Payment Proof
                    </a>
                  </Button>
                )}
                {(selectedPayment.payment_proof_url || selectedPayment.payment_proof_screenshot) && !(selectedPayment as any).utr_verified_at && (
                  <span className="text-[10px] text-muted-foreground italic self-center">
                    Proof pending UTR verification
                  </span>
                )}
                {selectedPayment.status === 'paid' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/30 text-primary hover:bg-primary/5"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateVoucher(selectedPayment);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Voucher
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
