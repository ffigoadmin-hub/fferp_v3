import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, FileSpreadsheet, XCircle, CheckCircle2, 
  Info, AlertTriangle, Loader2, Banknote, FileText 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { MatchResult } from '@/lib/kotakBankExport';

interface ReconciliationTabProps {
  regularPaidPayments: any[];
  user: any;
  refetch: () => void;
  handleGenerateVoucher: (payment: any) => void;
}

export function ReconciliationTab({ 
  regularPaidPayments, 
  user,
  refetch,
  handleGenerateVoucher 
}: ReconciliationTabProps) {
  // Statement upload & matching
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [manualUTRs, setManualUTRs] = useState<Record<string, string>>({});
  const [isMatching, setIsMatching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualIndividualUTRs, setManualIndividualUTRs] = useState<Record<string, string>>({});
  const [isVerifyingUTR, setIsVerifyingUTR] = useState<string | null>(null);
  const [isVerifyingUTRResult, setIsVerifyingUTRResult] = useState<string | null>(null);

  const handleStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatementFile(file);
    setIsMatching(true);

    try {
      const { parseStatementFile, matchPaymentsWithStatement } = await import('@/lib/kotakBankExport');
      const statementRows = await parseStatementFile(file);

      // Get regular payments that need matching (paid but no UTR, NOT petty cash)
      const paymentsToMatch = regularPaidPayments.filter(p => !p.utr_number);

      const results = matchPaymentsWithStatement(
        paymentsToMatch.map(p => ({
          id: p.id,
          amount: Number(p.amount),
          beneficiary_name: p.beneficiary_name,
          vendor_name: p.vendor_name,
          vendor_account_number: p.vendor_account_number,
          vendor_ifsc_code: p.vendor_ifsc_code,
          date: p.paid_at || p.created_at
        })),
        statementRows
      );

      // Sort results by confidence (highest first)
      const sortedResults = [...results].sort((a, b) => b.confidence - a.confidence);

      setMatchResults(sortedResults);
      
      // Initialize manual UTRs with any match found (even partial/low confidence)
      const initialManual: Record<string, string> = {};
      results.forEach(r => {
        if (r.matchedUTR) {
          initialManual[r.paymentId] = r.matchedUTR;
        }
      });
      
      const matchedCount = results.filter(r => r.status === 'matched').length;
      const partialCount = results.filter(r => r.status === 'partial').length;

      if (matchedCount > 0 || partialCount > 0) {
        toast.success(`Processed ${statementRows.length} rows: found ${matchedCount} matches and ${partialCount} potential partials.`);
        setManualUTRs(initialManual);
        // FIX: Ensure manual fields in individual list are also pre-filled
        setManualIndividualUTRs(initialManual); 
      } else {
        toast.info(`Processed ${statementRows.length} rows, but no matches were found.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse statement file');
    } finally {
      setIsMatching(false);
    }
  };

  const applyMatchedUTRs = async () => {
    if (!user) return;

    const highConfidence = matchResults.filter(r => r.status === 'matched' && r.confidence > 50 && r.matchedUTR);

    let autoAppliedCount = 0;

    for (const match of highConfidence) {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          utr_number: match.matchedUTR,
          utr_verified_at: new Date().toISOString(),
          utr_verified_by: user.id,
          utr_match_confidence: match.confidence,
          utr_requires_manual_review: false
        } as any)
        .eq('id', match.paymentId);

      if (!error) autoAppliedCount++;
    }

    for (const result of matchResults) {
      const manualUtr = manualUTRs[result.paymentId];
      if (!manualUtr) continue;

      const isHighConfidence = result.status === 'matched' && result.confidence > 50;

      const { error } = await supabase
        .from('payment_requests')
        .update({
          utr_number: manualUtr,
          utr_verified_at: isHighConfidence ? new Date().toISOString() : null,
          utr_verified_by: isHighConfidence ? user.id : null,
          utr_match_confidence: result.confidence,
          utr_requires_manual_review: !isHighConfidence
        } as any)
        .eq('id', result.paymentId);

      if (!error && !isHighConfidence) {
        autoAppliedCount++;
      }
    }

    if (autoAppliedCount > 0) {
      toast.success(`Saved ${autoAppliedCount} UTR matches`);
      setMatchResults([]);
      setStatementFile(null);
      setManualUTRs({});
      refetch();
    }
  };

  const handleMatchResultVerification = async (paymentId: string, utrStr: string, confidence: number = 100) => {
    if (!utrStr) {
      toast.error('Please enter UTR number');
      return;
    }
    setIsVerifyingUTRResult(paymentId);
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          utr_number: utrStr,
          utr_verified_at: new Date().toISOString(),
          utr_verified_by: user?.id,
          utr_match_confidence: confidence,
          utr_requires_manual_review: false
        } as any)
        .eq('id', paymentId);

      if (error) throw error;
      toast.success('UTR applied and verified');
      setMatchResults(prev => prev.filter(r => r.paymentId !== paymentId));
      refetch();
    } catch (err) {
      toast.error('Failed to apply UTR');
    } finally {
      setIsVerifyingUTRResult(null);
    }
  };

  const handleIndividualUTRVerification = async (paymentId: string) => {
    const utrStr = manualIndividualUTRs[paymentId];
    if (!utrStr) {
      toast.error('Please enter UTR number');
      return;
    }

    setIsVerifyingUTR(paymentId);
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          utr_number: utrStr,
          utr_verified_at: new Date().toISOString(),
          utr_verified_by: user?.id,
          utr_match_confidence: 100, // Manual entry = 100% confidence
          utr_requires_manual_review: false
        } as any)
        .eq('id', paymentId);

      if (error) throw error;
      toast.success('UTR verified successfully');
      setManualIndividualUTRs(prev => { const n = { ...prev }; delete n[paymentId]; return n; });
      refetch();
    } catch (err) {
      toast.error('Failed to verify UTR');
    } finally {
      setIsVerifyingUTR(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="authority-card">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2 mb-2">
                <Upload className="w-5 h-5 text-primary" /> Bank Statement Upload
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload bank statement (PDF/CSV/Excel) to automatically match UTR numbers with payments.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={handleStatementUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isMatching}
              >
                <Upload className="w-4 h-4 mr-2" />
                {isMatching ? 'Processing...' : 'Upload Statement'}
              </Button>
            </div>
          </div>
          {statementFile && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                {statementFile.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatementFile(null);
                  setMatchResults([]);
                }}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {matchResults.length > 0 && (
        <Card className="authority-card border-status-live/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="font-bold text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-status-live" />
                  Match Results
                </h4>
                <p className="text-sm text-muted-foreground">
                  {matchResults.filter(r => r.status === 'matched').length} matched, 
                  {matchResults.filter(r => r.status === 'partial').length} partial, 
                  {matchResults.filter(r => r.status === 'unmatched').length} unmatched
                </p>
              </div>
              <Button
                className="bg-status-live hover:bg-status-live/90"
                onClick={applyMatchedUTRs}
                disabled={matchResults.filter(r => r.status === 'matched').length === 0}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Apply {matchResults.filter(r => r.status === 'matched').length} Matches
              </Button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {matchResults.map((result, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col gap-3 p-4 rounded-lg border",
                    result.status === 'matched' ? "bg-status-live/5 border-status-live/20" :
                      result.status === 'partial' ? "bg-status-pending/5 border-status-pending/20" :
                        "bg-destructive/5 border-destructive/20"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-base">{result.vendorName}</p>
                        <Badge variant="outline" className="text-[10px] h-4">
                          ₹{result.amount.toLocaleString()}
                        </Badge>
                      </div>
                      {result.matchReason && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Info className="w-3 h-3" /> {result.matchReason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {result.status === 'matched' && (
                        <Badge className="bg-status-live text-white border-none">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> AUTO-MATCH
                        </Badge>
                      )}
                      {result.status === 'partial' && (
                        <Badge className="bg-amber-500 text-white border-none">
                          <AlertTriangle className="w-3 h-3 mr-1" /> REVIEW REQUIRED
                        </Badge>
                      )}
                      {result.status === 'unmatched' && (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" /> NO MATCH
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-background/50 p-2 rounded border border-dashed">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">UTR Number</label>
                      <Input
                        value={manualUTRs[result.paymentId] || ''}
                        onChange={(e) => setManualUTRs(prev => ({ ...prev, [result.paymentId]: e.target.value.toUpperCase() }))}
                        placeholder="Enter UTR manually..."
                        className="h-9 font-mono text-sm bg-background"
                      />
                    </div>
                    <div className="flex flex-col items-center pt-5">
                      <div className={cn(
                        "text-xs font-bold px-2 py-1 rounded mb-2",
                        result.confidence >= 90 ? "text-status-live bg-status-live/10" :
                          result.confidence >= 50 ? "text-amber-500 bg-amber-500/10" :
                            "text-destructive bg-destructive/10"
                      )}>
                        {result.confidence}% Match
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-[10px] font-bold bg-status-live hover:bg-status-live/90 px-3"
                        onClick={() => handleMatchResultVerification(
                          result.paymentId,
                          manualUTRs[result.paymentId] || '',
                          result.confidence
                        )}
                        disabled={!manualUTRs[result.paymentId] || isVerifyingUTRResult === result.paymentId}
                      >
                        {isVerifyingUTRResult === result.paymentId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'APPLY'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="authority-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-lg flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                Bank Payments for UTR Matching
              </h4>
              <p className="text-sm text-muted-foreground">
                {regularPaidPayments.filter(p => p.utr_number).length} verified with UTR, {regularPaidPayments.filter(p => !p.utr_number).length} pending verification
                <span className="ml-2 text-amber-500">(Petty Cash/UPI excluded)</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-status-live/10 text-status-live border-status-live/30">
                {regularPaidPayments.filter(p => p.utr_number).length} Verified
              </Badge>
              <Badge variant="outline" className="bg-status-pending/10 text-status-pending border-status-pending/30">
                {regularPaidPayments.filter(p => !p.utr_number).length} Pending
              </Badge>
            </div>
          </div>

          {regularPaidPayments.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Banknote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No bank payments awaiting UTR verification.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {regularPaidPayments.map(payment => (
                <div
                  key={payment.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border",
                    payment.utr_number
                      ? "bg-status-live/5 border-status-live/20"
                      : "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">#{payment.payment_number}</span>
                      <span className="font-medium">{payment.beneficiary_name || payment.vendor_name}</span>
                      {payment.utr_number && (
                        <Badge className="bg-status-live/20 text-status-live border-status-live/30" variant="outline">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> VERIFIED
                        </Badge>
                      )}
                      {!payment.utr_number && payment.utr_requires_manual_review && (
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30" variant="outline">
                          <AlertTriangle className="w-3 h-3 mr-1" /> REVIEW NEEDED
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>₹{Number(payment.amount).toLocaleString()}</span>
                      {payment.vendor_account_number && (
                        <span className="font-mono">A/C: ...{payment.vendor_account_number.slice(-4)}</span>
                      )}
                      <span>{format(new Date(payment.created_at), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                  <div className="text-right min-w-[250px]">
                    {payment.utr_number ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">UTR Number</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-status-live">{payment.utr_number}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] font-bold text-primary hover:bg-primary/5"
                            onClick={() => handleGenerateVoucher(payment)}
                          >
                            <FileText className="w-3 h-3 mr-1" /> VOUCHER
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          value={manualIndividualUTRs[payment.id] || ''}
                          onChange={(e) => setManualIndividualUTRs(prev => ({ ...prev, [payment.id]: e.target.value.toUpperCase() }))}
                          placeholder="Enter UTR..."
                          className="h-8 text-xs font-mono w-40"
                          disabled={isVerifyingUTR === payment.id}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs"
                          onClick={() => handleIndividualUTRVerification(payment.id)}
                          disabled={isVerifyingUTR === payment.id}
                        >
                          {isVerifyingUTR === payment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
