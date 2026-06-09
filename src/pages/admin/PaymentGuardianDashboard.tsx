import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle, BarChart3, TrendingUp, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FraudAlertDashboard } from '@/components/admin/FraudAlertDashboard';

interface GuardianStats {
    totalChecks: number;
    duplicatesDetected: number;
    overridesUsed: number;
    flaggedActive: number;
}

interface RecentOverride {
    id: string;
    payment_request_id: string;
    override_by: string;
    override_reason: string;
    override_at: string;
    match_confidence: number;
    match_rules_triggered: string[];
}

export function PaymentGuardianDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<GuardianStats>({
        totalChecks: 0,
        duplicatesDetected: 0,
        overridesUsed: 0,
        flaggedActive: 0,
    });
    const [recentOverrides, setRecentOverrides] = useState<RecentOverride[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user || !['admin', 'ceo'].includes(user.role)) return;

        const fetchStats = async () => {
            try {
                // Fetch dedup registry stats
                const { data: allEntries } = await (supabase
                    .from('payment_deduplication_registry') as any)
                    .select('status, override_allowed, match_confidence');

                if (allEntries) {
                    setStats({
                        totalChecks: allEntries.length,
                        duplicatesDetected: allEntries.filter((e: any) => e.match_confidence > 0).length,
                        overridesUsed: allEntries.filter((e: any) => e.override_allowed).length,
                        flaggedActive: allEntries.filter((e: any) => e.status === 'flagged').length,
                    });
                }

                // Fetch recent overrides
                const { data: overrides } = await (supabase
                    .from('payment_deduplication_registry') as any)
                    .select('id, payment_request_id, override_by, override_reason, override_at, match_confidence, match_rules_triggered')
                    .eq('override_allowed', true)
                    .order('override_at', { ascending: false })
                    .limit(20);

                if (overrides) {
                    setRecentOverrides(overrides);
                }
            } catch (err) {
                console.error('Error fetching guardian stats:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [user]);

    if (!user || !['admin', 'ceo'].includes(user.role)) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <ShieldOff className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium text-muted-foreground">Access Restricted</p>
                    <p className="text-sm text-muted-foreground mt-1">Only Admin and CEO can access Payment Guardian</p>
                </div>
            </div>
        );
    }

    const ruleLabels: Record<string, string> = {
        exact_same_day_duplicate: 'Exact Same-Day',
        invoice_hash_duplicate: 'Invoice Reuse',
        bank_account_duplicate: 'Bank Account',
        upi_duplicate: 'UPI',
        fuzzy_vendor_match: 'Fuzzy Vendor',
        requester_pattern_anomaly: 'Pattern',
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Payment Guardian</h1>
                    <p className="text-sm text-muted-foreground">Anti-pilferage duplicate detection system</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-border/50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-medium">Total Checks</span>
                        </div>
                        <p className="text-2xl font-bold">{isLoading ? '—' : stats.totalChecks}</p>
                    </CardContent>
                </Card>
                <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <span className="text-xs text-muted-foreground font-medium">Duplicates Found</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-600">{isLoading ? '—' : stats.duplicatesDetected}</p>
                    </CardContent>
                </Card>
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-muted-foreground font-medium">Active Flags</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600">{isLoading ? '—' : stats.flaggedActive}</p>
                    </CardContent>
                </Card>
                <Card className="border-green-500/30 bg-green-500/5">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-muted-foreground font-medium">Overrides Used</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">{isLoading ? '—' : stats.overridesUsed}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="alerts" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="alerts" className="gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Fraud Alerts
                    </TabsTrigger>
                    <TabsTrigger value="overrides" className="gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Override History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="alerts">
                    <FraudAlertDashboard />
                </TabsContent>

                <TabsContent value="overrides">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Recent Override Decisions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {recentOverrides.length === 0 ? (
                                <div className="text-center py-8">
                                    <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                                    <p className="text-sm text-muted-foreground">No overrides recorded yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recentOverrides.map(override => (
                                        <div key={override.id} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                                                        {override.match_confidence}% match
                                                    </Badge>
                                                    {override.match_rules_triggered?.map((rule: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="text-[9px]">
                                                            {ruleLabels[rule] || rule}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {override.override_at ? new Date(override.override_at).toLocaleString('en-IN') : '—'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground italic">
                                                "{override.override_reason}"
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                Payment: {override.payment_request_id?.substring(0, 8)}...
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
