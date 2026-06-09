import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { toast } from 'sonner';

export function AdminOrdersQueuePage() {
  const { requests, isLoading, approveRequest, updateRequest, refetch } = useMaterialRequests();
  const { quotes } = useVendorQuotes();
  
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Admin sees orders with approval_status = 'pending_admin'
  const pendingRequests = requests.filter(req => req.approval_status === 'pending_admin');

  const getQuoteForRequest = (requestId: string) => {
    return quotes.find(q => q.material_request_id === requestId && q.is_selected);
  };

  const getMaterialName = (boqItems: any) => {
    if (Array.isArray(boqItems) && boqItems.length > 0) {
      return boqItems[0]?.material_name || 'Materials';
    }
    return 'Materials';
  };

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await approveRequest(id, 'admin');
      toast.success('Material request approved - forwarded to CEO');
      refetch();
    } catch (error) {
      toast.error('Failed to approve request');
    }
    setProcessing(null);
  };

  const openRejectDialog = (id: string) => {
    setSelectedId(id);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedId || !rejectReason.trim()) return;
    setProcessing(selectedId);
    try {
      await updateRequest(selectedId, { 
        approval_status: 'admin_rejected',
      } as any);
      toast.success('Material request rejected');
      refetch();
    } catch (error) {
      toast.error('Failed to reject request');
    }
    setRejectDialogOpen(false);
    setProcessing(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
          <Package className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Material Request Approvals</h1>
          <p className="text-muted-foreground">Review and approve material procurement requests</p>
        </div>
        {pendingRequests.length > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {pendingRequests.length} Pending
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="authority-card text-center py-8">
          <CheckCircle2 className="w-12 h-12 text-status-live mx-auto mb-2" />
          <p className="text-muted-foreground">No pending material requests</p>
          <p className="text-xs text-muted-foreground mt-1">
            Requests verified by BOI will appear here for your approval
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map(req => {
            const quote = getQuoteForRequest(req.id);
            return (
              <div key={req.id} className="authority-card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">MR-{req.id.slice(0, 8).toUpperCase()}</Badge>
                      <Badge className="bg-amber-500/20 text-amber-600">BOI Verified</Badge>
                    </div>
                    <h3 className="font-semibold mt-2">{getMaterialName(req.boq_items)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {req.requester?.name} • {req.requester?.department}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      ₹{(quote?.quoted_total || 0).toLocaleString()}
                    </p>
                    {quote && (
                      <p className="text-xs text-muted-foreground">
                        Vendor: {quote.vendor_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Project: </span>
                    <span className="font-medium">{req.project?.project_id} - {req.project?.project_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phase: </span>
                    <span className="font-medium">{req.phase?.phase_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requested: </span>
                    <span>{format(new Date(req.created_at), 'dd MMM yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Items: </span>
                    <span>{Array.isArray(req.boq_items) ? req.boq_items.length : 0} items</span>
                  </div>
                </div>

                {req.notes && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm">
                    <p className="text-muted-foreground mb-1">Notes:</p>
                    <p>{req.notes}</p>
                  </div>
                )}

                {quote && (
                  <div className="mb-4 p-3 bg-primary/5 rounded-lg text-sm border border-primary/20">
                    <p className="text-muted-foreground mb-1">Selected Vendor Quote:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>Vendor: <span className="font-medium">{quote.vendor_name}</span></div>
                      <div>Amount: <span className="font-medium">₹{quote.quoted_total.toLocaleString()}</span></div>
                      {quote.delivery_days && (
                        <div>Delivery: <span className="font-medium">{quote.delivery_days} days</span></div>
                      )}
                    </div>
                    {quote.quote_drive_link && (
                      <a 
                        href={quote.quote_drive_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 mt-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Quote Document
                      </a>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(req.id)}
                    disabled={processing === req.id}
                    className="flex-1"
                  >
                    {processing === req.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve & Forward to CEO
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => openRejectDialog(req.id)}
                    disabled={processing === req.id}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Material Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be visible to the requester.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectReason.trim() || processing !== null}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
