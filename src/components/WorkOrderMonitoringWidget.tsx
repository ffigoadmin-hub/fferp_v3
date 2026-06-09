import { useState } from 'react';
import { FileText, Loader2, Building2, CheckCircle, Clock, AlertTriangle, X, Eye, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkOrders, WorkOrder } from '@/hooks/useWorkOrders';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkOrderMonitoringWidgetProps {
  role?: 'ceo' | 'gmo' | 'gm' | 'admin' | 'smo';
  showApprovalActions?: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ElementType }> = {
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending', icon: Clock },
  pending_signature: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Sign Waiting', icon: Clock },
  signed: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Signed', icon: CheckCircle },
  pending_smo: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Pending SMO', icon: Clock },
  pending_gmo: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Pending GMO', icon: Clock },
  pending_gm: { bg: 'bg-sky-500/20', text: 'text-sky-400', label: 'Pending GM', icon: Clock },
  pending_admin: { bg: 'bg-teal-500/20', text: 'text-teal-400', label: 'Pending Admin', icon: Clock },
  pending_ceo: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending CEO', icon: Clock },
  admin_approved: { bg: 'bg-sky-500/20', text: 'text-sky-400', label: 'Admin Approved', icon: CheckCircle },
  ceo_approved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'CEO Approved', icon: CheckCircle },
  approved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Approved', icon: CheckCircle },
  ceo_hold: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'On Hold', icon: AlertTriangle },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected', icon: X },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed', icon: CheckCircle },
};

export function WorkOrderMonitoringWidget({ role = 'gmo', showApprovalActions = false }: WorkOrderMonitoringWidgetProps) {
  const { workOrders, isLoading, refetch, approveWorkOrder, rejectWorkOrder, holdWorkOrder } = useWorkOrders();
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);

  // Stats
  const pendingCount = workOrders.filter(wo =>
    wo.status.startsWith('pending_') || wo.status === 'signed'
  ).length;
  const adminApprovedCount = workOrders.filter(wo =>
    ['pending_ceo', 'approved', 'ceo_approved'].includes(wo.status)
  ).length;
  const ceoApprovedCount = workOrders.filter(wo =>
    wo.status === 'approved' || wo.status === 'ceo_approved'
  ).length;
  const totalAmount = workOrders.reduce((acc, wo) => acc + (wo.estimated_amount || 0), 0);

  // Map role to expected pending status
  const roleStatusMap: Record<string, string> = {
    smo: 'pending_smo',
    gmo: 'pending_gmo',
    gm: 'pending_gm',
    admin: 'pending_admin',
    ceo: 'pending_ceo',
  };

  const handleApprove = async (wo: WorkOrder, approveRole: 'smo' | 'gmo' | 'gm' | 'admin' | 'ceo') => {
    await approveWorkOrder(wo.id, approveRole);
    refetch();
  };

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
        <CardHeader className="py-4 px-5 border-b border-border/30">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-violet-400" />
              </div>
              Work Order Monitoring
              <Badge variant="secondary" className="ml-2">{workOrders.length}</Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="p-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center transition-all hover:bg-amber-500/10">
                    <p className="text-lg font-bold text-amber-500 tabular-nums">{pendingCount}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Pending</p>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/10 text-center transition-all hover:bg-sky-500/10">
                    <p className="text-lg font-bold text-sky-500 tabular-nums">{adminApprovedCount}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Admin OK</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center transition-all hover:bg-emerald-500/10">
                    <p className="text-lg font-bold text-emerald-500 tabular-nums">{ceoApprovedCount}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">CEO OK</p>
                  </div>
                  <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10 text-center transition-all hover:bg-violet-500/10">
                    <p className="text-lg font-bold text-violet-500 tabular-nums">
                      ₹{totalAmount > 100000 ? `${(totalAmount / 100000).toFixed(1)}L` : totalAmount.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Total Value</p>
                  </div>
                </div>

                {/* Work Orders List */}
                {workOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No work orders yet</p>
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">WO#</TableHead>
                          <TableHead className="text-xs">Project</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workOrders.map((wo) => {
                          const status = statusConfig[wo.status] || statusConfig.pending;
                          const StatusIcon = status.icon;
                          return (
                            <TableRow key={wo.id} className="hover:bg-muted/50">
                              <TableCell className="font-mono text-xs">
                                WO-{String(wo.wo_number).padStart(3, '0')}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3 h-3 text-muted-foreground" />
                                  <span className="truncate max-w-[100px]">
                                    {wo.project?.project_name || 'N/A'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <span className="truncate max-w-[150px] block">
                                  {wo.work_description}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-right font-bold tabular-nums text-foreground/90">
                                ₹{(wo.estimated_amount || 0).toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-bold uppercase tracking-tight border-0 shadow-sm px-2 py-0.5",
                                    status.bg,
                                    status.text
                                  )}
                                >
                                  <StatusIcon className="w-3 h-3 mr-1 opacity-70" />
                                  {status.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => setSelectedWO(wo)}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                  {showApprovalActions && role && wo.status === roleStatusMap[role] && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="h-7 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 border-0"
                                      onClick={() => handleApprove(wo, role as 'smo' | 'gmo' | 'gm' | 'admin' | 'ceo')}
                                    >
                                      Approve
                                    </Button>
                                  )}
                                  {showApprovalActions && role && wo.status === roleStatusMap[role] && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/10 border-0"
                                      onClick={() => {
                                        setSelectedWO(wo);
                                        setShowRejectDialog(true);
                                      }}
                                    >
                                      Reject
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Work Order Details Modal */}
      <Dialog open={!!selectedWO} onOpenChange={() => setSelectedWO(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-400" />
              Work Order Details
            </DialogTitle>
          </DialogHeader>

          {selectedWO && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 pb-4">
                {/* Header Info */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono">
                    WO-{String(selectedWO.wo_number).padStart(3, '0')}
                  </Badge>
                  {(() => {
                    const status = statusConfig[selectedWO.status] || statusConfig.pending;
                    return (
                      <Badge variant="outline" className={cn("border-0", status.bg, status.text)}>
                        {status.label}
                      </Badge>
                    );
                  })()}
                </div>

                {/* Project Info */}
                <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{selectedWO.project?.project_name || 'N/A'}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      ({selectedWO.project?.project_id})
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requested by: {selectedWO.requester?.name} ({selectedWO.requester?.department})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created: {format(new Date(selectedWO.created_at), 'dd MMM yyyy, h:mm a')}
                  </p>
                </div>

                {/* Work Details */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Work Description</h4>
                  <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg">
                    {selectedWO.work_description}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Detailed Scope</h4>
                  <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg whitespace-pre-wrap">
                    {selectedWO.detailed_scope || 'Not specified'}
                  </p>
                </div>

                {/* Financial Info */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-violet-500/10 text-center">
                    <p className="text-lg font-bold text-violet-400">
                      ₹{(selectedWO.estimated_amount || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground">Estimated</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                    <p className="text-lg font-bold text-amber-400">
                      ₹{(selectedWO.advance_amount || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground">Advance</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                    <p className="text-lg font-bold text-emerald-400">
                      ₹{(selectedWO.final_amount || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-muted-foreground">Final</p>
                  </div>
                </div>

                {/* Document Link */}
                {selectedWO.wo_document_url && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Document</h4>
                    <a
                      href={selectedWO.wo_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      View Work Order Document →
                    </a>
                  </div>
                )}

                {/* Signed Document Link (Vendor) */}
                {selectedWO.signed_document_url && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Signed Document (Vendor)</h4>
                    <a
                      href={selectedWO.signed_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-400 hover:underline flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> View Signed Work Order →
                    </a>
                  </div>
                )}

                {/* Approval Status */}
                {(selectedWO.admin_approved_at || selectedWO.ceo_approved_at) && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Approvals</h4>
                    {selectedWO.admin_approved_at && (
                      <p className="text-xs text-muted-foreground">
                        ✓ Admin approved on {format(new Date(selectedWO.admin_approved_at), 'dd MMM yyyy')}
                      </p>
                    )}
                    {selectedWO.ceo_approved_at && (
                      <p className="text-xs text-muted-foreground">
                        ✓ CEO approved on {format(new Date(selectedWO.ceo_approved_at), 'dd MMM yyyy')}
                      </p>
                    )}
                  </div>
                )}

                {/* Hold/Reject Reason */}
                {selectedWO.ceo_hold_reason && (
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <h4 className="text-sm font-medium text-orange-400 mb-1">Hold Reason</h4>
                    <p className="text-sm text-muted-foreground">{selectedWO.ceo_hold_reason}</p>
                  </div>
                )}
                {selectedWO.admin_rejection_reason && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <h4 className="text-sm font-medium text-red-400 mb-1">Rejection Reason</h4>
                    <p className="text-sm text-muted-foreground">{selectedWO.admin_rejection_reason}</p>
                  </div>
                )}

                {/* Settlement Details */}
                {(selectedWO as any).vendor_request && (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 mt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-3 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5" />
                      Verified Settlement Details
                    </h4>
                    <div className="grid grid-cols-2 gap-y-3 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-0.5">Beneficiary</p>
                        <p className="font-bold">{(selectedWO as any).vendor_request.aligned_vendor_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Account Number</p>
                        <p className="font-bold tabular-nums">{(selectedWO as any).vendor_request.vendor_account_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Bank Name</p>
                        <p className="font-bold">{(selectedWO as any).vendor_request.vendor_bank_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">IFSC Code</p>
                        <p className="font-bold tabular-nums">{(selectedWO as any).vendor_request.vendor_ifsc || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Reject Work Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting this work order. This feedback will be sent back to the engineer.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection Reason</label>
              <textarea
                className="w-full h-24 p-2 rounded-md border border-input bg-background/50 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                placeholder="Details of what needs to be changed..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason || !selectedWO}
              onClick={async () => {
                if (selectedWO && role) {
                  await rejectWorkOrder(selectedWO.id, rejectReason, role);
                  setShowRejectDialog(false);
                  setRejectReason('');
                  setSelectedWO(null);
                  refetch();
                }
              }}
            >
              Submit Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
