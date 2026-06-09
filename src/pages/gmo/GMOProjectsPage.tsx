import { motion } from 'framer-motion';
import { FolderKanban } from 'lucide-react';
import { GMOProjectsWidget } from '@/components/gmo/GMOProjectsWidget';

export default function GMOProjectsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <FolderKanban className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Civil Infrastructure Command</h1>
          <p className="text-muted-foreground">Monitor and manage all engineering projects</p>
        </div>
      </div>

      <GMOProjectsWidget />
    </motion.div>
  );
}
