import { motion } from 'framer-motion';
import { ClipboardList } from 'lucide-react';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';
import { WorkRequestApprovalWidget } from '@/components/WorkRequestApprovalWidget';

export default function CEOWorkOrdersPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="space-y-8">
        <WorkRequestApprovalWidget
          role="ceo"
          targetStatus="pending_ceo"
          title="CEO Work Pre-Approval"
          subtitle="Final authorization for new work requests before sourcing"
        />

        <div className="pt-8 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <ClipboardList className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Active Work Orders</h2>
              <p className="text-xs text-muted-foreground">Monitoring and final release of sourced work orders</p>
            </div>
          </div>
          <div className="authority-card p-6">
            <WorkOrderMonitoringWidget role="ceo" showApprovalActions={true} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
