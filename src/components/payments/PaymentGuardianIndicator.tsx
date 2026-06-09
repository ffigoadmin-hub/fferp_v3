import React from 'react';
import { Shield, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface PaymentGuardianIndicatorProps {
    isChecking: boolean;
    isDuplicate: boolean;
    confidence: number;
    recommendation: 'allow' | 'warn' | 'flag';
    overrideApplied?: boolean;
}

export function PaymentGuardianIndicator({
    isChecking,
    isDuplicate,
    confidence,
    recommendation,
    overrideApplied = false,
}: PaymentGuardianIndicatorProps) {
    if (overrideApplied) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 text-green-500">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-medium">Override Applied</span>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                        Duplicate override applied — proceeding with audit trail
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (isChecking) {
        return (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-[10px]">Checking...</span>
            </span>
        );
    }

    if (isDuplicate) {
        const isFlagged = recommendation === 'flag';
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className={`inline-flex items-center gap-1 ${isFlagged ? 'text-red-500' : 'text-amber-500'}`}>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-medium">
                                {isFlagged ? 'Duplicate' : 'Warning'} ({confidence}%)
                            </span>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                        {isFlagged
                            ? `Potential duplicate detected with ${confidence}% confidence`
                            : `Possible match found with ${confidence}% confidence`}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    // Default: clear state (only show after a check has been performed)
    if (confidence === 0 && !isDuplicate) {
        return null; // Don't show anything before first check
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-green-500">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">Clear</span>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                    No duplicate payments detected
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
