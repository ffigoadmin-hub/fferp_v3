import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { MaterialRequestAuditWidget } from '@/components/purchase/MaterialRequestAuditWidget';

export default function AdminProcurementPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                    <Package className="w-6 h-6" style={{ color: '#2563EB' }} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Procurement Compliance Audit</h1>
                    <p className="text-muted-foreground">Verify legitimacy and compliance for material sourcing</p>
                </div>
            </div>

            <MaterialRequestAuditWidget
                role="admin"
                targetStatus="pending_admin"
                title="Admin Procurement Audit"
                subtitle="Review material requests before CEO approval"
            />
        </motion.div>
    );
}
