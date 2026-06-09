import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import { MaterialApprovalWidget } from '@/components/purchase/MaterialApprovalWidget';

export default function CEOMaterialsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-status-pending/10">
          <Package className="w-5 h-5 text-status-pending" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Material Approvals</h1>
          <p className="text-sm text-muted-foreground">Review and approve material requests</p>
        </div>
      </div>
      
      <MaterialApprovalWidget role="ceo" />
    </motion.div>
  );
}
