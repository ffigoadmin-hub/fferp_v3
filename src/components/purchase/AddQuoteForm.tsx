import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Building2, IndianRupee, Banknote, FileText, Package, Calculator } from 'lucide-react';

interface BOQItem {
  material_name: string;
  specification?: string;
  quantity?: number;
  quantity_needed?: number;
  unit?: string;
  estimated_unit_cost?: number;
}

interface AddQuoteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    vendor_name: string;
    vendor_contact: string;
    unit_price: number;
    total_price: number;
    delivery_days: number;
    validity_date: string;
    notes: string;
    quote_drive_link: string;
    vendor_bank_name: string;
    vendor_account_number: string;
    vendor_ifsc: string;
    vendor_gst: string;
    item_prices?: { material_name: string; unit_price: number; quantity: number; total: number }[];
  }) => Promise<void>;
  isLoading?: boolean;
  boqItems?: BOQItem[];
}

export function AddQuoteForm({ open, onOpenChange, onSubmit, isLoading, boqItems = [] }: AddQuoteFormProps) {
  const [form, setForm] = useState({
    vendor_name: '',
    vendor_contact: '',
    delivery_days: '',
    validity_date: '',
    notes: '',
    quote_drive_link: '',
    vendor_bank_name: '',
    vendor_account_number: '',
    vendor_ifsc: '',
    vendor_gst: '',
  });

  // Track unit prices for each BOQ item
  const [itemPrices, setItemPrices] = useState<Record<number, string>>({});

  // Reset item prices when boqItems change or modal opens
  useEffect(() => {
    if (open && boqItems.length > 0) {
      const initialPrices: Record<number, string> = {};
      boqItems.forEach((item, index) => {
        initialPrices[index] = item.estimated_unit_cost?.toString() || '';
      });
      setItemPrices(initialPrices);
    }
  }, [open, boqItems]);

  // Calculate totals for each item and grand total
  const itemTotals = useMemo(() => {
    return boqItems.map((item, index) => {
      const quantity = item.quantity || item.quantity_needed || 0;
      const unitPrice = parseFloat(itemPrices[index]) || 0;
      return {
        material_name: item.material_name,
        quantity,
        unit: item.unit || 'units',
        unit_price: unitPrice,
        total: quantity * unitPrice,
      };
    });
  }, [boqItems, itemPrices]);

  const grandTotal = useMemo(() => {
    return itemTotals.reduce((sum, item) => sum + item.total, 0);
  }, [itemTotals]);

  const averageUnitPrice = useMemo(() => {
    const filledPrices = Object.values(itemPrices).filter(p => parseFloat(p) > 0);
    if (filledPrices.length === 0) return 0;
    return filledPrices.reduce((sum, p) => sum + parseFloat(p), 0) / filledPrices.length;
  }, [itemPrices]);

  const isValidDriveLink = (link: string) => {
    if (!link) return true;
    return link.includes('drive.google.com') || link.includes('docs.google.com');
  };

  const handleSubmit = async () => {
    if (!form.vendor_name || grandTotal <= 0) return;
    if (form.quote_drive_link && !isValidDriveLink(form.quote_drive_link)) return;

    await onSubmit({
      vendor_name: form.vendor_name,
      vendor_contact: form.vendor_contact,
      unit_price: averageUnitPrice,
      total_price: grandTotal,
      delivery_days: parseInt(form.delivery_days) || 0,
      validity_date: form.validity_date,
      notes: form.notes,
      quote_drive_link: form.quote_drive_link,
      vendor_bank_name: form.vendor_bank_name,
      vendor_account_number: form.vendor_account_number,
      vendor_ifsc: form.vendor_ifsc,
      vendor_gst: form.vendor_gst,
      item_prices: itemTotals.filter(item => item.unit_price > 0),
    });

    // Reset form
    setForm({
      vendor_name: '',
      vendor_contact: '',
      delivery_days: '',
      validity_date: '',
      notes: '',
      quote_drive_link: '',
      vendor_bank_name: '',
      vendor_account_number: '',
      vendor_ifsc: '',
      vendor_gst: '',
    });
    setItemPrices({});
    onOpenChange(false);
  };

  const isValid = form.vendor_name && grandTotal > 0 && form.quote_drive_link && isValidDriveLink(form.quote_drive_link);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Add Vendor Quote
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Vendor Info Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Vendor Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor Name <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.vendor_name}
                    onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                    placeholder="Enter vendor name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Person</Label>
                  <Input
                    value={form.vendor_contact}
                    onChange={(e) => setForm({ ...form, vendor_contact: e.target.value })}
                    placeholder="Contact person name"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Product List with Unit Prices */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4" />
                Product Pricing
                {boqItems.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">
                    {boqItems.length} items
                  </span>
                )}
              </h3>

              {boqItems.length > 0 ? (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 text-xs font-medium text-muted-foreground uppercase">
                    <div className="col-span-5">Material</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-right">Unit Price</div>
                    <div className="col-span-3 text-right">Total</div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {boqItems.map((item, index) => {
                      const quantity = item.quantity || item.quantity_needed || 0;
                      const itemTotal = itemTotals[index]?.total || 0;

                      return (
                        <div
                          key={index}
                          className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-colors"
                        >
                          <div className="col-span-5 min-w-0">
                            <p className="font-medium text-sm truncate">{item.material_name || 'Unnamed'}</p>
                            {item.specification && (
                              <p className="text-xs text-muted-foreground truncate">{item.specification}</p>
                            )}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-sm font-medium">{quantity}</span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unit || 'units'}</span>
                          </div>
                          <div className="col-span-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                              <Input
                                type="number"
                                value={itemPrices[index] || ''}
                                onChange={(e) => setItemPrices(prev => ({
                                  ...prev,
                                  [index]: e.target.value
                                }))}
                                placeholder="0"
                                className="h-8 text-sm pl-5 text-right"
                              />
                            </div>
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="font-semibold text-sm">
                              ₹{itemTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Grand Total */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-primary" />
                      <span className="font-semibold">Grand Total</span>
                    </div>
                    <span className="text-xl font-bold text-primary">
                      ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No products in this request</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Quote Details Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <IndianRupee className="w-4 h-4" />
                Quote Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delivery Days</Label>
                  <Input
                    type="number"
                    value={form.delivery_days}
                    onChange={(e) => setForm({ ...form, delivery_days: e.target.value })}
                    placeholder="Days to deliver"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quote Valid Until</Label>
                  <Input
                    type="date"
                    value={form.validity_date}
                    onChange={(e) => setForm({ ...form, validity_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Google Drive Link */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Quote Document <span className="text-destructive">*</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </Label>
                <Input
                  value={form.quote_drive_link}
                  onChange={(e) => setForm({ ...form, quote_drive_link: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className={form.quote_drive_link && !isValidDriveLink(form.quote_drive_link) ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {form.quote_drive_link && !isValidDriveLink(form.quote_drive_link) && (
                  <p className="text-xs text-destructive">Please enter a valid Google Drive link</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Bank Details Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Bank Details (Optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    value={form.vendor_bank_name}
                    onChange={(e) => setForm({ ...form, vendor_bank_name: e.target.value })}
                    placeholder="Bank name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={form.vendor_account_number}
                    onChange={(e) => setForm({ ...form, vendor_account_number: e.target.value })}
                    placeholder="Account number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input
                    value={form.vendor_ifsc}
                    onChange={(e) => setForm({ ...form, vendor_ifsc: e.target.value.toUpperCase() })}
                    placeholder="IFSC code"
                  />
                </div>
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input
                    value={form.vendor_gst}
                    onChange={(e) => setForm({ ...form, vendor_gst: e.target.value.toUpperCase() })}
                    placeholder="GST number"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional notes about this quote..."
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-t bg-muted/20 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:mr-auto">
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            {grandTotal > 0 && (
              <span className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">₹{grandTotal.toLocaleString('en-IN')}</span>
              </span>
            )}
            <Button onClick={handleSubmit} disabled={isLoading || !isValid}>
              {isLoading ? 'Adding...' : 'Add Quote'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
