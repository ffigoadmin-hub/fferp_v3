import { motion } from 'framer-motion';
import { Wrench, Users } from 'lucide-react';
import { EmployeeActivityWidget } from '@/components/EmployeeActivityWidget';
import { TaskAssignmentWidget } from '@/components/TaskAssignmentWidget';

const ENGINEERING_DEPARTMENTS = ['engineering', 'eng', 'civil'];

export default function GMOEngineeringTeamPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Wrench className="h-6 w-6 text-primary" />
                        Engineering Team Monitor
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Track daily activities, login times, hourly plans/reports, and EOD status for the engineering department
                    </p>
                </div>
            </div>

            {/* Employee Activity Monitor — filtered to Engineering */}
            <EmployeeActivityWidget
                title="Engineering Team Activity"
                filterDepartments={ENGINEERING_DEPARTMENTS}
            />

            {/* Task Assignment — restricted to Engineering */}
            <div className="mt-6">
                <TaskAssignmentWidget
                    title="Assign Tasks to Engineering Team"
                    restrictDepartments={ENGINEERING_DEPARTMENTS}
                />
            </div>
        </motion.div>
    );
}
