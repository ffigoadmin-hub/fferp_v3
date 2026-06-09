import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useCultivationCycles } from '@/hooks/useCultivationCycles';
import { useDailyFarmLogs } from '@/hooks/useDailyFarmLogs';
import { useHarvestRecords } from '@/hooks/useHarvestRecords';
import { useDailySiteUpdates } from '@/hooks/useDailySiteUpdates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Construction, Leaf, TrendingUp, Calendar, Truck, Package } from 'lucide-react';
import { format } from 'date-fns';
import ConstructionModeView from '@/components/farm/ConstructionModeView';
import CultivationModeView from '@/components/farm/CultivationModeView';
import { DeliveryAuditWidget } from '@/components/farm/DeliveryAuditWidget';
import { DailyInventoryWidget } from '@/components/farm/DailyInventoryWidget';


type DashboardMode = 'construction' | 'cultivation';
type DashboardTab = 'work' | 'audit' | 'inventory';

export default function FarmManagerDashboard() {
  const { user } = useAuth();
  const [mode, setMode] = useState<DashboardMode>('construction');
  const [activeTab, setActiveTab] = useState<DashboardTab>('work');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const { projects } = useProjects();
  const { cycles } = useCultivationCycles(selectedProjectId !== 'all' ? selectedProjectId : undefined);
  const { logs } = useDailyFarmLogs(selectedProjectId !== 'all' ? selectedProjectId : undefined);
  const { updates } = useDailySiteUpdates(selectedProjectId !== 'all' ? selectedProjectId : undefined);
  const { totalYield } = useHarvestRecords(selectedProjectId !== 'all' ? selectedProjectId : undefined);

  // All projects for farm manager (filter can be added later based on assignment)
  const myProjects = projects;

  const activeCycles = cycles.filter(c => c.status === 'active').length;
  const todayLogs = logs.filter(l => l.log_date === format(new Date(), 'yyyy-MM-dd')).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Farm Manager Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Project Filter */}
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {myProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mode Switcher */}
            <div className="flex rounded-lg border bg-muted p-1">
              <Button
                variant={mode === 'construction' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('construction')}
                className="gap-2"
              >
                <Construction className="h-4 w-4" />
                Construction
              </Button>
              <Button
                variant={mode === 'cultivation' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('cultivation')}
                className="gap-2"
              >
                <Leaf className="h-4 w-4" />
                Cultivation
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Construction className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">My Projects</p>
                <p className="text-2xl font-bold">{myProjects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Leaf className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Cycles</p>
                <p className="text-2xl font-bold">{activeCycles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Logs</p>
                <p className="text-2xl font-bold">{todayLogs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Yield</p>
                <p className="text-2xl font-bold">{totalYield.toFixed(1)} kg</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="work" className="gap-2">
            <Construction className="w-4 h-4" />
            Daily Work
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Truck className="w-4 h-4" />
            Delivery Audit
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="w-4 h-4" />
            Inventory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="work" className="mt-6">
          <ScrollArea className="h-[calc(100vh-400px)]">
            {mode === 'construction' ? (
              <ConstructionModeView 
                projects={myProjects} 
                selectedProjectId={selectedProjectId}
                updates={updates}
              />
            ) : (
              <CultivationModeView 
                projects={myProjects}
                selectedProjectId={selectedProjectId}
                cycles={cycles}
                logs={logs}
              />
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <DeliveryAuditWidget />
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <DailyInventoryWidget projectId={selectedProjectId !== 'all' ? selectedProjectId : undefined} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
