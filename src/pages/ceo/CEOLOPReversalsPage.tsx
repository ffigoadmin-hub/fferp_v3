import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { LOPReversalApprovalWidget } from '@/components/LOPReversalApprovalWidget';

export default function CEOLOPReversalsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-destructive/10">
          <RotateCcw className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-bold">LOP Reversal Requests</h1>
          <p className="text-sm text-muted-foreground">Review and approve LOP reversal requests</p>
        </div>
      </div>
      
      <LOPReversalApprovalWidget role="ceo" />
    </motion.div>
  );
}
