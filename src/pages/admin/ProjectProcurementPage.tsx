
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useProjects } from '@/hooks/useProjects';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { ProcurementStatsGrid } from '@/components/purchase/ProcurementStatsGrid';
import { ProjectProcurementList } from '@/components/purchase/ProjectProcurementList';
import { ProcurementOrderDrawer } from '@/components/purchase/ProcurementOrderDrawer';

export default function ProjectProcurementPage() {
  const { requests } = useMaterialRequests();
  const { projects } = useProjects();
  const { quotes } = useVendorQuotes();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Group requests by project & Calculate Stats
  const { projectGroups, overallStats } = useMemo(() => {
    const grouped: Record<string, any> = {};
    const stats = { totalValue: 0, ordered: 0, inTransit: 0, delivered: 0, delayed: 0 };

    requests.forEach(req => {
      if (!req.project_id) return;

      // Apply filters
      if (statusFilter !== 'all' && req.order_status !== statusFilter) return;
      if (searchTerm && !req.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase())) return;

      if (!grouped[req.project_id]) {
        const project = projects.find(p => p.id === req.project_id);
        grouped[req.project_id] = {
          project: project || { project_name: 'Unknown', project_id: req.project_id },
          requests: [],
          stats: { total: 0, ordered: 0, inTransit: 0, delivered: 0, totalValue: 0 },
        };
      }

      grouped[req.project_id].requests.push({ ...req, vendor: quotes.find(q => q.id === req.selected_quote_id) });
      grouped[req.project_id].stats.total++;

      if (req.order_status === 'ordered' || req.order_status === 'loading') {
        grouped[req.project_id].stats.ordered++;
        stats.ordered++;
      } else if (req.order_status === 'shipped' || req.order_status === 'unloading') {
        grouped[req.project_id].stats.inTransit++;
        stats.inTransit++;
      } else if (req.order_status === 'delivered') {
        grouped[req.project_id].stats.delivered++;
        stats.delivered++;
      } else if (req.order_status === 'delayed') {
        stats.delayed++;
      }

      // Add quote value
      const quote = quotes.find(q => q.id === req.selected_quote_id);
      if (quote?.quoted_total) {
        grouped[req.project_id].stats.totalValue += quote.quoted_total;
        stats.totalValue += quote.quoted_total;
      }
    });

    return {
      projectGroups: Object.values(grouped).sort((a: any, b: any) => (b.stats.total - a.stats.total)),
      overallStats: stats
    };
  }, [requests, projects, quotes, searchTerm, statusFilter]);

  return (
    <div className="min-h-screen bg-background/50 p-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6"
      >
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            PROCUREMENT <span className="text-violet-500">COMMAND</span>
          </h1>
          <p className="text-muted-foreground mt-1">Real-time logistics & supply chain intelligence</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-400 transition-colors" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full sm:w-64 bg-black/20 border-white/10 focus:border-violet-500/50 focus:ring-violet-500/20 transition-all rounded-lg"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-black/20 border-white/10">
              <Filter className="w-4 h-4 mr-2 text-violet-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="shipped">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="delayed">Delayed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-white/10 hover:bg-white/5">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </motion.div>

      {/* KPI Grid */}
      <ProcurementStatsGrid stats={overallStats} />

      {/* Main Content */}
      <div className="grid lg:grid-cols-1 gap-6">
        <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              Active Projects
              <span className="text-sm font-normal text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full ml-2">
                {projectGroups.length}
              </span>
            </h2>
          </div>

          <ProjectProcurementList
            projects={projectGroups}
            onSelectOrder={setSelectedOrder}
          />
        </div>
      </div>

      {/* Drawer */}
      <ProcurementOrderDrawer
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
      />
    </div>
  );
}
