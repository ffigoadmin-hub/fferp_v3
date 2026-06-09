import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { TransportSubmissionForm } from '@/components/transport/TransportSubmissionForm';
import { Truck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TransportPaymentPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto pb-12 space-y-6">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/payment-request')} className="shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10">
                        <Truck className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Transport Expenses</h1>
                        <p className="text-sm text-muted-foreground">Manage transport & porter costs</p>
                    </div>
                </div>
            </div>

            {/* Submission Form */}
            <div className="max-w-2xl mx-auto">
                <TransportSubmissionForm
                    onSuccess={() => navigate('/my-requests')}
                    onCancel={() => navigate('/payment-request')}
                />
            </div>
        </motion.div>
    );
}

export default TransportPaymentPage;
