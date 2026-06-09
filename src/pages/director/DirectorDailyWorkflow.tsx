import { useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, History as HistoryIcon, ListTodo, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useAuth } from '@/contexts/AuthContext';
import { usePettyCashReports } from '@/hooks/usePettyCashReports';
import { Link } from 'react-router-dom';

import { EnhancedPaymentAuditWidget } from '@/components/payment/EnhancedPaymentAuditWidget';
import { AuditHistoryWidget } from '@/components/payment/AuditHistoryWidget';
import PettyCashAuditPage from '@/pages/accounts/PettyCashAuditPage';
import { RecentSalesOrdersWidget } from '@/components/RecentSalesOrdersWidget';

export default function DirectorDailyWorkflow() {
    const { user } = useAuth();
    const { requests, isLoading } = usePaymentRequests(['director_audit']);
    const { reports } = usePettyCashReports();

    const pendingPettyAudits = reports.filter(r => r.status === 'draft' || r.status === 'submitted').length;

    if (isLoading) {
        return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Leaf className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold">Director Payment Audit</h1>
                    </div>
                    <p className="text-muted-foreground">Agri Department oversight and approval</p>
                </div>
            </div>

            <Tabs defaultValue="audit" className="space-y-6">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="audit" className="gap-2">
                        <ListTodo className="w-4 h-4" />
                        Audit Queue
                        {requests.length > 0 && <Badge variant="secondary" className="ml-1">{requests.length}</Badge>}
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
                        title="Agri Department Audit"
                        subtitle="Review and approve Agri payments before Admin compliance"
                        roleLabel="Director"
                        excludeJV
                    />
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <AuditHistoryWidget role="director" />
                </TabsContent>

                <TabsContent value="petty-audit">
                    <PettyCashAuditPage />
                </TabsContent>
            </Tabs>

            {/* Sales Orders visible to Director */}
            <div className="mt-6">
                <RecentSalesOrdersWidget title="Sales Orders — Live Feed" limit={10} />
            </div>
        </motion.div>
    );
}
