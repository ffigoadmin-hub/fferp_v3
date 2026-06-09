import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { EmployeeActivityWidget } from '@/components/EmployeeActivityWidget';

import ActivityLedgerExportWidget from '@/components/ActivityLedgerExportWidget';

export default function EmployeeActivityPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 p-6"
        >
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                    <Activity className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Employee Activity</h1>
                    <p className="text-muted-foreground">Real-time employee activity monitor</p>
                </div>
            </div>

            <ActivityLedgerExportWidget />
            <EmployeeActivityWidget title="All Employee Activity" />
        </motion.div>
    );
}
