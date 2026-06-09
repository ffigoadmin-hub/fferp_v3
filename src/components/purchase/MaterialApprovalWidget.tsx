import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Package, CheckCircle, XCircle, ExternalLink, IndianRupee,
  Truck, Building2, User, FolderKanban, Clock, FileText,
  MapPin, Calendar, Banknote, Layers
} from 'lucide-react';
import { useMaterialRequests, MaterialRequest } from '@/hooks/useMaterialRequests';
import { useVendorQuotes, VendorQuote } from '@/hooks/useVendorQuotes';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MaterialApprovalWidgetProps {
  role: 'gm' | 'admin' | 'ceo';
}

export function MaterialApprovalWidget({ role }: MaterialApprovalWidgetProps) {
  const { requests, approveRequest, isLoading } = useMaterialRequests();
  const { quotes } = useVendorQuotes();
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Filter requests based on role's approval queue
  const pendingRequests = requests.filter(r => {
    if (role === 'gm') {
      return r.status === 'quoted' && r.selected_quote_id && !r.gm_approved_by;
    }
    if (role === 'admin') {
      return r.status === 'quoted' && r.gm_approved_by && !r.admin_approved_by;
    }
    if (role === 'ceo') {
      return r.status === 'quoted' && r.admin_approved_by && !r.ceo_approved_by;
    }
    return false;
  });

  const getQuotesForRequest = (requestId: string) => {
    return quotes.filter(q => q.material_request_id === requestId);
  };

  const getSelectedQuote = (request: MaterialRequest) => {
    return quotes.find(q => q.id === request.selected_quote_id);
  };

  const handleApprove = async (request: MaterialRequest) => {
    try {
      await approveRequest(request.id, role);
      toast.success(`Approved - ${role === 'ceo' ? 'Payment request created and sent to Accounts' : 'Forwarded to next approver'}`);
      setDetailsOpen(false);
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectReason.trim()) return;
    // TODO: Implement rejection logic
    toast.success('Request rejected');
    setRejectOpen(false);
    setRejectReason('');
  };

  const openDetails = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setDetailsOpen(true);
  };

  // Approval Chain Component
  const ApprovalChain = ({ request }: { request: MaterialRequest }) => {
    const steps = [
      {
        role: 'GM',
        approved: !!request.gm_approved_by,
        date: request.gm_approved_at,
        current: role === 'gm' && !request.gm_approved_by
      },
      {
        role: 'Admin',
        approved: !!request.admin_approved_by,
        date: request.admin_approved_at,
        current: role === 'admin' && !request.admin_approved_by
      },
      {
        role: 'CEO',
        approved: !!request.ceo_approved_by,
        date: request.ceo_approved_at,
        current: role === 'ceo' && !request.ceo_approved_by
      },
      { role: 'Payment', approved: !!request.linked_payment_id, date: null, current: false },
      { role: 'Delivery', approved: (request as any).order_status === 'delivered', date: null, current: false },
      { role: 'Inventory', approved: (request as any).added_to_inventory, date: null, current: false },
    ];

    return (
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((step, idx) => (
          <div key={step.role} className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              step.approved && "bg-green-500/20 text-green-400",
              step.current && "bg-primary/20 text-primary ring-2 ring-primary/50",
              !step.approved && !step.current && "bg-muted text-muted-foreground"
            )}>
              {step.approved ? (
                <CheckCircle className="w-3 h-3" />
              ) : step.current ? (
                <Clock className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3 opacity-50" />
              )}
              {step.role}
            </div>
            {idx < steps.length - 1 && (
              <div className="w-4 h-px bg-border" />
            )}
          </div>
        ))}
      </div>
    );
  };

  if (pendingRequests.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5" />
            Material Purchase Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No pending material approvals</p>
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
            <Package className="w-5 h-5" />
            Material Purchase Approvals
            <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {pendingRequests.map((request) => {
                const selectedQuote = getSelectedQuote(request);
                const allQuotes = getQuotesForRequest(request.id);

                return (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    {/* Project Header with Full Details */}
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-5 h-5 text-primary" />
                          <span className="font-bold text-lg">
                            {request.project?.project_name || 'Unknown Project'}
                          </span>
                        </div>
                        <Badge variant="outline" className="font-mono text-xs">
                          {request.project?.project_id || 'N/A'}
                        </Badge>
                      </div>

                      {/* Phase Info */}
                      {request.phase?.phase_name && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Layers className="w-4 h-4" />
                          <span>Phase: <strong>{request.phase.phase_name}</strong></span>
                        </div>
                      )}

                      {/* Requester Info */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>{request.requester?.name || 'Unknown'}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {request.requester_department || request.requester?.department || 'N/A'}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {request.created_at && format(new Date(request.created_at), 'dd MMM yyyy, HH:mm')}
                        </div>
                      </div>
                    </div>

                    {/* Urgency Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className={cn(
                        request.urgency === 'critical' && 'bg-red-500/20 text-red-400 border-red-500/30',
                        request.urgency === 'high' && 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                        request.urgency === 'normal' && 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      )}>
                        {request.urgency} priority
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {allQuotes.length} quotes collected
                      </span>
                    </div>

                    {/* BOQ Items Summary */}
                    <div className="p-3 rounded-lg bg-muted/30 mb-3">
                      <p className="text-xs text-muted-foreground uppercase mb-2">Materials Requested</p>
                      <div className="space-y-1">
                        {(request.boq_items || []).slice(0, 4).map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.material_name || item.name}</span>
                            <span className="text-muted-foreground">
                              {item.quantity} {item.unit} {item.unit_cost ? `@ ₹${item.unit_cost}` : ''}
                            </span>
                          </div>
                        ))}
                        {(request.boq_items || []).length > 4 && (
                          <p className="text-xs text-muted-foreground">
                            +{(request.boq_items || []).length - 4} more items
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Selected Quote Summary */}
                    {selectedQuote && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-medium text-green-500">SELECTED QUOTE</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{selectedQuote.vendor_name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold flex items-center">
                              <IndianRupee className="w-5 h-5" />
                              {selectedQuote.quoted_total?.toLocaleString()}
                            </span>
                            {selectedQuote.delivery_days && (
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                {selectedQuote.delivery_days}d
                              </span>
                            )}
                          </div>
                        </div>
                        {selectedQuote.quote_drive_link && (
                          <a
                            href={selectedQuote.quote_drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 mt-2 hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            View Quote Document
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Approval Chain */}
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2">Approval Progress</p>
                      <ApprovalChain request={request} />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDetails(request)}>
                        View Full Details
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 gap-1 flex-1"
                        onClick={() => handleApprove(request)}
                        disabled={isLoading}
                      >
                        <CheckCircle className="w-4 h-4" />
                        {role === 'ceo' ? 'Approve & Create Payment' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => { setSelectedRequest(request); setRejectOpen(true); }}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Material Request Details</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Full Project Context */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Project</Label>
                    <p className="font-bold text-lg">{selectedRequest.project?.project_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{selectedRequest.project?.project_id}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phase</Label>
                    <p className="font-medium">{selectedRequest.phase?.phase_name || 'No specific phase'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Requested By</Label>
                    <p className="font-medium">{selectedRequest.requester?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedRequest.requester_department}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Request Date</Label>
                    <p className="font-medium">
                      {selectedRequest.created_at && format(new Date(selectedRequest.created_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>

              {/* All BOQ Items with Pricing */}
              <div>
                <h3 className="font-semibold mb-3">Materials Requested ({(selectedRequest.boq_items || []).length} items)</h3>
                {(() => {
                  const selectedQuote = getSelectedQuote(selectedRequest);
                  const boqItems = selectedRequest.boq_items || [];
                  const quotedItems = (selectedQuote as any)?.quoted_items || [];

                  return (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3">Material</th>
                            <th className="text-left p-3">Specification</th>
                            <th className="text-right p-3">Qty</th>
                            <th className="text-right p-3">Unit</th>
                            <th className="text-right p-3">Unit Price</th>
                            <th className="text-right p-3">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {boqItems.map((item: any, idx: number) => {
                            const qty = item.quantity || 0;
                            // Find matching quoted item by material name
                            const quotedItem = quotedItems.find((qi: any) =>
                              qi.material_name === item.material_name || qi.material_name === item.name
                            );
                            const unitPrice = quotedItem?.unit_price || item.unit_cost || 0;
                            const lineTotal = quotedItem?.total || (qty * unitPrice);
                            const hasQuotedPrice = !!quotedItem;

                            return (
                              <tr key={idx} className="border-t">
                                <td className="p-3 font-medium">{item.material_name || item.name || '-'}</td>
                                <td className="p-3 text-muted-foreground">{item.specification || '-'}</td>
                                <td className="p-3 text-right">{qty}</td>
                                <td className="p-3 text-right">{item.unit || '-'}</td>
                                <td className="p-3 text-right">
                                  {unitPrice > 0 ? (
                                    <span className={hasQuotedPrice ? "text-green-400 font-medium" : ""}>
                                      ₹{unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  {lineTotal > 0 ? (
                                    <span className={hasQuotedPrice ? "text-green-400" : ""}>
                                      ₹{lineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {selectedQuote && (
                          <tfoot className="bg-green-500/10">
                            <tr className="border-t">
                              <td colSpan={5} className="p-3 text-right font-semibold text-green-400">
                                <span className="flex items-center justify-end gap-2">
                                  <CheckCircle className="w-4 h-4" />
                                  Quoted Total ({selectedQuote.vendor_name}):
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold text-lg text-green-400">
                                ₹{selectedQuote.quoted_total?.toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* All Quotes Comparison */}
              <div>
                <h3 className="font-semibold mb-3">Quote Comparison ({getQuotesForRequest(selectedRequest.id).length} quotes)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {getQuotesForRequest(selectedRequest.id).map((quote) => {
                    const isSelected = quote.id === selectedRequest.selected_quote_id;
                    return (
                      <div
                        key={quote.id}
                        className={cn(
                          "p-4 rounded-lg border",
                          isSelected && "ring-2 ring-green-500 border-green-500 bg-green-500/5"
                        )}
                      >
                        {isSelected && (
                          <Badge className="mb-2 bg-green-500/20 text-green-500 border-green-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" /> Selected
                          </Badge>
                        )}
                        <p className="font-semibold">{quote.vendor_name}</p>
                        <p className="text-2xl font-bold my-2">₹{quote.quoted_total?.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {quote.delivery_days ? `${quote.delivery_days} days delivery` : 'Delivery TBD'}
                        </p>
                        {quote.quote_drive_link && (
                          <a
                            href={quote.quote_drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 mt-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Quote
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Full Approval Chain Status */}
              <div className="p-4 rounded-lg bg-muted/30">
                <h3 className="font-semibold mb-4">Complete Approval Chain</h3>
                <div className="space-y-3">
                  {[
                    {
                      role: 'GM Review',
                      approved: !!selectedRequest.gm_approved_by,
                      date: selectedRequest.gm_approved_at,
                      icon: User
                    },
                    {
                      role: 'Admin Review',
                      approved: !!selectedRequest.admin_approved_by,
                      date: selectedRequest.admin_approved_at,
                      icon: User
                    },
                    {
                      role: 'CEO Approval',
                      approved: !!selectedRequest.ceo_approved_by,
                      date: selectedRequest.ceo_approved_at,
                      icon: User
                    },
                    {
                      role: 'Payment Created',
                      approved: !!selectedRequest.linked_payment_id,
                      date: null,
                      icon: Banknote
                    },
                    {
                      role: 'Order Delivered',
                      approved: (selectedRequest as any).order_status === 'delivered',
                      date: (selectedRequest as any).actual_delivery_date,
                      icon: Truck
                    },
                    {
                      role: 'Added to Inventory',
                      approved: (selectedRequest as any).added_to_inventory,
                      date: null,
                      icon: Package
                    },
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        step.approved ? "bg-green-500/20" : "bg-muted"
                      )}>
                        <step.icon className={cn("w-4 h-4", step.approved ? "text-green-500" : "text-muted-foreground")} />
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-sm font-medium", !step.approved && "text-muted-foreground")}>
                          {step.role}
                        </p>
                        {step.date && (
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(step.date), 'dd MMM yyyy, hh:mm a')}
                          </p>
                        )}
                      </div>
                      {step.approved && <CheckCircle className="w-5 h-5 text-green-500" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
            {selectedRequest && (
              <Button
                className="bg-green-600 hover:bg-green-700 gap-2"
                onClick={() => handleApprove(selectedRequest)}
                disabled={isLoading}
              >
                <CheckCircle className="w-4 h-4" />
                {role === 'ceo' ? 'Approve & Create Payment' : 'Approve Request'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Reason for Rejection *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please provide a reason..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
