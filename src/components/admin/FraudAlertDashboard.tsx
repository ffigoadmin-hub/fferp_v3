import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Info, Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useFraudAlerts, FraudAlert } from '@/hooks/useFraudAlerts';
import { supabase } from '@/integrations/supabase/client';
import { Play } from 'lucide-react';
import { toast } from 'sonner';

const alertTypeLabels: Record<string, string> = {
    high_frequency: 'High-Frequency Requester',
    same_vendor_burst: 'Vendor Payment Burst',
    round_amounts: 'Round Amount Pattern',
    multi_requester_same_account: 'Multi-Requester Same Account',
};

const alertTypeIcons: Record<string, React.ReactNode> = {
    high_frequency: <AlertTriangle className="h-4 w-4" />,
    same_vendor_burst: <ShieldAlert className="h-4 w-4" />,
    round_amounts: <Info className="h-4 w-4" />,
    multi_requester_same_account: <ShieldAlert className="h-4 w-4" />,
};

const severityColors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-600 border-red-500/30',
    medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    low: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
};

function AlertCard({
    alert,
    onReview,
    onDismiss,
}: {
    alert: FraudAlert;
    onReview: (id: string, notes: string) => void;
    onDismiss: (id: string, notes: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [notes, setNotes] = useState('');
    const [showActions, setShowActions] = useState(false);

    return (
        <Card className="border-border/50">
            <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                        <span className={`mt-0.5 ${alert.severity === 'high' ? 'text-red-500' : alert.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'}`}>
                            {alertTypeIcons[alert.alert_type]}
                        </span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">
                                    {alertTypeLabels[alert.alert_type] || alert.alert_type}
                                </span>
                                <Badge variant="outline" className={`text-[10px] ${severityColors[alert.severity]}`}>
                                    {alert.severity.toUpperCase()}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {alert.pattern_description}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(alert.created_at).toLocaleString('en-IN')}
                                {alert.vendor_name && ` · Vendor: ${alert.vendor_name}`}
                                {alert.payment_ids?.length > 0 && ` · ${alert.payment_ids.length} payments`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>

                {expanded && (
                    <div className="space-y-2 pt-1 border-t border-border/30">
                        {alert.payment_ids?.length > 0 && (
                            <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1">Affected Payment IDs:</p>
                                <div className="flex flex-wrap gap-1">
                                    {alert.payment_ids.slice(0, 10).map((id, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-[9px] font-mono">
                                            {id.substring(0, 8)}...
                                        </Badge>
                                    ))}
                                    {alert.payment_ids.length > 10 && (
                                        <Badge variant="secondary" className="text-[9px]">
                                            +{alert.payment_ids.length - 10} more
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}

                        {!showActions ? (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => setShowActions(true)}
                                >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Take Action
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Textarea
                                    placeholder="Add review notes..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="min-h-[50px] text-xs"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => onReview(alert.id, notes)}
                                    >
                                        Mark Reviewed
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-muted-foreground"
                                        onClick={() => onDismiss(alert.id, notes)}
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function FraudAlertDashboard() {
    const [statusFilter, setStatusFilter] = useState<string[]>(['pending']);
    const { alerts, isLoading, stats, markReviewed, dismiss } = useFraudAlerts(statusFilter);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const { data, error } = await supabase.functions.invoke('payment-pattern-analyzer');
            if (error) throw error;
            toast.success(`Analysis complete: ${data.alerts_created} new alerts created`);
        } catch (err) {
            console.error('Manual analysis failed:', err);
            toast.error('Failed to run analysis');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2">
                <Card className="border-border/50">
                    <CardContent className="p-2.5 text-center">
                        <p className="text-lg font-bold">{stats.total}</p>
                        <p className="text-[10px] text-muted-foreground">Total Alerts</p>
                    </CardContent>
                </Card>
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="p-2.5 text-center">
                        <p className="text-lg font-bold text-red-600">{stats.high}</p>
                        <p className="text-[10px] text-muted-foreground">High Severity</p>
                    </CardContent>
                </Card>
                <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-2.5 text-center">
                        <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
                        <p className="text-[10px] text-muted-foreground">Pending Review</p>
                    </CardContent>
                </Card>
                <Card className="border-green-500/30 bg-green-500/5">
                    <CardContent className="p-2.5 text-center">
                        <p className="text-lg font-bold text-green-600">{stats.reviewed}</p>
                        <p className="text-[10px] text-muted-foreground">Reviewed</p>
                    </CardContent>
                </Card>
            </div>

            {/* Run Analysis Button */}
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                    className="h-8 gap-2 border-primary/20 hover:bg-primary/5"
                >
                    <Play className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                    {isAnalyzing ? 'Analyzing Patterns...' : 'Run Analysis Now'}
                </Button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1">
                {[
                    { label: 'Pending', value: ['pending'] },
                    { label: 'Reviewed', value: ['reviewed'] },
                    { label: 'Dismissed', value: ['dismissed'] },
                    { label: 'All', value: ['pending', 'reviewed', 'dismissed'] },
                ].map(tab => (
                    <Button
                        key={tab.label}
                        variant={JSON.stringify(statusFilter) === JSON.stringify(tab.value) ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setStatusFilter(tab.value)}
                    >
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Alert list */}
            {isLoading ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Loading alerts...</div>
            ) : alerts.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="p-6 text-center">
                        <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                        <p className="text-sm text-muted-foreground">No fraud alerts found</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Alerts are generated daily by pattern analysis
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {alerts.map(alert => (
                        <AlertCard
                            key={alert.id}
                            alert={alert}
                            onReview={markReviewed}
                            onDismiss={dismiss}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
