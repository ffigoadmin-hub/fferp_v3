import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldCheck, Plus, Banknote, ListTodo, History as HistoryIcon } from 'lucide-react';
import { EnhancedPaymentAuditWidget } from '@/components/payment/EnhancedPaymentAuditWidget';
import { AuditHistoryWidget } from '@/components/payment/AuditHistoryWidget';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PaymentSearchWidget } from '@/components/PaymentSearchWidget';

export default function BOIPaymentsPage() {
    const { user } = useAuth();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold">BOI Payment Audit</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Cross-departmental financial compliance verification
                    </p>
                </div>
                <Button asChild className="gap-2 shrink-0">
                    <Link to="/payment-request">
                        <Plus className="w-4 h-4" />
                        Raise Payment
                    </Link>
                </Button>
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
                    <TabsTrigger value="my-requests" className="gap-2">
                        <Banknote className="w-4 h-4" />
                        My Requests
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="audit" className="space-y-6">
                    <EnhancedPaymentAuditWidget
                        roles={['boi']}
                        targetStatuses={['boi_audit']}
                        title="Financial Compliance Queue"
                        subtitle="Verify financial compliance for all departments before forwarding"
                        roleLabel="BOI"
                    />
                </TabsContent>

                <TabsContent value="history" className="space-y-6">
                    <AuditHistoryWidget role="boi" />
                </TabsContent>

                <TabsContent value="my-requests">
                    <PaymentSearchWidget title="My Payment Requests" requesterId={user?.id} />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}
