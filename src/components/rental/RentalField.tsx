import React from 'react';
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface RentalFieldProps {
    label: string;
    error?: string;
    required?: boolean;
    className?: string;
    children: React.ReactNode;
    helperText?: string;
}

export function RentalField({ label, error, required, className, children, helperText }: RentalFieldProps) {
    return (
        <div className={cn("space-y-2", className)}>
            <Label className={cn("text-xs font-bold uppercase text-muted-foreground tracking-wide", error && "text-destructive")}>
                {label} {required && <span className="text-destructive">*</span>}
            </Label>
            {children}
            {helperText && !error && <p className="text-[10px] text-muted-foreground">{helperText}</p>}
            {error && <p className="text-[10px] font-medium text-destructive">{error}</p>}
        </div>
    );
}
