import { motion } from 'framer-motion';
import { UniversalCommandCenter } from '@/components/shared/UniversalCommandCenter';

export default function UnifiedEscalationsPage() {
  return (
    <div className="container mx-auto py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <UniversalCommandCenter />
      </motion.div>
    </div>
  );
}
