import React, { useState } from 'react';
import { AlertTriangle, Shield, ShieldAlert, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DuplicateMatch } from '@/hooks/useDuplicateCheck';

interface DuplicateWarningBannerProps {
    matches: DuplicateMatch[];
    confidence: number;
    recommendation: 'allow' | 'warn' | 'flag';
    onOverride: (reason: string) => Promise<{ success: boolean; error?: string }>;
    overrideApplied?: boolean;
}

const ruleLabels: Record<string, string> = {
    exact_same_day_duplicate: 'Exact Same-Day Duplicate',
    invoice_hash_duplicate: 'Same Invoice/Bill Reused',
    bank_account_duplicate: 'Same Bank Account + Similar Amount',
    upi_duplicate: 'Same UPI ID + Similar Amount',
    fuzzy_vendor_match: 'Similar Vendor Name Match',
    requester_pattern_anomaly: 'Unusual Submission Pattern',
};

export function DuplicateWarningBanner({
    matches,
    confidence,
    recommendation,
    onOverride,
    overrideApplied = false,
}: DuplicateWarningBannerProps) {
    const [expanded, setExpanded] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');
    const [showOverride, setShowOverride] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [overrideError, setOverrideError] = useState('');

    if (!matches.length) return null;

    if (overrideApplied) {
        return (
            <Card className="border-green-500/40 bg-green-500/5">
                <CardContent className="p-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-sm text-green-700 dark:text-green-400">
                        Duplicate override applied — payment will proceed with audit trail.
                    </span>
                </CardContent>
            </Card>
        );
    }

    const isFlagged = recommendation === 'flag';
    const borderColor = isFlagged ? 'border-red-500/60' : 'border-amber-500/60';
    const bgColor = isFlagged ? 'bg-red-500/5' : 'bg-amber-500/5';
    const Icon = isFlagged ? ShieldAlert : AlertTriangle;
    const iconColor = isFlagged ? 'text-red-500' : 'text-amber-500';
    const titleColor = isFlagged ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400';

    const handleOverride = async () => {
        if (overrideReason.trim().length < 20) {
            setOverrideError('Justification must be at least 20 characters');
            return;
        }
        setIsSubmitting(true);
        setOverrideError('');
        const result = await onOverride(overrideReason);
        if (!result.success) {
            setOverrideError(result.error || 'Override failed');
        }
        setIsSubmitting(false);
    };

    return (
        <Card className={`${borderColor} ${bgColor} shadow-sm`}>
            <CardContent className="p-3 space-y-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                        <Icon className={`h-5 w-5 ${iconColor} shrink-0 mt-0.5`} />
                        <div>
                            <p className={`text-sm font-semibold ${titleColor}`}>
                                {isFlagged ? '🚨 Potential Duplicate Payment Detected' : '⚠️ Possible Duplicate Payment'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {matches.length} match{matches.length > 1 ? 'es' : ''} found
                                {' · '}Confidence: {confidence}%
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>

                {/* Rules triggered */}
                <div className="flex flex-wrap gap-1">
                    {[...new Set(matches.map(m => m.rule))].map(rule => (
                        <Badge
                            key={rule}
                            variant="outline"
                            className={`text-[10px] ${isFlagged ? 'border-red-300 text-red-600 dark:text-red-400' : 'border-amber-300 text-amber-600 dark:text-amber-400'}`}
                        >
                            {ruleLabels[rule] || rule}
                        </Badge>
                    ))}
                </div>

                {/* Expanded match details */}
                {expanded && (
                    <div className="space-y-1.5 mt-1">
                        {matches.map((match, idx) => (
                            <div
                                key={idx}
                                className="rounded-md bg-background/60 border border-border/50 p-2 text-xs space-y-0.5"
                            >
                                <div className="flex justify-between">
                                    <span className="font-medium">{match.vendor}</span>
                                    <Badge variant="secondary" className="text-[10px]">
                                        {match.confidence}% match
                                    </Badge>
                                </div>
                                {match.rule === 'requester_pattern_anomaly' ? (
                                    <div className="text-muted-foreground italic">
                                        High frequency of requests detected from this vendor/requester.
                                    </div>
                                ) : (
                                    <div className="text-muted-foreground">
                                        {match.amount ? `₹${match.amount.toLocaleString('en-IN')}` : 'Amount hidden'} · {match.date ? new Date(match.date).toLocaleDateString('en-IN') : 'Date hidden'}
                                    </div>
                                )}
                                <div className="text-[10px] text-muted-foreground">
                                    Rule: {ruleLabels[match.rule] || match.rule}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Override section */}
                {!showOverride ? (
                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setShowOverride(true)}
                        >
                            <Shield className="h-3 w-3 mr-1" />
                            Override & Proceed
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2 pt-1 border-t border-border/50">
                        <p className="text-xs text-muted-foreground">
                            Provide justification to proceed (min 20 characters). This will be logged for audit.
                        </p>
                        <Textarea
                            placeholder="Explain why this is not a duplicate payment..."
                            value={overrideReason}
                            onChange={e => {
                                setOverrideReason(e.target.value);
                                if (overrideError) setOverrideError('');
                            }}
                            className="min-h-[60px] text-xs"
                        />
                        {overrideError && (
                            <p className="text-[11px] text-red-500">{overrideError}</p>
                        )}
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleOverride}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Processing...' : 'Confirm Override'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                    setShowOverride(false);
                                    setOverrideReason('');
                                    setOverrideError('');
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
