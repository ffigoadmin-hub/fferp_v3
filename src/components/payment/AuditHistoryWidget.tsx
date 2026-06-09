import { useState, useEffect, useRef } from 'react';
import { format, differenceInHours } from 'date-fns';
import { getPaymentTimelineSteps, normalizeDepartment } from '@/lib/paymentWorkflow';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePaymentRequests, PAYMENT_STATUS_LABELS } from '@/hooks/usePaymentRequests';
import { safeFormat } from '@/lib/dateUtils';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Check, X, Clock, IndianRupee, Filter, History as HistoryIcon, ChevronDown, ChevronUp, AlertTriangle, Download, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { generateVoucher } from '@/lib/exportUtils';
import { FileText } from 'lucide-react';

interface AuditHistoryWidgetProps {
  role: 'smo' | 'gmo' | 'boi' | 'gm' | 'director' | 'admin' | 'ceo' | 'accounts';
  title?: string;
  onResubmit?: (id: string) => void;
}

const roleLabels: Record<string, string> = {
  smo: 'SMO',
  gmo: 'GMO',
  boi: 'BOI',
  gm: 'GM',
  director: 'Director',
  admin: 'Admin',
  ceo: 'CEO',
  accounts: 'Accounts',
  auditor: 'Auditor',
};

export function AuditHistoryWidget({ role, title, onResubmit }: AuditHistoryWidgetProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditedRequests, setAuditedRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const lastRefetchRef = useRef<number>(0);
  const THROTTLE_MS = 2000;

  const fetchAuditHistory = async (silent = false) => {
    if (!user?.id) {
      if (!silent) setIsLoading(false);
      return;
    }

    // Throttle checks
    const now = Date.now();
    if (silent && now - lastRefetchRef.current < THROTTLE_MS) {
      return;
    }
    lastRefetchRef.current = now;

    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select(`
          *,
          requester:profiles!payment_requests_requester_id_fkey(name, office_number, department)
        `)
        .or(`smo_approved_by.eq.${user.id},gmo_approved_by.eq.${user.id},director_approved_by.eq.${user.id},boi_approved_by.eq.${user.id},gm_approved_by.eq.${user.id},admin_approved_by.eq.${user.id},auditor_approved_by.eq.${user.id},ceo_approved_by.eq.${user.id},accounts_executed_by.eq.${user.id},requester_id.eq.${user.id},audit_timeline.cs.[{"user_id":"${user.id}"}]`)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const processed = (data || []).map((req: any) => {
        const timeline = req.audit_timeline || [];
        const requesterData = req.requester;
        const myEntries = timeline.filter((entry: any) => entry.user_id === user.id);
        let lastAction = myEntries[myEntries.length - 1];

        if (!lastAction) {
          const roleColumnMap: Record<string, string> = {
            smo: 'smo_approved_by', gmo: 'gmo_approved_by', boi: 'boi_approved_by',
            gm: 'gm_approved_by', director: 'director_approved_by', admin: 'admin_approved_by',
            ceo: 'ceo_approved_by', accounts: 'accounts_executed_by', auditor: 'auditor_approved_by'
          };
          const colName = roleColumnMap[role];
          if (colName && req[colName] === user.id) {
            lastAction = {
              action: `${role}_approved`,
              timestamp: req[`${role}_approved_at`] || req.updated_at || new Date().toISOString(),
              user_id: user.id,
              user_name: user.name,
              note: 'Verified from record'
            };
          }
        }

        if (!lastAction && req.requester_id === user.id) {
          lastAction = timeline[0] || {
            action: 'raised',
            timestamp: req.created_at,
            user_id: user.id,
            user_name: user.name,
            role: user.role,
            notes: 'Payment raised by you'
          };
        }

        return {
          ...req,
          requester: requesterData,
          my_action: lastAction,
          _my_interaction_at: lastAction?.timestamp || req.created_at
        };
      }).filter((req: any) => !!req.my_action);

      processed.sort((a: any, b: any) =>
        new Date(b._my_interaction_at).getTime() - new Date(a._my_interaction_at).getTime()
      );

      setAuditedRequests(processed);
    } catch (error) {
      console.error('Error fetching audit history:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditHistory();

    const channel = supabase
      .channel(`audit-history-${role}-${user?.id || 'anon'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_requests',
        },
        (payload) => {
          if (!user?.id) return;

          const record = payload.new as any || payload.old as any;
          if (!record) return;

          // Only refetch if the change is RELEVANT to this user
          // We check basic columns first as they are fastest
          const isUserInvolved =
            record.requester_id === user.id ||
            record.smo_approved_by === user.id ||
            record.gmo_approved_by === user.id ||
            record.boi_approved_by === user.id ||
            record.gm_approved_by === user.id ||
            record.director_approved_by === user.id ||
            record.admin_approved_by === user.id ||
            record.auditor_approved_by === user.id ||
            record.ceo_approved_by === user.id ||
            record.accounts_executed_by === user.id;

          // Also check timeline if record exists
          const isInTimeline = record.audit_timeline?.some((e: any) => e.user_id === user.id);

          if (isUserInvolved || isInTimeline) {
            fetchAuditHistory(true); // Silent throttled refresh
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, role]);

  const filteredRequests = auditedRequests.filter(req => {
    // Exclude payments the user only raised (not audited) — history = audit actions only
    if (req.my_action?.action === 'raised') return false;

    // Department-based filtering for SMO role (matches EnhancedPaymentAuditWidget)
    if (role === 'smo' && user?.department) {
      const auditorDept = normalizeDepartment(user.department);
      const requestDept = normalizeDepartment(req.requester?.department || req.department);

      if (auditorDept === 'jv_engineering' && requestDept !== 'jv_engineering') return false;
      if (auditorDept === 'engineering' && requestDept !== 'engineering') return false;
      if ((auditorDept === 'agri' || auditorDept === 'agri_mart') &&
          !(requestDept === 'agri' || requestDept === 'agri_mart')) return false;
      if (auditorDept === 'purchase' && requestDept !== 'purchase') return false;
    }

    const isRejected = req.my_action?.status === 'rejected' || req.status === 'rejected';
    const matchesStatus = filter === 'all' || (filter === 'approved' && !isRejected) || (filter === 'rejected' && isRejected);

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = searchTerm === '' ||
      req.id.toLowerCase().includes(searchLower) ||
      (req.payment_number && String(req.payment_number).includes(searchLower)) ||
      (req.purpose || '').toLowerCase().includes(searchLower) ||
      (req.vendor_name || '').toLowerCase().includes(searchLower) ||
      (req.requester?.name || '').toLowerCase().includes(searchLower);

    return matchesStatus && matchesSearch;
  });

  const getMyActionBadge = (action: any, currentStatus: string, requesterId?: string) => {
    if (action?.status === 'rejected') {
      return <Badge variant="destructive" className="gap-1"><X className="w-3 h-3" /> You Rejected</Badge>;
    }
    if (currentStatus === 'rejected') {
      return <Badge variant="destructive" className="gap-1"><X className="w-3 h-3" /> Rejected</Badge>;
    }
    if (currentStatus === 'paid') {
      return <Badge className="bg-status-live/20 text-status-live gap-1"><Check className="w-3 h-3" /> Paid</Badge>;
    }
    // If I raised this payment (I am the requester)
    if (requesterId === user?.id && action?.action === 'raised') {
      return <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"><Check className="w-3 h-3" /> You Raised</Badge>;
    }
    // If I approved it, but it's still in progress
    return <Badge variant="secondary" className="gap-1 bg-green-500/10 text-green-600 hover:bg-green-500/20"><Check className="w-3 h-3" /> You Approved</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <HistoryIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{title || `My ${roleLabels[role]} Audit History`}</h3>
          <Badge variant="outline">{filteredRequests.length}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64 bg-background/50"
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            {searchTerm ? (
              <>
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No results matching "{searchTerm}"</p>
                <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="mt-2 text-primary">
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <HistoryIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No audit history found</p>
                <p className="text-sm text-muted-foreground/70">Requests you've processed will appear here</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request, index) => {
            // Find the specific rejection entry if status is rejected
            const rejectionEntry = request.audit_timeline?.find((entry: any) => entry.status === 'rejected');
            const rejectionReason = rejectionEntry?.notes || request.admin_rejection_reason;

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/30",
                    expandedId === request.id && "border-primary/50"
                  )}
                  onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sm text-primary">
                            PAY-{request.payment_number || request.id.slice(0, 8).toUpperCase()}
                          </span>
                          {getMyActionBadge(request.my_action, request.status, request.requester_id)}
                        </div>
                        <p className="font-medium">{request.purpose}</p>

                        {/* Rejection Reason Preview */}
                        {(request.my_action?.status === 'rejected' || request.status === 'rejected') && (
                          <div className="mt-2 text-sm text-destructive flex items-start gap-2 bg-destructive/5 p-2 rounded w-full md:w-fit max-w-2xl">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold block text-xs uppercase tracking-wider mb-0.5">Rejection Reason</span>
                              <span className="font-medium">
                                {rejectionReason || 'No specific reason provided'}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{request.requester?.name || 'Unknown'}</span>
                          <span>•</span>
                          <span>{request.vendor_name}</span>
                          <span>•</span>
                          <span className="capitalize">{request.requester?.department || 'Others'}</span>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="text-xl font-bold flex items-center justify-end">
                            <IndianRupee className="w-4 h-4" />
                            {Number(request.amount).toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.my_action?.status === 'rejected' ? 'Rejected' : 'Actioned'}: {safeFormat(request._my_interaction_at, 'dd MMM, HH:mm')}
                          </p>
                        </div>
                        {expandedId === request.id ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {expandedId === request.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-border"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Details Column */}
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Request Details</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Requester</p>
                                <p className="font-medium">{request.requester?.name}</p>
                                <p className="text-xs text-muted-foreground">{request.requester?.office_number}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Submitted</p>
                                <p className="font-medium">{safeFormat(request.created_at, 'dd MMM yyyy')}</p>
                                <p className="text-xs text-muted-foreground">{safeFormat(request.created_at, 'HH:mm')}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Current Status</p>
                                <p className="font-medium">{PAYMENT_STATUS_LABELS[request.status] || request.status.replace(/_/g, ' ')}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Amount</p>
                                <p className="font-medium">₹{Number(request.amount).toLocaleString()}</p>
                              </div>
                            </div>
                            {request.detailed_description && (
                              <div className="mt-2 p-3 rounded-lg bg-muted flex flex-col gap-1 border border-border/50">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Full Details</span>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                  {request.detailed_description}
                                </p>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-3 pt-2">
                              {request.bill_url && (
                                <a
                                  href={request.bill_url?.split(',')[0]?.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm bg-primary/10 text-primary px-3 py-2 rounded-md hover:bg-primary/20 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Proof Folder ↗
                                </a>
                              )}
                              {request.work_proof_url && (
                                <a
                                  href={request.work_proof_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm bg-blue-500/10 text-blue-700 px-3 py-2 rounded-md hover:bg-blue-500/20 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Bank Proof ↗
                                </a>
                              )}
                              {(request.payment_proof_url || request.payment_proof_screenshot) && request.utr_verified_at && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] gap-1.5"
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <a
                                    href={request.payment_proof_url || request.payment_proof_screenshot || ''}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Download className="w-3 h-3" />
                                    Download Proof
                                  </a>
                                </Button>
                              )}
                              {request.status === 'paid' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    generateVoucher(request);
                                  }}
                                >
                                  <FileText className="w-3 h-3" />
                                  Voucher
                                </Button>
                              )}
                              {(request.payment_proof_url || request.payment_proof_screenshot) && !request.utr_verified_at && (
                                <span className="text-[10px] text-muted-foreground italic">
                                  Proof pending verification
                                </span>
                              )}
                              {onResubmit && (request.status === 'rejected' || request.status.includes('hold')) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onResubmit(request.id);
                                  }}
                                  title="Quick Resubmit"
                                >
                                  <HistoryIcon className="w-3 h-3" />
                                  Quick Resubmit
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Timeline Column */}
                          <div className="border-l pl-6 relative">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Activity Timeline</h4>
                            <div className="space-y-4">
                              {(() => {
                                const timeline = request.audit_timeline || [];
                                const currentStatus = request.status?.toLowerCase() || '';

                                const workflowSteps = getPaymentTimelineSteps(request);

                                const isRejected = currentStatus === 'rejected';
                                const isOnHold = currentStatus === 'ceo_hold' || currentStatus === 'gm_hold';
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

                                    // Fallback: If this role initiated the request, they inherently completed their own step
                                    if (!matchedEntry && requesterEntry?.role?.toLowerCase() === step.role) {
                                      matchedEntry = requesterEntry;
                                    }

                                    isCompleted = !!matchedEntry;

                                    if (!isCompleted) {
                                      const prevStep = workflowSteps[idx - 1];
                                      if (prevStep) {
                                        const prevCompleted = prevStep.role === 'requester' || !!timeline.find((t: any) =>
                                          t.role?.toLowerCase() === prevStep.role &&
                                          t.status !== 'rejected' &&
                                          !t.notes?.includes('Reversed')
                                        );
                                        isCurrent = prevCompleted && !isRejected && !isOnHold;
                                      }
                                      if (currentStatus === step.role + '_audit' || currentStatus === step.status) {
                                        isCurrent = true;
                                      }
                                    }
                                  }

                                  return (
                                    <div key={idx} className="relative">
                                      <div className={cn(
                                        "absolute -left-[29px] top-1 w-3 h-3 rounded-full border-2 border-background",
                                        isCompleted ? "bg-green-500" : isCurrent ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                                      )} />
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                          <span className={cn(
                                            "text-sm font-bold",
                                            isCompleted ? "text-green-400" : isCurrent ? "text-primary" : "text-muted-foreground/50"
                                          )}>
                                            {isCompleted
                                              ? `✓ ${step.label}`
                                              : isCurrent
                                                ? `⏳ Awaiting ${step.label.replace(' Audited', '').replace(' Verified', '').replace(' Approved', '').replace(' Completed', '')} Audit`
                                                : step.label}
                                          </span>
                                          {matchedEntry && isCompleted && (
                                            <span className="text-xs text-muted-foreground">
                                              {safeFormat(matchedEntry.timestamp, 'dd MMM, HH:mm')}
                                            </span>
                                          )}
                                        </div>
                                        {isCompleted && matchedEntry && (
                                          <div className="text-xs text-muted-foreground">
                                            {step.role === 'requester' ? 'Requested by' : 'by'} <span className="font-medium text-foreground">{matchedEntry.user_name}</span>
                                          </div>
                                        )}
                                        {isCompleted && matchedEntry && matchedEntry.notes && matchedEntry.notes !== 'Status updated' && matchedEntry.notes !== 'Request raised' && !matchedEntry.notes.startsWith('Approved by') && !matchedEntry.notes.startsWith('Request raised') && (
                                          <div className="mt-1 text-xs p-2 rounded bg-muted text-muted-foreground">
                                            "{matchedEntry.notes}"
                                          </div>
                                        )}
                                        {isCurrent && !isRejected && (
                                          <div className={cn(
                                            "text-xs font-medium",
                                            currentStatus.includes('hold') ? "text-amber-500" : "text-primary"
                                          )}>
                                            {currentStatus === 'gm_hold' && step.role === 'gm' ? 'ON HOLD' : 'Pending review...'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}

                              {/* Show rejection if applicable */}
                              {request.status === 'rejected' && (() => {
                                const rejEntry = (request.audit_timeline || []).find((e: any) => e.status === 'rejected');
                                return rejEntry ? (
                                  <div className="relative">
                                    <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full border-2 border-background bg-destructive" />
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-destructive">❌ Rejected</span>
                                        <span className="text-xs text-muted-foreground">{safeFormat(rejEntry.timestamp, 'dd MMM, HH:mm')}</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        by <span className="font-medium text-foreground">{rejEntry.user_name}</span>
                                      </div>
                                      <div className="mt-1 text-xs p-2 rounded bg-destructive/10 text-destructive font-medium">
                                        "{rejEntry.notes}"
                                      </div>
                                    </div>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )
      }
    </div >
  );
}
