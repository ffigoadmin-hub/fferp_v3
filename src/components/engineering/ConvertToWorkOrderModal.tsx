import { useState } from 'react';
import { FileText, Loader2, Building2, Phone, CreditCard, Calendar, CheckCircle, Download, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VendorWorkRequest, useVendorWorkRequests } from '@/hooks/useVendorWorkRequests';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useWorkOrderPayments } from '@/hooks/useWorkOrderPayments';
import type { WorkOrderData } from './WorkOrderTemplate';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ConvertToWorkOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: VendorWorkRequest;
  onSuccess: () => void;
}

export function ConvertToWorkOrderModal({
  open,
  onOpenChange,
  request,
  onSuccess,
}: ConvertToWorkOrderModalProps) {
  const { createWorkOrder, isSaving } = useWorkOrders();
  const { createPayment } = useWorkOrderPayments();
  const { updateRequest } = useVendorWorkRequests();

  const sourcingDetails = request.aligned_vendor_details || {};
  const isInternalSourcing = sourcingDetails.is_internal === true;

  const [detailedScope, setDetailedScope] = useState(
    sourcingDetails.detailed_scope || request.work_description || ''
  );
  const [advanceAmount, setAdvanceAmount] = useState(
    sourcingDetails.advance_amount !== undefined 
      ? sourcingDetails.advance_amount 
      : ((request.final_price || request.estimated_budget) ? Math.round((request.final_price || request.estimated_budget || 0) * 0.3) : 0)
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    sourcingDetails.terms_and_conditions || ''
  );
  const [startDate, setStartDate] = useState(
    sourcingDetails.start_date || ''
  );
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Bank Details State (Editable if missing)
  const [bankName, setBankName] = useState(request.vendor_bank_name || (isInternalSourcing ? 'HDFC BANK' : ''));
  const [accountNumber, setAccountNumber] = useState(request.vendor_account_number || sourcingDetails.bank_account || (isInternalSourcing ? 'INTERNAL-REGISTRY' : ''));
  const [ifsc, setIfsc] = useState(request.vendor_ifsc || sourcingDetails.ifsc || (isInternalSourcing ? 'IGO0001' : ''));
  const [accountHolder, setAccountHolder] = useState(
    sourcingDetails.beneficiary_name || request.aligned_vendor_name || (isInternalSourcing ? 'IGO GROUP' : '')
  );
  const [gst, setGst] = useState(request.vendor_gst || sourcingDetails.gst_number || (isInternalSourcing ? 'INTERNAL' : ''));
  const [vendorName, setVendorName] = useState(request.aligned_vendor_name || (isInternalSourcing ? 'IGO GROUP' : ''));
  const [vendorContact, setVendorContact] = useState(request.aligned_vendor_contact || (isInternalSourcing ? 'N/A' : ''));
  const [finalPrice, setFinalPrice] = useState(request.final_price || request.estimated_budget || 0);
  const [timelineDays, setTimelineDays] = useState(request.timeline_days || 0);
  const [workDescription, setWorkDescription] = useState(request.work_description || '');

  const handleSubmit = async () => {
    if (!detailedScope) {
      toast.error('Please provide detailed scope');
      return;
    }
    if (!startDate) {
      toast.error('Please set a start date');
      return;
    }

    // Step 1: Create Work Order
    const result = await createWorkOrder({
      projectId: request.project_id,
      workDescription: workDescription,
      detailedScope,
      approvedBudget: finalPrice,
      advanceAmount,
      woDocumentUrl: '',
      termsAndConditions,
      startDate,
      bankAccount: accountNumber,
      ifscCode: ifsc,
      vendorName: vendorName || undefined,
      vendorContact: vendorContact || undefined,
      vendorUpi: request.vendor_upi || undefined,
      vendorGst: gst || undefined,
      vendorWorkRequestId: request.id
    });

    if (result.success && result.data) {
      // Step 2: Create advance payment request if applicable
      if (advanceAmount > 0) {
        await createPayment({
          workOrderId: result.data.id,
          paymentType: 'advance',
          amount: advanceAmount,
          description: `Advance payment for WO - ${workDescription}`,
        });
      }

      // Step 3: Update vendor work request status + bank details
      await updateRequest(request.id, {
        status: 'wo_created',
        linked_wo_id: result.data.id,
        vendor_bank_name: bankName || request.vendor_bank_name,
        vendor_account_number: accountNumber || request.vendor_account_number,
        vendor_ifsc: ifsc || request.vendor_ifsc,
        vendor_gst: gst || request.vendor_gst
      });

      // Step 4: Auto-generate and download PDF
      setIsGeneratingPDF(true);
      try {
        const { downloadWorkOrderPDF } = await import('@/lib/generateWorkOrderPDF');
        const woData: WorkOrderData = {
          woNumber: result.data.wo_number,
          date: format(new Date(), 'dd MMM yyyy'),
          projectName: request.project?.project_name || 'N/A',
          phaseName: request.phase?.phase_name,
          vendorName: request.aligned_vendor_name || 'N/A',
          vendorContact: request.aligned_vendor_contact || 'N/A',
          vendorGST: request.vendor_gst || undefined,
          workDescription: request.work_description,
          detailedScope,
          agreedAmount: request.final_price || 0,
          advanceAmount,
          startDate,
          timelineDays: request.timeline_days || 0,
          termsAndConditions,
          vendorBankName: bankName || undefined,
          vendorAccountNumber: accountNumber || undefined,
          vendorIFSC: ifsc || undefined,
          vendorAccountHolder: accountHolder || undefined,
        };
        await downloadWorkOrderPDF(woData);
        toast.success('Work Order created & PDF downloaded!', {
          description: 'Print the PDF, get vendor signature, then upload the signed copy.',
          duration: 6000,
        });
      } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr);
        toast.success('Work Order created! PDF download failed - you can re-download later.', {
          duration: 5000,
        });
      } finally {
        setIsGeneratingPDF(false);
      }

      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Create Work Order from Vendor Alignment
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto pr-2" style={{ maxHeight: 'calc(80vh - 160px)' }}>
          <div className="space-y-6 pb-4">
            {/* Vendor Details Card */}
            <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-lg shadow-emerald-900/10 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-0 font-bold uppercase tracking-wider text-[10px]">
                    Aligned Vendor
                  </Badge>
                  <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">Verification Passed</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      <Building2 className="w-3.5 h-3.5" />
                      Vendor Identity
                    </div>
                    {isInternalSourcing ? (
                      <Input
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                        className="h-8 text-sm font-bold bg-white/10 border-emerald-500/20"
                      />
                    ) : (
                      <p className="text-sm font-bold text-foreground/90">{request.aligned_vendor_name || 'N/A'}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      <Phone className="w-3.5 h-3.5" />
                      Contact Registry
                    </div>
                    {isInternalSourcing ? (
                      <Input
                        value={vendorContact}
                        onChange={(e) => setVendorContact(e.target.value)}
                        className="h-8 text-sm font-bold bg-white/10 border-emerald-500/20"
                      />
                    ) : (
                      <p className="text-sm font-bold text-foreground/90">{request.aligned_vendor_contact || 'N/A'}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      <CreditCard className="w-3.5 h-3.5" />
                      Fiscal Identity
                    </div>
                    <div className="text-xs font-medium text-foreground/80 leading-relaxed">
                      {request.vendor_account_number || request.vendor_upi ? (
                        <div className="space-y-0.5">
                          {request.vendor_account_number && request.vendor_account_number !== 'N/A' ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="opacity-70 text-[10px] font-bold uppercase">Bank:</span>
                                <span className="tabular-nums font-bold">{accountNumber || 'N/A'}</span>
                                <span className="mx-1 opacity-30">|</span>
                                <span className="tabular-nums font-bold">{ifsc || 'N/A'}</span>
                              </div>
                              {bankName && (
                                <p className="text-[10px] opacity-60 font-semibold">{bankName}</p>
                              )}
                            </>
                          ) : request.vendor_upi && request.vendor_upi !== 'N/A' ? (
                            <div className="flex items-center gap-1.5">
                              <span className="opacity-70 text-[10px] font-bold uppercase">UPI:</span>
                              <span className="tabular-nums font-bold text-primary">{request.vendor_upi}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Internal / No details needed</span>
                          )}
                            <div className="mt-0.5 opacity-60 flex items-center gap-1">
                              <span className="text-[9px] uppercase font-bold">GSTIN:</span>
                              <span className="tabular-nums font-bold">{gst || 'N/A'}</span>
                            </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Financial details pending</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      <Calendar className="w-3.5 h-3.5" />
                      Agreed Timeline
                    </div>
                    {isInternalSourcing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={timelineDays}
                          onChange={(e) => setTimelineDays(Number(e.target.value))}
                          className="h-8 w-20 text-sm font-bold bg-white/10 border-emerald-500/20 tabular-nums"
                        />
                        <span className="text-[10px] font-bold text-muted-foreground/60">Days</span>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-foreground/90 tabular-nums">{request.timeline_days || 0} Standard Days</p>
                    )}
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-emerald-500/10 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/70 mb-1">Contract Valuation</p>
                    <div className="flex items-baseline gap-3">
                      {isInternalSourcing ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-emerald-500/60">₹</span>
                          <Input
                            type="number"
                            value={finalPrice}
                            onChange={(e) => setFinalPrice(Number(e.target.value))}
                            className="h-10 w-40 text-2xl font-black text-emerald-500 bg-white/10 border-emerald-500/20 tabular-nums tracking-tighter"
                          />
                          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">Final Price</span>
                        </div>
                      ) : (
                        <p className="text-3xl font-black text-emerald-500 tabular-nums tracking-tighter">
                          ₹{(request.final_price || 0).toLocaleString('en-IN')}
                        </p>
                      )}
                      {request.estimated_budget && finalPrice > request.estimated_budget && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] font-black uppercase text-rose-500 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          +₹{(finalPrice - request.estimated_budget).toLocaleString()} Over Budget
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                      {request.estimated_budget ? `Budget: ₹${request.estimated_budget.toLocaleString()}` : 'Locked Rate'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Work Order Details */}
            <div className="space-y-4">
              <div>
                <Label>Work Description</Label>
                {isInternalSourcing ? (
                  <Input
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted/50 rounded-lg">
                    {workDescription}
                  </p>
                )}
              </div>

              <div>
                <Label>Detailed Scope of Work *</Label>
                <Textarea
                  value={detailedScope}
                  onChange={(e) => setDetailedScope(e.target.value)}
                  placeholder="Provide detailed scope, deliverables, and specifications..."
                  className="mt-1"
                  rows={4}
                />
              </div>

              <div>
                <Label>Terms & Conditions</Label>
                <Textarea
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  placeholder="Payment terms, warranty, penalties, quality standards..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Advance Amount</Label>
                  <Input
                    type="number"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                    className="mt-1"
                  />
                  <p className="text-[10px] font-bold text-muted-foreground/70 mt-1.5 flex items-center gap-1">
                    <span className="text-primary italic">Suggestion:</span> 30% = <span className="tabular-nums font-bold text-foreground">₹{Math.round((request.final_price || request.estimated_budget || 0) * 0.3).toLocaleString('en-IN')}</span>
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <Label className="text-xs font-bold uppercase tracking-wider text-primary mb-3 block">Settlement Details (Required for Accountant)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px]">Beneficiary Name</Label>
                    <Input
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Name as per bank record"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px]">Account Number</Label>
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Bank account number"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px]">Bank Name</Label>
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px]">IFSC Code</Label>
                    <Input
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value)}
                      placeholder="11 digit IFSC"
                      className="h-9 text-xs uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px]">Vendor GST (Optional)</Label>
                    <Input
                      value={gst}
                      onChange={(e) => setGst(e.target.value)}
                      placeholder="GSTIN number"
                      className="h-9 text-xs uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mr-auto">
            <Download className="w-3 h-3" />
            PDF will auto-download after creation
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isGeneratingPDF}>
            {isSaving || isGeneratingPDF ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isGeneratingPDF ? 'Generating PDF...' : 'Creating...'}
              </>
            ) : (
              'Create Work Order & Download PDF'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
