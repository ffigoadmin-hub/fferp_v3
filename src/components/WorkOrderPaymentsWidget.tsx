import { useState } from 'react';
import { Plus, CheckCircle, XCircle, Clock, CreditCard, ArrowRight, Loader2, FileText, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkOrderPayments, WorkOrderPayment } from '@/hooks/useWorkOrderPayments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface WorkOrderPaymentsWidgetProps {
  workOrderId: string;
  totalAmount: number;
  projectId: string;
  role?: 'engineer' | 'boi' | 'admin' | 'ceo';
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending BOI', color: 'bg-amber-500/20 text-amber-400', icon: Clock },
  boi_approved: { label: 'BOI Approved', color: 'bg-blue-500/20 text-blue-400', icon: CheckCircle },
  boi_rejected: { label: 'BOI Rejected', color: 'bg-red-500/20 text-red-400', icon: XCircle },
  admin_approved: { label: 'Admin Approved', color: 'bg-indigo-500/20 text-indigo-400', icon: CheckCircle },
  admin_rejected: { label: 'Admin Rejected', color: 'bg-red-500/20 text-red-400', icon: XCircle },
  ceo_approved: { label: 'CEO Approved', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle },
  ceo_hold: { label: 'CEO Hold', color: 'bg-orange-500/20 text-orange-400', icon: AlertTriangle },
  payment_created: { label: 'Payment Created', color: 'bg-purple-500/20 text-purple-400', icon: CreditCard },
  paid: { label: 'Paid', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400', icon: XCircle },
};

export function WorkOrderPaymentsWidget({ workOrderId, totalAmount, projectId, role = 'engineer' }: WorkOrderPaymentsWidgetProps) {
  const { user } = useAuth();
  const { payments, isLoading, isSaving, createPayment, boiVerify, adminApprove, ceoApprove, createLinkedPayment } = useWorkOrderPayments(workOrderId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<WorkOrderPayment | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  const [newPayment, setNewPayment] = useState({
    paymentType: 'installment' as 'advance' | 'installment' | 'final',
    amount: 0,
    description: '',
  });

  const paidAmount = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingAmount = payments
    .filter(p => !['paid', 'cancelled', 'boi_rejected', 'admin_rejected'].includes(p.status))
    .reduce((sum, p) => sum + p.amount, 0);

  const handleCreatePayment = async () => {
    if (newPayment.amount <= 0) return;

    const result = await createPayment({
      workOrderId,
      paymentType: newPayment.paymentType,
      amount: newPayment.amount,
      description: newPayment.description,
    });

    if (result.success) {
      setShowAddModal(false);
      setNewPayment({ paymentType: 'installment', amount: 0, description: '' });
    }
  };

  const handleAction = async () => {
    if (!selectedPayment) return;

    const isApprove = actionType === 'approve';

    if (role === 'boi') {
      await boiVerify(selectedPayment.id, isApprove, rejectionReason);
    } else if (role === 'admin') {
      await adminApprove(selectedPayment.id, isApprove, rejectionReason);
    } else if (role === 'ceo') {
      await ceoApprove(selectedPayment.id, isApprove, rejectionReason);
    }

    setShowActionModal(false);
    setSelectedPayment(null);
    setRejectionReason('');
  };

  const handleReleasePayment = async (payment: WorkOrderPayment) => {
    await createLinkedPayment(payment.id, projectId);
  };

  const canApprove = (payment: WorkOrderPayment) => {
    if (role === 'boi' && payment.status === 'pending') return true;
    if (role === 'admin' && payment.status === 'boi_approved') return true;
    if (role === 'ceo' && payment.status === 'admin_approved') return true;
    return false;
  };

  const canRelease = (payment: WorkOrderPayment) => {
    return role === 'admin' && payment.status === 'ceo_approved' && !payment.linked_payment_id;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Work Order Payments
          </CardTitle>
          {role === 'engineer' && (
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Payment
            </Button>
          )}
        </div>

        {/* Payment Summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/20 transition-all hover:bg-muted/40">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Total Budget</p>
            <p className="text-lg font-bold tabular-nums">₹{totalAmount.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 transition-all hover:bg-emerald-500/10">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Disbursed</p>
            <p className="text-lg font-bold text-emerald-500 tabular-nums">₹{paidAmount.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 transition-all hover:bg-amber-500/10">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">In Pipeline</p>
            <p className="text-lg font-bold text-amber-500 tabular-nums">₹{pendingAmount.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No payment installments yet</p>
            {role === 'engineer' && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add First Payment
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval Chain</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const config = statusConfig[payment.status] || statusConfig.pending;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">#{payment.payment_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {payment.payment_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold tabular-nums text-foreground/90">
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-tight border-0 shadow-sm px-2 py-0.5",
                            config.color
                          )}
                        >
                          <config.icon className="h-3 w-3 mr-1 opacity-70" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <span className={payment.boi_verified_at ? 'text-emerald-400' : 'text-muted-foreground'}>
                            BOI
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span className={payment.admin_approved_at ? 'text-emerald-400' : 'text-muted-foreground'}>
                            Admin
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span className={payment.ceo_approved_at ? 'text-emerald-400' : 'text-muted-foreground'}>
                            CEO
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canApprove(payment) && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 border-0"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setActionType('approve');
                                  setShowActionModal(true);
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] font-bold uppercase tracking-wider border-red-500/30 text-red-400 hover:bg-red-500/10"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setActionType('reject');
                                  setShowActionModal(true);
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {canRelease(payment) && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-[10px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 border-0"
                              onClick={() => handleReleasePayment(payment)}
                            >
                              Release
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

      {/* Add Payment Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Installment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Type</Label>
              <Select
                value={newPayment.paymentType}
                onValueChange={(value) => setNewPayment({ ...newPayment, paymentType: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="installment">Installment</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: Number(e.target.value) })}
                placeholder="Enter amount"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Remaining: ₹{(totalAmount - paidAmount - pendingAmount).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newPayment.description}
                onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                placeholder="Payment description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePayment} disabled={isSaving || newPayment.amount <= 0}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Modal */}
      <Dialog open={showActionModal} onOpenChange={setShowActionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Payment' : 'Reject Payment'}
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Payment #{selectedPayment.payment_number}</p>
                <p className="text-xl font-bold">₹{selectedPayment.amount.toLocaleString('en-IN')}</p>
                <p className="text-sm mt-1">{selectedPayment.description || 'No description'}</p>
              </div>

              {actionType === 'reject' && (
                <div>
                  <Label>Rejection Reason *</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide reason for rejection..."
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionType === 'reject' && !rejectionReason}
              className={actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
