import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, CreditCard, ExternalLink, Paperclip } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SplitPaymentData } from '@/hooks/usePaymentRequests';
import { DocumentPreviewModal } from '../DocumentPreviewModal';
import { ProofPreviewGrid } from '../payment/EmbeddedProofPreview';

interface SplitPaymentBatchViewProps {
  paymentId: string;
  totalAmount: number;
  splits: SplitPaymentData[];
  className?: string;
}

export function SplitPaymentBatchView({
  paymentId,
  totalAmount,
  splits,
  className
}: SplitPaymentBatchViewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  if (!splits || splits.length === 0) return null;

  return (
    <Card className={cn('mt-4 border-l-4 border-l-purple-500 overflow-hidden', className)}>
      {/* Header - Always Visible */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 flex items-center justify-between transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Users className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h4 className="font-bold text-sm">
              Split Payment Batch
            </h4>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">
              {splits.length} beneficiaries • Total: ₹{totalAmount.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-purple-500/5 text-purple-500 border-purple-500/20 text-[10px] font-bold">
            BATCH
          </Badge>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Collapsible Content - Split Details */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/20">
          <div className="p-4 space-y-3">
            {splits.map((split, index) => (
              <div
                key={split.id}
                className="p-3 bg-card rounded-xl border border-border shadow-sm group hover:border-purple-500/30 transition-all"
              >
                {/* Split Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        #{split.split_number}
                      </span>
                      <h5 className="font-bold text-sm">
                        {split.split_title}
                      </h5>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Payee: <span className="text-foreground">{split.payee_name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-primary">
                      ₹{split.amount.toLocaleString()}
                    </div>
                    {split.status === 'paid' && (
                      <Badge className="bg-green-500 text-white border-none text-[9px] h-4">
                        PAID
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Payment Method & Details */}
                <div className="mt-2 pt-2 border-t border-border flex flex-wrap gap-y-2 justify-between items-center">
                  <div className="flex items-center gap-2 text-[11px]">
                    <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                    {split.payment_method === 'bank_transfer' ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold uppercase text-[10px] opacity-70">Bank</span>
                        <code className="bg-muted px-1 rounded text-xs">{split.account_number}</code>
                        <code className="bg-muted px-1 rounded text-xs">{split.ifsc_code}</code>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold uppercase text-[10px] opacity-70">UPI</span>
                        <code className="bg-muted px-1 rounded text-xs">{split.upi_id}</code>
                      </div>
                    )}
                  </div>

                  {/* Split UTR / Proof if paid */}
                  {split.utr_number && (
                    <div className="flex items-center gap-3">
                      <div className="text-[10px] font-bold">
                        <span className="opacity-50 uppercase mr-1">UTR:</span>
                        <span className="font-mono">{split.utr_number}</span>
                      </div>
                      {split.payment_proof_url && (
                        <a
                          href={split.payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Split Context Documents */}
                {(split.bill_url || split.work_proof_url) && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3">
                    {split.bill_url && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Split Bill / Proof Folder</span>
                        <ProofPreviewGrid
                          proofs={split.bill_url}
                          onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                        />
                      </div>
                    )}
                    {split.work_proof_url && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Split Bank Proof</span>
                        <ProofPreviewGrid
                          proofs={split.work_proof_url}
                          onExpand={(u, t) => { setPreviewUrl(u); setPreviewTitle(t); setShowPreview(true); }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary Footer */}
          <div className="border-t border-border p-4 bg-muted/40">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest opacity-50">
                Total Batch Payload
              </span>
              <span className="text-lg font-black text-primary">
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      <DocumentPreviewModal
        url={previewUrl}
        title={previewTitle}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </Card>
  );
}
