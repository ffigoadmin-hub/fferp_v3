import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Package, CheckCircle, AlertTriangle, Truck, 
  Building2, FolderKanban, IndianRupee, Calendar
} from 'lucide-react';
import { useMaterialRequests, MaterialRequest } from '@/hooks/useMaterialRequests';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { useProjectInventory } from '@/hooks/useProjectInventory';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function DeliveryAuditWidget() {
  const { user } = useAuth();
  const { requests, updateRequest, refetch } = useMaterialRequests();
  const { quotes } = useVendorQuotes();
  const { addInventoryItem } = useProjectInventory();
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditNotes, setAuditNotes] = useState('');
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter delivered materials pending audit - only show items assigned to current user
  const pendingAudits = requests.filter(r => 
    (r.status === 'approved' || r.approval_status === 'ceo_approved') && 
    r.order_status === 'delivered' && 
    (r.farm_audit_status === 'pending' || !r.farm_audit_status) &&
    !r.added_to_inventory &&
    // Only show if assigned to current user (or show all if user is admin)
    (r.assigned_auditor_id === user?.id || user?.role === 'admin' || user?.role === 'ceo')
  );

  const getSelectedQuote = (request: MaterialRequest) => {
    return quotes.find(q => q.id === request.selected_quote_id);
  };

  const openAuditModal = (request: MaterialRequest) => {
    setSelectedRequest(request);
    // Initialize received quantities with ordered quantities
    const initialQuantities: Record<string, number> = {};
    (request.boq_items || []).forEach((item: any, index: number) => {
      initialQuantities[index.toString()] = item.quantity || 0;
    });
    setReceivedQuantities(initialQuantities);
    setAuditNotes('');
    setAuditOpen(true);
  };

  const handleVerify = async () => {
    if (!selectedRequest || !user) return;
    setIsProcessing(true);

    try {
      // Update material request audit status
      const { error: updateError } = await supabase
        .from('material_requests')
        .update({
          farm_audit_status: 'verified',
          farm_audited_by: user.id,
          farm_audited_at: new Date().toISOString(),
          farm_audit_notes: auditNotes,
          added_to_inventory: true,
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // Add each BOQ item to project inventory
      const selectedQuote = getSelectedQuote(selectedRequest);
      const boqItems = selectedRequest.boq_items || [];

      for (let i = 0; i < boqItems.length; i++) {
        const item = boqItems[i];
        const receivedQty = receivedQuantities[i.toString()] || item.quantity;

        await addInventoryItem({
          project_id: selectedRequest.project_id,
          phase_id: selectedRequest.phase_id || undefined,
          material_request_id: selectedRequest.id,
          material_name: item.material_name || item.name,
          specification: item.specification,
          unit: item.unit || 'units',
          quantity_received: receivedQty,
          unit_price: item.unit_cost || (selectedQuote?.quoted_unit_price || 0),
        });
      }

      // Log to procurement timeline
      await supabase.from('procurement_timeline').insert({
        material_request_id: selectedRequest.id,
        action: 'delivery_verified',
        performed_by: user.id,
        performed_by_name: user.name,
        details: { 
          audit_notes: auditNotes,
          items_added: boqItems.length,
        },
      });

      toast.success('Delivery verified and items added to inventory');
      setAuditOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error verifying delivery:', error);
      toast.error('Failed to verify delivery');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlagDiscrepancy = async () => {
    if (!selectedRequest || !user || !auditNotes.trim()) {
      toast.error('Please provide notes describing the discrepancy');
      return;
    }
    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('material_requests')
        .update({
          farm_audit_status: 'discrepancy',
          farm_audited_by: user.id,
          farm_audited_at: new Date().toISOString(),
          farm_audit_notes: auditNotes,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Log to procurement timeline
      await supabase.from('procurement_timeline').insert({
        material_request_id: selectedRequest.id,
        action: 'delivery_discrepancy',
        performed_by: user.id,
        performed_by_name: user.name,
        details: { audit_notes: auditNotes },
      });

      toast.success('Discrepancy flagged - notified Purchase team');
      setAuditOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error flagging discrepancy:', error);
      toast.error('Failed to flag discrepancy');
    } finally {
      setIsProcessing(false);
    }
  };

  if (pendingAudits.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="w-5 h-5" />
            Delivery Audits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No pending delivery audits</p>
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
            Delivery Audits
            <Badge variant="destructive" className="ml-2">{pendingAudits.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {pendingAudits.map((request) => {
                const selectedQuote = getSelectedQuote(request);

                return (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    {/* Project Info */}
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
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        Pending Audit
                      </Badge>
                    </div>

                    {/* Materials Summary */}
                    <div className="p-3 rounded-lg bg-muted/50 mb-3">
                      <p className="text-sm font-medium mb-2">
                        {(request.boq_items || []).length} Materials Delivered
                      </p>
                      <div className="space-y-1">
                        {(request.boq_items || []).slice(0, 3).map((item: any, idx: number) => (
                          <p key={idx} className="text-xs text-muted-foreground">
                            • {item.material_name || item.name} - {item.quantity} {item.unit}
                          </p>
                        ))}
                        {(request.boq_items || []).length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{(request.boq_items || []).length - 3} more items
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Vendor & Amount */}
                    {selectedQuote && (
                      <div className="flex items-center justify-between mb-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span>{selectedQuote.vendor_name}</span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold">
                          <IndianRupee className="w-4 h-4" />
                          {selectedQuote.quoted_total?.toLocaleString()}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <Button 
                      className="w-full gap-2" 
                      onClick={() => openAuditModal(request)}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Audit Delivery
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Audit Modal */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Delivery</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Request Info */}
              <div className="p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <FolderKanban className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{selectedRequest.project?.project_name}</span>
                </div>
                {selectedRequest.phase?.phase_name && (
                  <p className="text-sm text-muted-foreground">
                    Phase: {selectedRequest.phase.phase_name}
                  </p>
                )}
              </div>

              {/* Items to Verify */}
              <div>
                <Label className="text-sm font-medium">Verify Quantities Received</Label>
                <div className="mt-3 space-y-3">
                  {(selectedRequest.boq_items || []).map((item: any, index: number) => (
                    <div key={index} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">{item.material_name || item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Ordered: {item.quantity} {item.unit}
                        </p>
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          value={receivedQuantities[index.toString()] || 0}
                          onChange={(e) => setReceivedQuantities(prev => ({
                            ...prev,
                            [index.toString()]: parseFloat(e.target.value) || 0
                          }))}
                          className="text-center"
                        />
                        <p className="text-xs text-center text-muted-foreground mt-1">
                          Received
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Notes */}
              <div>
                <Label>Audit Notes</Label>
                <Textarea
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  placeholder="Any observations, quality issues, or discrepancies..."
                  className="mt-2"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setAuditOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              variant="outline"
              className="text-amber-600 border-amber-600/30 hover:bg-amber-600/10 gap-2"
              onClick={handleFlagDiscrepancy}
              disabled={isProcessing}
            >
              <AlertTriangle className="w-4 h-4" />
              Flag Discrepancy
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={handleVerify}
              disabled={isProcessing}
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
