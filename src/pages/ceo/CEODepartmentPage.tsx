import { motion } from 'framer-motion';
import { CEODepartmentAnalytics } from '@/components/CEODepartmentAnalytics';

export function CEODepartmentPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <CEODepartmentAnalytics />
    </motion.div>
  );
}
