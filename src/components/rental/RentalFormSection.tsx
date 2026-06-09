import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from 'lucide-react';

interface RentalFormSectionProps {
    title: string;
    icon?: LucideIcon;
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}

export function RentalFormSection({ title, icon: Icon, children, className, action }: RentalFormSectionProps) {
    return (
        <Card className={cn("bg-card border-border/50 shadow-sm overflow-hidden", className)}>
            <CardHeader className="bg-muted/30 border-b border-border/50 px-6 py-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
                    <CardTitle className="text-base font-bold uppercase tracking-wide text-foreground">{title}</CardTitle>
                </div>
                {action && <div>{action}</div>}
            </CardHeader>
            <CardContent className="p-6">
                {children}
            </CardContent>
        </Card>
    );
}
