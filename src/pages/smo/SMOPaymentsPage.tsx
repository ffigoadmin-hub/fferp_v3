import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Banknote, ListTodo, History as HistoryIcon, CreditCard } from 'lucide-react';
import { EnhancedPaymentAuditWidget } from '@/components/payment/EnhancedPaymentAuditWidget';
import { AuditHistoryWidget } from '@/components/payment/AuditHistoryWidget';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PaymentSearchWidget } from '@/components/PaymentSearchWidget';

export default function SMOPaymentsPage() {
    const { user } = useAuth();
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold">SMO Payment Audit</h1>
                    </div>
                    <p className="text-muted-foreground">Departmental verification for payment requests</p>
                </div>
            </div>

            <Tabs defaultValue="audit" className="space-y-6">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="audit" className="gap-2">
                        <ListTodo className="w-4 h-4" />
                        Audit Queue
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <HistoryIcon className="w-4 h-4" />
                        Audit History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="audit" className="space-y-6">
                    <EnhancedPaymentAuditWidget
                        roles={['smo']}
                        targetStatuses={['smo_audit', 'pending']}
                        title="Initial Audit Queue"
                        subtitle="Verify proof folder contents (invoices, photos, videos) and vendor details before forwarding"
                        roleLabel="SMO"
                    />
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <AuditHistoryWidget role="smo" />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}
