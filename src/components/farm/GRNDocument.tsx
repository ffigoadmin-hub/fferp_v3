import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Printer, Building2, Calendar, Package, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function openPrintPreview(htmlContent: string) {
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    URL.revokeObjectURL(url);
    return;
  }

  printWindow.addEventListener('load', () => {
    try {
      printWindow.focus();
      printWindow.print();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, { once: true });
}

interface GRNDocumentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialRequest: {
    id: string;
    project?: { project_name: string; project_id: string };
    phase?: { phase_name: string };
    boq_items?: any[];
    selected_quote_id?: string;
    grn_number?: string;
    farm_audited_at?: string;
    farm_audit_notes?: string;
  };
  vendorQuote?: {
    vendor_name: string;
    vendor_contact?: string;
    quoted_total?: number;
  };
  receivedQuantities?: Record<string, number>;
  onGRNGenerated?: () => void;
}

export function GRNDocument({
  open,
  onOpenChange,
  materialRequest,
  vendorQuote,
  receivedQuantities = {},
  onGRNGenerated
}: GRNDocumentProps) {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const boqItems = materialRequest.boq_items || [];
  const grnNumber = materialRequest.grn_number || `GRN-${Date.now().toString().slice(-6)}`;
  const grnDate = materialRequest.farm_audited_at 
    ? format(new Date(materialRequest.farm_audited_at), 'dd MMM yyyy, hh:mm a')
    : format(new Date(), 'dd MMM yyyy, hh:mm a');

  const totalValue = boqItems.reduce((sum, item, idx) => {
    const qty = receivedQuantities[idx.toString()] || item.quantity || 0;
    const unitCost = item.unit_cost || 0;
    return sum + (qty * unitCost);
  }, 0);

  const handleGenerateGRN = async () => {
    if (!user) return;
    setIsGenerating(true);

    try {
      // Update material request with GRN number - use type assertion for columns not in generated types
      const { error } = await supabase
        .from('material_requests')
        .update({
          grn_number: grnNumber,
          grn_generated_at: new Date().toISOString(),
          grn_generated_by: user.id
        } as any)
        .eq('id', materialRequest.id);

      if (error) throw error;

      toast.success('GRN generated successfully');
      onGRNGenerated?.();
    } catch (error) {
      console.error('Error generating GRN:', error);
      toast.error('Failed to generate GRN');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const printContent = printRef.current.outerHTML;
    const htmlContent = `
      <html>
        <head>
          <title>GRN - ${grnNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { color: #666; margin: 5px 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .info-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .info-box h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #f5f5f5; }
            .total-row { font-weight: bold; background: #f9f9f9; }
            .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .signature-box { border-top: 1px solid #000; padding-top: 10px; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `;

    openPrintPreview(htmlContent);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Goods Receipt Note (GRN)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          <div ref={printRef}>
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">GOODS RECEIPT NOTE</h1>
              <p className="text-muted-foreground">Material Delivery Verification Document</p>
            </div>

            {/* GRN Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">GRN Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GRN Number:</span>
                      <span className="font-semibold">{grnNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>{grnDate}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Project</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-semibold">{materialRequest.project?.project_name}</span>
                    </div>
                    {materialRequest.phase?.phase_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phase:</span>
                        <span>{materialRequest.phase.phase_name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Vendor Info */}
            {vendorQuote && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Vendor Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-muted-foreground">Vendor:</span>
                      <span className="ml-2 font-semibold">{vendorQuote.vendor_name}</span>
                    </div>
                    {vendorQuote.vendor_contact && (
                      <div>
                        <span className="text-muted-foreground">Contact:</span>
                        <span className="ml-2">{vendorQuote.vendor_contact}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items Table */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Items Received
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">S.No</th>
                      <th className="p-3 text-left">Material</th>
                      <th className="p-3 text-left">Specification</th>
                      <th className="p-3 text-right">Ordered</th>
                      <th className="p-3 text-right">Received</th>
                      <th className="p-3 text-left">Unit</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boqItems.map((item, idx) => {
                      const orderedQty = item.quantity || 0;
                      const receivedQty = receivedQuantities[idx.toString()] || orderedQty;
                      const unitPrice = item.unit_cost || 0;
                      const lineTotal = receivedQty * unitPrice;

                      return (
                        <tr key={idx} className="border-t">
                          <td className="p-3">{idx + 1}</td>
                          <td className="p-3 font-medium">{item.material_name || item.name}</td>
                          <td className="p-3 text-muted-foreground">{item.specification || '-'}</td>
                          <td className="p-3 text-right">{orderedQty}</td>
                          <td className="p-3 text-right font-medium">{receivedQty}</td>
                          <td className="p-3">{item.unit || 'units'}</td>
                          <td className="p-3 text-right">₹{unitPrice.toLocaleString()}</td>
                          <td className="p-3 text-right font-medium">₹{lineTotal.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/50 font-semibold">
                      <td colSpan={7} className="p-3 text-right">Total Value:</td>
                      <td className="p-3 text-right">₹{totalValue.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes */}
            {materialRequest.farm_audit_notes && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Audit Notes</h3>
                  <p className="text-sm">{materialRequest.farm_audit_notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-8 pt-8 border-t">
              <div className="text-center">
                <div className="h-16 border-b border-dashed mb-2" />
                <p className="text-sm text-muted-foreground">Received By (Site Manager)</p>
              </div>
              <div className="text-center">
                <div className="h-16 border-b border-dashed mb-2" />
                <p className="text-sm text-muted-foreground">Verified By (Farm Manager)</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          {!materialRequest.grn_number && (
            <Button onClick={handleGenerateGRN} disabled={isGenerating} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'Finalize GRN'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
