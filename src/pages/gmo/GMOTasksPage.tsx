import { motion } from 'framer-motion';
import { CheckSquare } from 'lucide-react';
import { TaskAssignmentWidget } from '@/components/TaskAssignmentWidget';

export default function GMOTasksPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <CheckSquare className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground">View and manage tasks assigned to you</p>
        </div>
      </div>
      
      <TaskAssignmentWidget title="Task Management" />
    </motion.div>
  );
}
