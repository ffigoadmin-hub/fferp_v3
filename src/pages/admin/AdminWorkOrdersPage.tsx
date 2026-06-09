import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';
import { WorkRequestApprovalWidget } from '@/components/WorkRequestApprovalWidget';

export default function AdminWorkOrdersPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-authority-admin/10">
                    <FileText className="w-5 h-5 text-authority-admin" />
                </div>
                <div>
                    <h1 className="text-xl font-bold">Work Order Approvals</h1>
                    <p className="text-sm text-muted-foreground">Review and manage pending work orders</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="authority-card p-6">
                    <WorkRequestApprovalWidget 
                        role="admin" 
                        targetStatus="pending_admin"
                        title="Work Request Pre-Approvals"
                        subtitle="Audit work requests before CEO final sign-off"
                    />
                </div>

                <div className="authority-card p-6">
                    <WorkOrderMonitoringWidget role="admin" showApprovalActions={true} />
                </div>
            </div>
        </motion.div>
    );
}
