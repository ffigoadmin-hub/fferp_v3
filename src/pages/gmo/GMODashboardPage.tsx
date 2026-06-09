import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  RefreshCw, Shield, FolderKanban,
  ArrowRight, Bell
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeviationApprovalsWidget } from '@/components/engineering/DeviationApprovalsWidget';
import { PurchaseUpdatesWidget } from '@/components/purchase/PurchaseUpdatesWidget';
import { WorkOrderMonitoringWidget } from '@/components/WorkOrderMonitoringWidget';
import { SiteUpdatesWidget } from '@/components/monitoring/SiteUpdatesWidget';
import { BOQPipelineWidget } from '@/components/monitoring/BOQPipelineWidget';
import { DeliveryTrackingWidget } from '@/components/inventory/DeliveryTrackingWidget';
import { UniversalCommandCenter } from '@/components/shared/UniversalCommandCenter';

import GMONewDealsPage from './GMONewDealsPage';
import GMOEngineeringProjectsPage from './GMOEngineeringProjectsPage';

export default function GMODashboardPage() {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [activeTab, setActiveTab] = useState('new-deals');
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  // Real-time subscription for dashboard refresh or specific notifications can be added here if needed
  // For now, we rely on widget-level data fetching and real-time updates

  // Auto-refresh last updated timestamp every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">GMO Dashboard</h1>
            <p className="text-muted-foreground">General Manager Operations - Projects & Tasks Overview</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <Bell className="w-3 h-3 mr-1" />
              {unreadCount} new
            </Badge>
          )}
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
            LIVE
          </Badge>
          <span className="hidden sm:flex items-center gap-1 text-xs">
            <RefreshCw className="w-3 h-3" />
            {format(lastUpdated, 'HH:mm:ss')}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">

        {/* Route to Personal Command Center */}
        <div className="flex justify-start">
          <Link to="/dashboard/my-escalations">
            <Button className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)] gap-2 h-12 px-6 text-sm font-bold uppercase tracking-wider rounded-xl transition-all group">
              <Shield className="w-4 h-4" />
              Open My Command Center
              <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Deviation Approvals for GMO */}
        <DeviationApprovalsWidget role="gmo" />

        {/* Project Pipeline Tabs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-primary" />
              Project Pipeline
            </h2>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
              <TabsTrigger value="new-deals">New Deals</TabsTrigger>
              <TabsTrigger value="engineering">Engineering</TabsTrigger>
              <TabsTrigger value="escalations">My Escalations</TabsTrigger>
            </TabsList>
            <TabsContent value="new-deals" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <Card>
                <CardContent className="p-0">
                  {activeTab === 'new-deals' && <GMONewDealsPage />}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="engineering" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <Card>
                <CardContent className="p-0">
                  {activeTab === 'engineering' && <GMOEngineeringProjectsPage />}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="escalations" className="mt-4 focus-visible:outline-none focus-visible:ring-0">
              <Card>
                <CardContent className="p-0">
                  {activeTab === 'escalations' && <UniversalCommandCenter roleOverride="gmo" />}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Work Order Monitoring */}
        <WorkOrderMonitoringWidget role="gmo" showApprovalActions={true} />

        {/* Purchase Updates Widget */}
        <PurchaseUpdatesWidget />

        {/* New Monitoring Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SiteUpdatesWidget compact />
          <BOQPipelineWidget compact maxItems={5} />
        </div>

        <DeliveryTrackingWidget />
      </div>
    </motion.div>
  );
}
