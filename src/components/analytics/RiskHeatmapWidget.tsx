import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, AlertOctagon, ShieldAlert, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { RiskAnalysis, RiskLevel } from '@/lib/riskEngine';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface RiskItem {
    id: string;
    projectName: string;
    analysis: RiskAnalysis;
}

interface RiskHeatmapWidgetProps {
    risks: RiskItem[];
}

export function RiskHeatmapWidget({ risks }: RiskHeatmapWidgetProps) {
    const sortedRisks = [...risks].sort((a, b) => b.analysis.score - a.analysis.score);

    return (
        <Card className="h-full border-border bg-card shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col relative overflow-hidden group">
            <CardHeader className="pb-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-base font-bold text-foreground tracking-tight">
                        <div className="p-1.5 rounded-md bg-destructive/10 text-destructive">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                        Risk Monitor
                    </CardTitle>
                    <Badge variant="outline" className={cn(
                        "text-[10px] font-bold px-2 py-0.5 border",
                        risks.length > 0 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted text-muted-foreground border-border"
                    )}>
                        {risks.length} Alerts
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                {risks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center min-h-[300px]">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, type: "spring" }}
                            className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 shadow-sm border border-emerald-500/20"
                        >
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </motion.div>
                        <h4 className="font-bold text-lg text-foreground mb-2">All Systems Normal</h4>
                        <p className="text-sm text-muted-foreground max-w-[200px] leading-relaxed">
                            No critical risks detected across your portfolio.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {sortedRisks.map((item) => (
                            <RiskRow key={item.id} item={item} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

const levelConfig: Record<RiskLevel, { color: string; bg: string; icon: any; border: string }> = {
    'Critical': { color: 'text-destructive', bg: 'bg-destructive/10', icon: AlertOctagon, border: 'border-l-4 border-l-destructive' },
    'High': { color: 'text-orange-500', bg: 'bg-orange-500/10', icon: AlertTriangle, border: 'border-l-4 border-l-orange-500' },
    'Medium': { color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Clock, border: 'border-l-4 border-l-amber-500' },
    'Low': { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Clock, border: 'border-l-4 border-l-blue-500' },
    'Safe': { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: ShieldAlert, border: 'border-l-4 border-l-emerald-500' }
};

function RiskRow({ item }: { item: RiskItem }) {
    const { analysis } = item;
    const config = levelConfig[analysis.level];
    const Icon = config.icon;

    return (
        <div className={cn("p-5 hover:bg-muted/30 transition-colors group relative", config.border)}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider border-none", config.bg, config.color)}>
                            {analysis.level}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">Score: {analysis.score}</span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground truncate mb-2 group-hover:text-primary transition-colors">
                        {item.projectName}
                    </h4>

                    <div className="space-y-1.5">
                        {analysis.factors.map((factor, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs font-medium text-muted-foreground leading-snug">
                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1", config.color.replace('text-', 'bg-'))} />
                                <span>{factor}</span>
                            </div>
                        ))}
                        {analysis.factors.length === 0 && (
                            <p className="text-xs text-muted-foreground italic pl-3.5">No specific risk factors flagged.</p>
                        )}
                    </div>
                </div>

                <Link to={`/projects/execution/${item.id}`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted -mt-1 -mr-1">
                        <ArrowUpRight className="w-4 h-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
