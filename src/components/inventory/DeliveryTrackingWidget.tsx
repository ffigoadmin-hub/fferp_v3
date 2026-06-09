import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Truck,
  Package,
  Clock,
  CheckCircle2,
  MapPin,
  Calendar,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useMaterialRequests, MaterialRequest } from '@/hooks/useMaterialRequests';
import { useProcurementTimeline } from '@/hooks/useProcurementTimeline';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeliveryTrackingWidgetProps {
  projectId?: string;
}

export function DeliveryTrackingWidget({ projectId }: DeliveryTrackingWidgetProps) {
  const { user } = useAuth();
  const { requests, refetch } = useMaterialRequests(projectId);
  const { addEntry } = useProcurementTimeline();
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [deliveryDetails, setDeliveryDetails] = useState({
    vehicleNumber: '',
    challanNumber: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter requests that are in transit or dispatched (shipped = in transit in the system)
  const inTransitRequests = requests.filter(r => 
    r.order_status === 'shipped' || 
    r.order_status === 'loading'
  );

  // Filter delivered but pending audit
  const pendingAuditRequests = requests.filter(r =>
    r.order_status === 'delivered' &&
    (r.farm_audit_status === 'pending' || !r.farm_audit_status) &&
    !r.added_to_inventory
  );

  const openReceiveModal = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setDeliveryDetails({
      vehicleNumber: '',
      challanNumber: '',
    });
    setReceiveModalOpen(true);
  };

  const handleMarkDelivered = async () => {
    if (!selectedRequest || !user) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('material_requests')
        .update({
          order_status: 'delivered',
          actual_delivery_date: new Date().toISOString().split('T')[0],
          delivery_received_by: user.id,
          delivery_vehicle_number: deliveryDetails.vehicleNumber || null,
          delivery_challan_number: deliveryDetails.challanNumber || null,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Add timeline entry
      await addEntry({
        material_request_id: selectedRequest.id,
        action: 'delivery_received',
        details: {
          vehicle_number: deliveryDetails.vehicleNumber,
          challan_number: deliveryDetails.challanNumber,
          received_by: user.name,
        },
      });

      toast.success('Delivery marked as received - pending audit');
      setReceiveModalOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error marking delivery:', error);
      toast.error('Failed to update delivery status');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'shipped':
      case 'loading':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">
            <Truck className="w-3 h-3" />
            In Transit
          </Badge>
        );
      case 'delivered':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Delivered
          </Badge>
        );
      case 'ordered':
        return (
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1">
            <Package className="w-3 h-3" />
            Ordered
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const allTrackedRequests = [...inTransitRequests, ...pendingAuditRequests];

  if (allTrackedRequests.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="w-5 h-5" />
            Delivery Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No deliveries in transit</p>
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
            Delivery Tracking
            <Badge variant="secondary" className="ml-2">
              {allTrackedRequests.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {/* In Transit Section */}
              {inTransitRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    In Transit ({inTransitRequests.length})
                  </h4>
                  {inTransitRequests.map((request) => {
                    // Check for expected_delivery_date in the request or fallback to urgency
                    const expectedDeliveryDate = (request as any).expected_delivery_date;
                    const expectedDate = expectedDeliveryDate 
                      ? new Date(expectedDeliveryDate)
                      : null;
                    const isOverdue = expectedDate && isAfter(new Date(), expectedDate);

                    return (
                      <div
                        key={request.id}
                        className={cn(
                          "p-4 rounded-lg border",
                          isOverdue && "border-destructive/30 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">
                              {request.project?.project_name || 'Unknown Project'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {(request.boq_items as any[] || []).length} materials
                            </p>
                          </div>
                          {getStatusBadge(request.order_status || '')}
                        </div>

                        {expectedDate && (
                          <div className="flex items-center gap-2 text-sm mb-3">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className={cn(isOverdue && "text-destructive")}>
                              Expected: {format(expectedDate, 'MMM d')}
                              {isOverdue && ' (Overdue)'}
                            </span>
                          </div>
                        )}

                        <Button
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => openReceiveModal(request)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Mark as Received
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pending Audit Section */}
              {pendingAuditRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Pending Audit ({pendingAuditRequests.length})
                  </h4>
                  {pendingAuditRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">
                            {request.project?.project_name || 'Unknown Project'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(request.boq_items as any[] || []).length} materials
                          </p>
                        </div>
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                          Awaiting Audit
                        </Badge>
                      </div>

                      {request.actual_delivery_date && (
                        <p className="text-xs text-muted-foreground">
                          Delivered {formatDistanceToNow(new Date(request.actual_delivery_date), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Receive Modal */}
      <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Delivery as Received</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">{selectedRequest.project?.project_name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedRequest.boq_items as any[] || []).length} materials
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vehicle Number</Label>
                  <Input
                    value={deliveryDetails.vehicleNumber}
                    onChange={(e) => setDeliveryDetails(prev => ({
                      ...prev,
                      vehicleNumber: e.target.value,
                    }))}
                    placeholder="TN 00 XX 0000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Challan/Invoice Number</Label>
                  <Input
                    value={deliveryDetails.challanNumber}
                    onChange={(e) => setDeliveryDetails(prev => ({
                      ...prev,
                      challanNumber: e.target.value,
                    }))}
                    placeholder="INV-00000"
                    className="mt-1"
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                After marking as received, the delivery will be sent to the Farm Manager for quantity verification and audit.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkDelivered} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Received
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
