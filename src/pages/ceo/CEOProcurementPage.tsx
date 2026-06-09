import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { MaterialRequestAuditWidget } from '@/components/purchase/MaterialRequestAuditWidget';

export default function CEOProcurementPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-authority-ceo/20 flex items-center justify-center">
                    <Package className="w-6 h-6 text-authority-ceo" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Procurement Approvals</h1>
                    <p className="text-muted-foreground">Final approval authority for material sourcing</p>
                </div>
            </div>

            <MaterialRequestAuditWidget
                role="ceo"
                targetStatus="pending_ceo"
                title="CEO Final Approval"
                subtitle="Review and authorize validated material requests"
            />
        </motion.div>
    );
}
