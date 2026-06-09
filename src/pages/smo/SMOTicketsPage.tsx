import { motion } from 'framer-motion';
import { UniversalCommandCenter } from '@/components/shared/UniversalCommandCenter';

export default function SMOTicketsPage() {
  return (
    <div className="container mx-auto py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <UniversalCommandCenter roleOverride="smo" />
      </motion.div>
    </div>
  );
}
