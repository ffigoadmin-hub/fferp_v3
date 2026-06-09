import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Package, Truck, CheckCircle, ArrowRight, 
  Building2, FolderKanban, IndianRupee, FileText, ExternalLink, UserCheck
} from 'lucide-react';
import { useMaterialRequests, MaterialRequest } from '@/hooks/useMaterialRequests';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';


const orderStatusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ordered: { label: 'Ordered', color: 'bg-blue-500/20 text-blue-400', icon: Package },
  loading: { label: 'Loading', color: 'bg-orange-500/20 text-orange-400', icon: Package },
  shipped: { label: 'Shipped', color: 'bg-cyan-500/20 text-cyan-400', icon: Truck },
  unloading: { label: 'Unloading', color: 'bg-amber-500/20 text-amber-400', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
};

export function MaterialOrderTrackingWidget() {
  const { user } = useAuth();
  const { requests, refetch } = useMaterialRequests();
  const { quotes } = useVendorQuotes();
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [auditorName, setAuditorName] = useState('');
  const [auditConfirmed, setAuditConfirmed] = useState(false);


  // Filter for requests that need order tracking (ordered, loading, shipped, unloading, delivered pending audit)
  const trackableRequests = requests.filter(r => {
    const orderStatus = r.order_status;
    const hasApproval = r.status === 'approved' || r.approval_status === 'ceo_approved';
    const isTrackable = orderStatus === 'ordered' || orderStatus === 'loading' || 
      orderStatus === 'shipped' || orderStatus === 'unloading' ||
      (orderStatus === 'delivered' && r.farm_audit_status === 'pending');
    
    return hasApproval && isTrackable;
  });

  const getSelectedQuote = (request: MaterialRequest) => {
    return quotes.find(q => q.id === request.selected_quote_id);
  };

  const openUpdateModal = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setOrderNotes(request.order_notes || '');
    setInvoiceUrl(request.invoice_url || '');
    setUpdateOpen(true);
  };

  const openDeliveryModal = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setOrderNotes(request.order_notes || '');
    setInvoiceUrl(request.invoice_url || '');
    setAuditorName('');
    setAuditConfirmed(false);
    setUpdateOpen(false);
    setDeliveryModalOpen(true);
  };

  const handleUpdateStatus = async (newStatus: 'loading' | 'shipped' | 'unloading') => {
    if (!selectedRequest || !user) return;
    setIsProcessing(true);

    try {
      const updates: any = {
        order_status: newStatus,
        order_notes: orderNotes,
        invoice_url: invoiceUrl,
      };

      const { error } = await supabase
        .from('material_requests')
        .update(updates)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Log to procurement timeline
      const actionMap: Record<string, string> = {
        loading: 'loading_started',
        shipped: 'order_shipped',
        unloading: 'unloading_started',
      };

      await supabase.from('procurement_timeline').insert({
        material_request_id: selectedRequest.id,
        action: actionMap[newStatus],
        performed_by: user.id,
        performed_by_name: user.name,
        details: { notes: orderNotes },
      });

      const statusMessages: Record<string, string> = {
        loading: 'Materials being loaded by vendor',
        shipped: 'Order marked as shipped',
        unloading: 'Materials being unloading at site',
      };

      toast.success(statusMessages[newStatus]);
      setUpdateOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!selectedRequest || !user) return;
    if (!auditorName.trim()) {
      toast.error('Please enter the Farm Manager name');
      return;
    }
    if (!auditConfirmed) {
      toast.error('Please confirm that audit is completed');
      return;
    }
    setIsProcessing(true);

    try {
      // Update material request as delivered and verified
      const { error } = await supabase
        .from('material_requests')
        .update({
          order_status: 'delivered',
          order_notes: orderNotes,
          invoice_url: invoiceUrl,
          actual_delivery_date: new Date().toISOString().split('T')[0],
          farm_audit_status: 'verified',
          farm_audited_at: new Date().toISOString(),
          farm_audited_by: user.id,
          farm_audit_notes: `Audited with ${auditorName} via video call`,
          added_to_inventory: true,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Add items to project inventory
      const boqItems = selectedRequest.boq_items || [];
      for (const item of boqItems as any[]) {
        await supabase.from('project_inventory').insert({
          project_id: selectedRequest.project_id,
          material_name: item.material_name || item.name,
          specification: item.specification || '',
          unit: item.unit || 'nos',
          quantity_received: item.quantity || 0,
          quantity_used: 0,
          quantity_available: item.quantity || 0,
          source_type: 'material_request',
          source_id: selectedRequest.id,
          received_date: new Date().toISOString().split('T')[0],
          added_by: user.id,
        });
      }

      // Log to procurement timeline
      await supabase.from('procurement_timeline').insert({
        material_request_id: selectedRequest.id,
        action: 'delivery_verified_added_inventory',
        performed_by: user.id,
        performed_by_name: user.name,
        details: { 
          notes: orderNotes,
          audited_with: auditorName,
          items_added: boqItems.length,
        },
      });

      // Log to audit logs
      await supabase.from('audit_logs').insert({
        action: 'delivery_audit_completed',
        record_type: 'material_request',
        record_id: selectedRequest.id,
        performed_by: user.id,
        performed_by_name: user.name,
        after_state: {
          audited_with: auditorName,
          items_added_to_inventory: boqItems.length,
        },
      });

      toast.success(`Delivery verified & ${boqItems.length} items added to inventory`);
      setDeliveryModalOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error marking delivered:', error);
      toast.error('Failed to complete delivery audit');
    } finally {
      setIsProcessing(false);
    }
  };

  if (trackableRequests.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="w-5 h-5" />
            Order Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No active orders to track</p>
            <p className="text-sm">Orders will appear here after payment execution</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="w-5 h-5" />
            Order Tracking
            <Badge variant="secondary" className="ml-2">{trackableRequests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {trackableRequests.map((request) => {
                const selectedQuote = getSelectedQuote(request);
                const orderStatus = request.order_status || 'ordered';
                const statusConfig = orderStatusConfig[orderStatus];

                return (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <FolderKanban className="w-4 h-4 text-primary" />
                          <span className="font-semibold">
                            {request.project?.project_name || 'Unknown Project'}
                          </span>
                        </div>
                        {request.phase?.phase_name && (
                          <p className="text-sm text-muted-foreground ml-6">
                            Phase: {request.phase.phase_name}
                          </p>
                        )}
                      </div>
                      <Badge className={cn(statusConfig.color, "border-0 gap-1")}>
                        <statusConfig.icon className="w-3 h-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Vendor & Amount */}
                    {selectedQuote && (
                      <div className="p-3 rounded-lg bg-muted/50 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{selectedQuote.vendor_name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-lg font-bold">
                            <IndianRupee className="w-4 h-4" />
                            {selectedQuote.quoted_total?.toLocaleString()}
                          </div>
                        </div>
                        {selectedQuote.delivery_days && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Expected delivery: {selectedQuote.delivery_days} days
                          </p>
                        )}
                      </div>
                    )}

                    {/* Materials Count */}
                    <p className="text-sm text-muted-foreground mb-3">
                      {(request.boq_items || []).length} items ordered
                    </p>

                    {/* Order Notes */}
                    {request.order_notes && (
                      <p className="text-xs text-muted-foreground mb-3 italic">
                        Note: {request.order_notes}
                      </p>
                    )}

                    {/* Actions */}
                    <Button 
                      className="w-full gap-2" 
                      onClick={() => openUpdateModal(request)}
                    >
                      <ArrowRight className="w-4 h-4" />
                      Update Status
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Update Modal */}
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">{selectedRequest.project?.project_name}</p>
                <p className="text-sm text-muted-foreground">
                  Current: {orderStatusConfig[selectedRequest.order_status || 'ordered']?.label || 'Ordered'}
                </p>
              </div>

              <div>
                <Label>Order Notes / Tracking Info</Label>
                <Textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Add tracking number, shipping details, etc."
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Invoice / Receipt URL</Label>
                <Input
                  value={invoiceUrl}
                  onChange={(e) => setInvoiceUrl(e.target.value)}
                  placeholder="Drive link to invoice"
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setUpdateOpen(false)}>
              Cancel
            </Button>
            {selectedRequest?.order_status === 'ordered' && (
              <Button 
                className="gap-2 bg-orange-600 hover:bg-orange-700"
                onClick={() => handleUpdateStatus('loading')}
                disabled={isProcessing}
              >
                <Package className="w-4 h-4" />
                Loading
              </Button>
            )}
            {(selectedRequest?.order_status === 'ordered' || selectedRequest?.order_status === 'loading') && (
              <Button 
                className="gap-2 bg-cyan-600 hover:bg-cyan-700"
                onClick={() => handleUpdateStatus('shipped')}
                disabled={isProcessing}
              >
                <Truck className="w-4 h-4" />
                Shipped
              </Button>
            )}
            {selectedRequest?.order_status === 'shipped' && (
              <Button 
                className="gap-2 bg-amber-600 hover:bg-amber-700"
                onClick={() => handleUpdateStatus('unloading')}
                disabled={isProcessing}
              >
                <Truck className="w-4 h-4" />
                Unloading
              </Button>
            )}
            {(selectedRequest?.order_status === 'shipped' || selectedRequest?.order_status === 'unloading') && (
              <Button 
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => openDeliveryModal(selectedRequest)}
                disabled={isProcessing}
              >
                <CheckCircle className="w-4 h-4" />
                Mark Delivered
              </Button>
            )}
            {selectedRequest?.order_status === 'delivered' && selectedRequest?.farm_audit_status === 'pending' && (
              <Button 
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => openDeliveryModal(selectedRequest)}
                disabled={isProcessing}
              >
                <UserCheck className="w-4 h-4" />
                Complete Audit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery & Verify Audit Modal */}
      <Dialog open={deliveryModalOpen} onOpenChange={setDeliveryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-500" />
              Mark Delivered & Verify Audit
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">{selectedRequest.project?.project_name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedRequest.boq_items || []).length} items to add to inventory
                </p>
              </div>

              <div>
                <Label>Audited with Farm Manager (Video Call) <span className="text-destructive">*</span></Label>
                <Input
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                  placeholder="Enter Farm Manager name..."
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the name of the Farm Manager you audited with via video call
                </p>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/20">
                <Checkbox
                  id="audit-confirm"
                  checked={auditConfirmed}
                  onCheckedChange={(checked) => setAuditConfirmed(checked === true)}
                />
                <label
                  htmlFor="audit-confirm"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  All items verified and audit completed
                </label>
              </div>

              <div>
                <Label>Delivery Notes</Label>
                <Textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Any notes about delivery..."
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Invoice / Receipt URL</Label>
                <Input
                  value={invoiceUrl}
                  onChange={(e) => setInvoiceUrl(e.target.value)}
                  placeholder="Drive link to invoice"
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDeliveryModalOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleMarkDelivered}
              disabled={isProcessing || !auditorName.trim() || !auditConfirmed}
            >
              <CheckCircle className="w-4 h-4" />
              Verify & Add to Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
