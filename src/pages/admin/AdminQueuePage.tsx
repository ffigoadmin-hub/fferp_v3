import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Check, X, FileText, ExternalLink, IndianRupee, User, Building2, Clock, Banknote, CreditCard, FolderKanban, Leaf } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimePayments } from '@/hooks/useRealtimePayments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { differenceInHours, format } from 'date-fns';

type Vertical = 'all' | 'Civil' | 'Agri';

const urgencyConfig: Record<string, { bg: string; border: string; text: string; label: string }> = {
  emergency: { bg: 'bg-status-missed/10', border: 'border-status-missed/40', text: 'text-status-missed', label: '🔴 EMERGENCY' },
  important: { bg: 'bg-status-late/10', border: 'border-status-late/40', text: 'text-status-late', label: '🟡 IMPORTANT' },
  normal: { bg: 'bg-status-live/10', border: 'border-status-live/40', text: 'text-status-live', label: '🟢 NORMAL' },
};

export function AdminQueuePage() {
  // Real-time updates: fetch data from hook directly
  const { requests, isLoading, refresh: refetch } = useRealtimePayments(['admin_audit']);
  const { updateStatus, isSaving } = usePaymentRequests({ skipFetch: true }); // Actions only; avoid duplicate full fetch

  const { projects } = useProjects();
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async (id: string) => {
    const result = await updateStatus(id, 'admin_approved');
    if (result.success) {
      toast.success('Approved and sent to CEO');
      setSelectedPayment(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is mandatory');
      return;
    }
    const result = await updateStatus(id, 'rejected', { rejectionReason });
    if (result.success) {
      toast.success('Rejected and returned to requester');
      setSelectedPayment(null);
      setRejectionReason('');
    }
  };

  const getProjectDetails = (projectId: string | undefined) => {
    if (!projectId) return null;
    return projects.find(p => p.id === projectId);
  };

  // Filter requests by vertical (Removed as per request)
  const filteredRequests = requests;

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Payment Audit Queue</h1>
          <p className="text-muted-foreground">Verify legitimacy before CEO review</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-status-late">{filteredRequests.length}</p>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-authority-admin/10 border border-authority-admin/30">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-authority-admin" />
          <span className="font-semibold text-authority-admin">Audit Checklist</span>
        </div>
        <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground">
          <p>✓ Vendor legitimacy</p>
          <p>✓ Proof authenticity</p>
          <p>✓ Work proof match</p>
          <p>✓ Bank details verified</p>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRequests.map((payment, index) => {
          const urgencyStyle = urgencyConfig[payment.urgency] || urgencyConfig.normal;
          const hoursUntilCutoff = differenceInHours(new Date(`${payment.cutoff_date}T${payment.cutoff_time}`), new Date());
          const isExpanded = selectedPayment === payment.id;
          const project = getProjectDetails((payment as any).project_id);
          const paymentType = (payment as any).payment_type || 'bank_account';

          return (
            <motion.div key={payment.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
              className={cn('authority-card border-2', urgencyStyle.border, isExpanded && 'ring-2 ring-primary/30')}>

              {/* Header Row */}
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setSelectedPayment(isExpanded ? null : payment.id)}>
                <div className="flex items-center gap-4">
                  <span className={cn('px-3 py-1 rounded text-xs font-semibold', urgencyStyle.bg, urgencyStyle.text)}>{urgencyStyle.label}</span>
                  {payment.is_overridden && (
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10 text-green-600 border border-green-500/20" title="Guardian Verified">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">{payment.purpose}</p>
                    <p className="text-sm text-muted-foreground">{payment.vendor_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xl font-bold flex items-center"><IndianRupee className="w-4 h-4" />{Number(payment.amount).toLocaleString('en-IN')}</p>
                  </div>
                  <div className={cn('px-4 py-2 rounded-lg', hoursUntilCutoff <= 24 ? 'bg-status-missed/10' : 'bg-muted/30')}>
                    <p className="font-bold">{hoursUntilCutoff}h</p>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-border">

                  {/* Payment Type Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className="gap-1">
                      {paymentType === 'upi' ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                      {paymentType === 'upi' ? 'UPI Payment' : 'Bank Transfer'}
                    </Badge>
                    <Badge variant="outline">
                      {payment.is_project_work ? 'Project Work' : 'Non-Project'}
                    </Badge>
                    {(payment as any).payment_number && (
                      <Badge variant="secondary">PAY-{String((payment as any).payment_number).padStart(4, '0')}</Badge>
                    )}
                    {payment.is_overridden && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1 font-semibold">
                        <ShieldCheck className="w-3 h-3" />
                        Guardian Verified
                      </Badge>
                    )}
                  </div>

                  {/* Enhanced Description View */}
                  <div className="mb-6 p-4 rounded-lg bg-muted/40 border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Description / Purpose</p>
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{payment.purpose}</p>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {/* Requester Info */}
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <User className="w-3 h-3" />
                        <span>Requester</span>
                      </div>
                      <p className="font-medium">{payment.requester?.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{payment.requester?.department || ''}</p>
                    </div>

                    {/* Vendor Info */}
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Building2 className="w-3 h-3" />
                        <span>Vendor</span>
                      </div>
                      <p className="font-medium">{payment.vendor_name}</p>
                    </div>

                    {/* Cutoff Time */}
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3 h-3" />
                        <span>Cut-off</span>
                      </div>
                      <p className="font-medium">{format(new Date(payment.cutoff_date), 'dd MMM yyyy')}</p>
                      <p className="text-sm text-muted-foreground">{payment.cutoff_time}</p>
                    </div>

                    {/* Project Details (if project work) */}
                    {payment.is_project_work && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 text-xs text-primary mb-1">
                          <FolderKanban className="w-3 h-3" />
                          <span>Project</span>
                        </div>
                        {project ? (
                          <>
                            <p className="font-medium">{project.project_id}</p>
                            <p className="text-sm text-muted-foreground">{project.project_name}</p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not linked</p>
                        )}
                        {payment.wo_number && (
                          <Badge variant="outline" className="mt-1">{payment.wo_number}</Badge>
                        )}
                      </div>
                    )}

                    {/* Payment Amount */}
                    <div className="p-3 rounded-lg bg-status-live/10 border border-status-live/30">
                      <div className="flex items-center gap-2 text-xs text-status-live mb-1">
                        <IndianRupee className="w-3 h-3" />
                        <span>Amount</span>
                      </div>
                      <p className="text-2xl font-bold">₹{Number(payment.amount).toLocaleString('en-IN')}</p>
                    </div>

                    {/* Created Date */}
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="w-3 h-3" />
                        <span>Submitted</span>
                      </div>
                      <p className="font-medium">{format(new Date(payment.created_at), 'dd MMM yyyy')}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(payment.created_at), 'HH:mm')}</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Bank/UPI Details */}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      {paymentType === 'upi' ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                      Payment Details for Accountant
                    </h4>

                    {paymentType === 'upi' ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">UPI ID</p>
                          <p className="font-mono font-medium text-lg">{(payment as any).vendor_upi || payment.vendor_bank_details}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Payee Name</p>
                          <p className="font-medium">{payment.vendor_name}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Account Number</p>
                          <p className="font-mono font-medium">{(payment as any).vendor_account_number || payment.vendor_bank_details}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">IFSC Code</p>
                          <p className="font-mono font-medium">{(payment as any).vendor_ifsc_code || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Beneficiary Name</p>
                          <p className="font-medium">{payment.vendor_name}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Document Links */}
                  <div className="flex items-center gap-4 mb-4">
                    <a href={payment.bill_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border transition-colors">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium">View Proof Folder</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <a href={payment.work_proof_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border transition-colors">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium">View Work Proof</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>

                  {/* Rejection Reason */}
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Rejection reason (mandatory if rejecting)"
                    className="mb-4"
                  />

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    <Button onClick={() => handleApprove(payment.id)} disabled={isSaving} className="flex-1 bg-status-live hover:bg-status-live/80">
                      <Check className="w-4 h-4 mr-2" />Approve → CEO
                    </Button>
                    <Button onClick={() => handleReject(payment.id)} disabled={isSaving} variant="destructive" className="flex-1">
                      <X className="w-4 h-4 mr-2" />Reject
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}

        {requests.length === 0 && (
          <div className="authority-card text-center py-12">
            <ShieldCheck className="w-12 h-12 text-status-live mx-auto mb-4" />
            <p className="text-lg font-semibold">Queue Clear</p>
            <p className="text-muted-foreground">No pending payments for audit</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
