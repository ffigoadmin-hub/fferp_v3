import { motion } from 'framer-motion';
import { FolderKanban, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SMOProjectsWidget } from '@/components/smo/SMOProjectsWidget';
import { EmployeeProjectsPage } from '@/pages/employee/EmployeeProjectsPage';

export default function SMOProjectsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-8 max-w-[1600px] mx-auto p-6 lg:p-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border pb-6">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center border border-border shadow-sm">
            <FolderKanban className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Project Execution</h1>
            <p className="text-muted-foreground text-sm font-medium flex items-center gap-2 mt-1">
              <Activity className="w-4 h-4 text-emerald-500" />
              Live Operational Intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs px-3 py-1 bg-card border-border text-muted-foreground shadow-sm font-medium">
            v2.5.0 Pro
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="managing" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="managing" className="px-6 py-2">
            <FolderKanban className="w-4 h-4 mr-2" />
            Managing Projects
          </TabsTrigger>
          <TabsTrigger value="engineering" className="px-6 py-2">
            <Activity className="w-4 h-4 mr-2" />
            Engineering Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="managing" className="mt-0">
          <SMOProjectsWidget />
        </TabsContent>

        <TabsContent value="engineering" className="mt-0">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <EmployeeProjectsPage embedded={true} />
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
