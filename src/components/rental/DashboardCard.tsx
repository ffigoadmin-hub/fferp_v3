import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    className?: string;
    trend?: string;
}

export function DashboardCard({ title, value, icon, className, trend }: DashboardCardProps) {
    return (
        <Card className={cn("border-none shadow-sm", className)}>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{value}</div>
                {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
            </CardContent>
        </Card>
    );
}
