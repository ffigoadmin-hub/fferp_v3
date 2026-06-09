import { useState } from 'react';
import { motion } from 'framer-motion';
import { Handshake, History as HistoryIcon, ListTodo, Wallet, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useAuth } from '@/contexts/AuthContext';
import { usePettyCashReports } from '@/hooks/usePettyCashReports';

import { EnhancedPaymentAuditWidget } from '@/components/payment/EnhancedPaymentAuditWidget';
import { AuditHistoryWidget } from '@/components/payment/AuditHistoryWidget';
import PettyCashAuditPage from '@/pages/accounts/PettyCashAuditPage';

export default function JVDirectorDashboard() {
    const { user } = useAuth();
    const { requests, isLoading } = usePaymentRequests(['director_audit']);
    const { reports } = usePettyCashReports();

    // Filter to JV-only payments for the count badge
    const jvRequests = requests.filter((r: any) =>
        r.is_jv_payment === true ||
        (r.department || '').toLowerCase().includes('jv')
    );

    const pendingPettyAudits = reports.filter(r => r.status === 'draft' || r.status === 'submitted').length;

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6">
            {/* Header with JV Branding */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-amber-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-500" />
                            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-xl shadow-amber-500/20">
                                <Handshake className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">JV Engineering — Director Audit</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30 text-[10px] font-bold uppercase tracking-wider" variant="outline">
                                    <Shield className="w-3 h-3 mr-1" />
                                    Joint Venture
                                </Badge>
                                <p className="text-muted-foreground text-sm">
                                    JV payment oversight • Skips GMO/BOI
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Pills */}
                <div className="flex gap-3">
                    <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <p className="text-[10px] text-amber-400/70 uppercase tracking-wider font-medium">JV Queue</p>
                        <p className="text-2xl font-bold text-amber-400">{jvRequests.length}</p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                        <p className="text-[10px] text-primary/70 uppercase tracking-wider font-medium">Total Queue</p>
                        <p className="text-2xl font-bold text-primary">{requests.length}</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="audit" className="space-y-6">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="audit" className="gap-2">
                        <ListTodo className="w-4 h-4" />
                        JV Audit Queue
                        {requests.length > 0 && <Badge variant="secondary" className="ml-1 bg-amber-500/20 text-amber-400">{requests.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <HistoryIcon className="w-4 h-4" />
                        Audit History
                    </TabsTrigger>
                    <TabsTrigger value="petty-audit" className="gap-2">
                        <Wallet className="w-4 h-4" />
                        Petty Audit
                        {pendingPettyAudits > 0 && (
                            <Badge variant="secondary" className="ml-1 bg-blue-500 text-white hover:bg-blue-600">
                                {pendingPettyAudits}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="audit" className="space-y-6">
                    <EnhancedPaymentAuditWidget
                        roles={['director']}
                        targetStatuses={['director_audit']}
                        title="JV Engineering — Director Audit"
                        subtitle="Review and approve JV Engineering payments • Workflow: Engineer → SMO → Director → GM → Admin → CEO"
                        roleLabel="Director (JV)"
                        jvOnly
                    />
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <AuditHistoryWidget role="director" />
                </TabsContent>

                <TabsContent value="petty-audit">
                    <PettyCashAuditPage />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}
