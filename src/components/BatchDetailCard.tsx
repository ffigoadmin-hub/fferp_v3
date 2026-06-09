import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Layers, ChevronDown, ChevronUp, Building2, User, FileText,
  Check, ExternalLink, Loader2, Factory, Leaf, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BatchPayment {
  id: string;
  payment_number: number;
  vendor_name: string;
  beneficiary_name: string | null;
  purpose: string;
  amount: number;
  urgency: string;
  department: string | null;
  vendor_account_number: string | null;
  vendor_ifsc_code: string | null;
  bank_name: string | null;
  bill_url: string | null;
  work_proof_url: string | null;
  requester?: { name: string; department: string };
  created_at: string;
}

interface DepartmentSummary {
  name: string;
  count: number;
  total: number;
}

interface BatchDetailCardProps {
  batchId: string;
  batchReference: string;
  totalAmount: number;
  paymentCount: number;
  createdAt: string;
  creatorName?: string;
  onVerify: () => void;
  isVerifying: boolean;
}

const urgencyConfig: Record<string, { bg: string; text: string; label: string }> = {
  emergency: { bg: 'bg-status-missed/20', text: 'text-status-missed', label: '🔴 Emergency' },
  important: { bg: 'bg-status-late/20', text: 'text-status-late', label: '🟡 Important' },
  normal: { bg: 'bg-status-live/20', text: 'text-status-live', label: '🟢 Normal' },
};

export function BatchDetailCard({
  batchId,
  batchReference,
  totalAmount,
  paymentCount,
  createdAt,
  creatorName,
  onVerify,
  isVerifying
}: BatchDetailCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [payments, setPayments] = useState<BatchPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [departmentSummary, setDepartmentSummary] = useState<DepartmentSummary[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchBatchPayments = useCallback(async () => {
    if (hasFetched || isLoading) return;

    setIsLoading(true);
    console.log('Fetching payments for batch:', batchId);

    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*, requester:profiles!payment_requests_requester_id_fkey(name, department)')
        .eq('bulk_batch_id', batchId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched payments:', data);
      const paymentData = (data || []) as unknown as BatchPayment[];
      setPayments(paymentData);
      setHasFetched(true);

      // Calculate department summary
      const deptMap = new Map<string, { count: number; total: number }>();
      paymentData.forEach(p => {
        const dept = p.department || p.requester?.department || 'Others';
        const existing = deptMap.get(dept) || { count: 0, total: 0 };
        deptMap.set(dept, {
          count: existing.count + 1,
          total: existing.total + Number(p.amount)
        });
      });

      setDepartmentSummary(
        Array.from(deptMap.entries())
          .map(([name, { count, total }]) => ({ name, count, total }))
          .sort((a, b) => b.total - a.total)
      );
    } catch (err) {
      console.error('Failed to fetch batch payments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [batchId, hasFetched, isLoading]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (newExpanded && !hasFetched) {
      fetchBatchPayments();
    }
  };

  // Enhanced department configuration with icons and colors
  const getDepartmentConfig = (dept: string) => {
    const deptLower = dept.toLowerCase();

    if (deptLower.includes('eng') || deptLower === 'engineering') {
      return {
        icon: Factory,
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
        gradient: 'from-blue-500/20 to-blue-600/10',
        label: 'Engineering',
        emoji: '🔧'
      };
    }
    if (deptLower.includes('agri') || deptLower.includes('farm') || deptLower.includes('nursery')) {
      return {
        icon: Leaf,
        color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
        gradient: 'from-emerald-500/20 to-emerald-600/10',
        label: 'Agri',
        emoji: '🌾'
      };
    }
    return {
      icon: Briefcase,
      color: 'bg-violet-500/20 text-violet-400 border-violet-500/50',
      gradient: 'from-violet-500/20 to-violet-600/10',
      label: 'Others',
      emoji: '📋'
    };
  };

  // Fetch payments immediately on mount to get department info
  useEffect(() => {
    if (!hasFetched && !isLoading) {
      fetchBatchPayments();
    }
  }, [hasFetched, isLoading, fetchBatchPayments]);

  return (
    <motion.div
      layout
      className="authority-card border-2 border-primary/20 bg-primary/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-mono">{batchReference}</h3>
            <p className="text-xs text-muted-foreground">
              Prepared by {creatorName || 'Accounts'} • {format(new Date(createdAt), 'PPP HH:mm')}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-status-pending/20 text-status-pending border-status-pending/30">
          PENDING VERIFICATION
        </Badge>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 rounded-lg bg-muted/30 border border-border relative overflow-hidden">
        <div>
          <p className="text-xs uppercase font-semibold text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold text-primary">₹{totalAmount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase font-semibold text-muted-foreground">Payments</p>
          <p className="text-2xl font-bold">{paymentCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase font-semibold text-muted-foreground">Departments</p>
          <p className="text-2xl font-bold">{departmentSummary.length || '-'}</p>
        </div>
        {/* Highlighted Department Display */}
        <div className="lg:col-span-1">
          <p className="text-xs uppercase font-semibold text-muted-foreground mb-1">Primary Department</p>
          {departmentSummary.length > 0 ? (
            (() => {
              const primaryDept = departmentSummary[0];
              const config = getDepartmentConfig(primaryDept.name);
              const DeptIcon = config.icon;
              return (
                <div className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2",
                  config.color
                )}>
                  <DeptIcon className="w-4 h-4" />
                  <span className="font-bold text-sm">{config.emoji} {config.label}</span>
                </div>
              );
            })()
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      </div>

      {/* Department Quick View - Always visible */}
      {departmentSummary.length > 0 && (
        <div className="mb-4 p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/20 border border-border">
          <p className="text-xs uppercase font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Building2 className="w-3 h-3" />
            Department Breakdown
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departmentSummary.map(dept => {
              const config = getDepartmentConfig(dept.name);
              const DeptIcon = config.icon;
              return (
                <div
                  key={dept.name}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border-2 bg-gradient-to-r",
                    config.color,
                    config.gradient
                  )}
                >
                  <div className="flex items-center gap-2">
                    <DeptIcon className="w-5 h-5" />
                    <div>
                      <p className="font-bold text-sm">{config.emoji} {config.label}</p>
                      <p className="text-xs opacity-80">{dept.count} payment{dept.count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <p className="font-bold font-mono text-lg">₹{dept.total.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expandable Payment Details */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer border border-border"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            View Payment Details ({paymentCount} payments)
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3"
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading payment details...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <FileText className="w-8 h-8" />
                <p className="text-sm">No payments found in this batch</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Department Summary Cards */}
                {/* Payment List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {payments.map((payment, idx) => (
                    <Card key={payment.id} className="bg-background/50 border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">
                                #{idx + 1}
                              </span>
                              {/* Enhanced Department Badge */}
                              {(() => {
                                const deptName = payment.department || payment.requester?.department || 'Others';
                                const config = getDepartmentConfig(deptName);
                                const DeptIcon = config.icon;
                                return (
                                  <Badge
                                    variant="outline"
                                    className={cn("px-2 py-1 gap-1.5 font-semibold", config.color)}
                                  >
                                    <DeptIcon className="w-3 h-3" />
                                    {config.emoji} {config.label}
                                  </Badge>
                                );
                              })()}
                              <Badge
                                variant="outline"
                                className={cn("text-[10px]", urgencyConfig[payment.urgency]?.bg, urgencyConfig[payment.urgency]?.text)}
                              >
                                {urgencyConfig[payment.urgency]?.label || payment.urgency}
                              </Badge>
                            </div>

                            <h4 className="font-semibold text-foreground truncate">
                              {payment.beneficiary_name || payment.vendor_name}
                            </h4>

                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {payment.purpose}
                            </p>

                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {payment.requester?.name || 'N/A'}
                              </span>
                              {payment.vendor_account_number && (
                                <span className="font-mono">
                                  A/C: ****{payment.vendor_account_number.slice(-4)}
                                </span>
                              )}
                              {payment.vendor_ifsc_code && (
                                <span className="font-mono">{payment.vendor_ifsc_code}</span>
                              )}
                            </div>

                            {/* Document Links */}
                            <div className="flex gap-3 mt-2">
                              {payment.bill_url && (
                                <a
                                  href={payment.bill_url?.split(',')[0]?.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" /> Bill
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {payment.work_proof_url && (
                                <a
                                  href={payment.work_proof_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" /> Work Proof
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xl font-bold text-primary">
                              ₹{Number(payment.amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              PAY-{String(payment.payment_number || 0).padStart(6, '0')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t border-border">
        <Button
          onClick={onVerify}
          disabled={isVerifying}
          className="bg-status-live hover:bg-status-live/90 h-12 px-8 text-lg"
        >
          <Check className="w-5 h-5 mr-2" /> Verify & Approve Batch
        </Button>
      </div>
    </motion.div>
  );
}
