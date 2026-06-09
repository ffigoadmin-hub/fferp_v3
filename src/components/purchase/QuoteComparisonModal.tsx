import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, Building2, Calendar, IndianRupee, ExternalLink, Truck, FileText, Banknote, Scale, AlertTriangle } from 'lucide-react';
import { VendorQuote } from '@/hooks/useVendorQuotes';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface QuoteComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotes: VendorQuote[];
  onSelectQuote: (quoteId: string) => Promise<void>;
  isLoading?: boolean;
  isReadOnly?: boolean;
}

export function QuoteComparisonModal({
  open,
  onOpenChange,
  quotes,
  onSelectQuote,
  isLoading,
  isReadOnly,
}: QuoteComparisonModalProps) {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const handleSelect = async () => {
    if (!selectedQuoteId) return;
    await onSelectQuote(selectedQuoteId);
    onOpenChange(false);
  };

  const lowestPrice = Math.min(...quotes.map(q => q.quoted_total || Infinity));
  const fastestDelivery = Math.min(...quotes.map(q => q.delivery_days || 999));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              Compare Quotes
            </DialogTitle>
            <Badge variant="outline">{quotes.length} Quotes</Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 space-y-4">
            {quotes.length < 3 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-600">Minimum 3 quotes required</p>
                  <p className="text-xs text-amber-600/80">Currently have {quotes.length}/3 quotes for comparison</p>
                </div>
              </div>
            )}

            {quotes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Scale className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No quotes available</p>
                <p className="text-sm">Add quotes to compare vendors</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quotes.map((quote) => {
                  const isLowest = (quote.quoted_total || 0) === lowestPrice && lowestPrice !== Infinity;
                  const isFastest = quote.delivery_days === fastestDelivery && fastestDelivery !== 999;
                  const isSelected = selectedQuoteId === quote.id;

                  return (
                    <Card
                      key={quote.id}
                      className={cn(
                        "relative cursor-pointer transition-all duration-300 hover:shadow-xl",
                        isSelected && !isReadOnly
                          ? "ring-2 ring-primary border-primary shadow-lg shadow-primary/10"
                          : "hover:border-primary/30 bg-black/40",
                        quote.is_selected && "ring-2 ring-green-500/50 border-green-500/50 shadow-lg shadow-green-500/10 bg-green-500/[0.02]",
                        isReadOnly && "cursor-default"
                      )}
                      onClick={() => !isReadOnly && setSelectedQuoteId(quote.id)}
                    >
                      <CardContent className="p-4 space-y-4">
                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                          {isLowest && (
                            <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                              Lowest
                            </Badge>
                          )}
                          {isFastest && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                              Fastest
                            </Badge>
                          )}
                          {quote.is_selected && (
                            <Badge className="bg-green-500 text-white border-0 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 shadow-[0_0_10px_rgba(34,197,94,0.4)]">
                              {isReadOnly ? 'Selected for Order' : 'Selected'}
                            </Badge>
                          )}
                        </div>

                        {/* Vendor Info */}
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{quote.vendor_name}</p>
                            {quote.vendor_contact && (
                              <p className="text-sm text-muted-foreground truncate">{quote.vendor_contact}</p>
                            )}
                          </div>
                        </div>

                        {/* Price */}
                        <div className={cn("p-3 rounded-xl", isLowest ? "bg-green-500/10" : "bg-muted/50")}>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <IndianRupee className="w-3 h-3" />
                            Total Price
                          </div>
                          <p className={cn("text-xl font-bold", isLowest && "text-green-500")}>
                            ₹{(quote.quoted_total || 0).toLocaleString()}
                          </p>
                          {quote.quoted_unit_price > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Unit: ₹{quote.quoted_unit_price.toLocaleString()}
                            </p>
                          )}
                        </div>

                        {/* Delivery */}
                        <div className={cn(
                          "flex items-center gap-2 p-2.5 rounded-lg text-sm",
                          isFastest ? "bg-blue-500/10" : "bg-muted/30"
                        )}>
                          <Truck className={cn("w-4 h-4", isFastest ? "text-blue-500" : "text-muted-foreground")} />
                          <span className={cn(isFastest && "text-blue-500 font-medium")}>
                            {quote.delivery_days ? `${quote.delivery_days} days` : 'TBD'}
                          </span>
                        </div>

                        {/* Quote Document */}
                        {quote.quote_drive_link && (
                          <a
                            href={quote.quote_drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-sm"
                          >
                            <FileText className="w-4 h-4 text-primary" />
                            <span className="text-primary font-medium flex-1">View Quote</span>
                            <ExternalLink className="w-3 h-3 text-primary" />
                          </a>
                        )}

                        {/* Bank Details */}
                        {(quote.vendor_bank_name || quote.vendor_account_number) && (
                          <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium mb-1.5">
                              <Banknote className="w-3.5 h-3.5" />
                              Bank Details
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {quote.vendor_bank_name && <p>Bank: {quote.vendor_bank_name}</p>}
                              {quote.vendor_account_number && <p>A/C: {quote.vendor_account_number}</p>}
                              {quote.vendor_ifsc && <p>IFSC: {quote.vendor_ifsc}</p>}
                              {quote.vendor_gst && <p>GST: {quote.vendor_gst}</p>}
                            </div>
                          </div>
                        )}

                        {/* Validity */}
                        {quote.validity_date && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Valid until: {format(new Date(quote.validity_date), 'dd MMM yyyy')}
                          </div>
                        )}

                        {/* Notes */}
                        {quote.notes && (
                          <p className="text-xs text-muted-foreground border-t pt-2 line-clamp-2">{quote.notes}</p>
                        )}

                        {/* Selection Indicator */}
                        {(isSelected || (isReadOnly && quote.is_selected)) && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle className={cn("w-6 h-6", quote.is_selected ? "text-green-500" : "text-primary")} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 p-4 border-t bg-muted/20 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:mr-auto">
            Cancel
          </Button>
          {isReadOnly ? (
            <Button
              className="w-full sm:w-auto ml-auto px-8 font-black uppercase tracking-widest text-xs"
              onClick={() => onOpenChange(false)}
            >
              Close Comparison
            </Button>
          ) : (
            <Button
              onClick={handleSelect}
              disabled={!selectedQuoteId || isLoading || quotes.length < 3}
              className="px-6 gap-2 font-black uppercase tracking-widest text-xs"
            >
              <CheckCircle className="w-4 h-4" />
              {isLoading ? 'Selecting...' : 'Select & Submit for Approval'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
