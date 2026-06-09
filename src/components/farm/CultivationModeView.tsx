import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Leaf, Droplets, Bug, Scissors, Package, Calendar, TrendingUp, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useCultivationCycles, CultivationCycle } from '@/hooks/useCultivationCycles';
import { useDailyFarmLogs } from '@/hooks/useDailyFarmLogs';
import { useHarvestRecords } from '@/hooks/useHarvestRecords';
import { Project } from '@/hooks/useProjects';

interface CultivationModeViewProps {
  projects: Project[];
  selectedProjectId: string;
  cycles: CultivationCycle[];
  logs: any[];
}

const activityIcons: Record<string, any> = {
  watering: Droplets,
  fertilizing: Package,
  pest_control: Bug,
  pruning: Scissors,
  harvesting: Package,
  maintenance: Scissors,
  inspection: CheckCircle2,
  planting: Leaf,
  other: Calendar,
};

const stageColors: Record<string, string> = {
  germination: 'bg-yellow-500',
  seedling: 'bg-lime-500',
  vegetative: 'bg-green-500',
  flowering: 'bg-pink-500',
  fruiting: 'bg-orange-500',
  harvest: 'bg-amber-500',
  post_harvest: 'bg-gray-500',
};

export default function CultivationModeView({ projects, selectedProjectId, cycles, logs }: CultivationModeViewProps) {
  const { user } = useAuth();
  const [showLogForm, setShowLogForm] = useState(false);
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [showHarvestForm, setShowHarvestForm] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');

  const { createCycle } = useCultivationCycles();
  const { createLog } = useDailyFarmLogs();
  const { createRecord, records } = useHarvestRecords(selectedProjectId !== 'all' ? selectedProjectId : undefined);

  const [newLog, setNewLog] = useState({
    project_id: '',
    cycle_id: '',
    activity_type: 'inspection' as const,
    activity_details: '',
    quantity_used: {},
    weather_data: { temp: '', humidity: '', rainfall: '' },
    issues_reported: '',
  });

  const [newCycle, setNewCycle] = useState({
    project_id: '',
    cycle_name: '',
    crop_type: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    expected_harvest_date: '',
  });

  const [newHarvest, setNewHarvest] = useState({
    cycle_id: '',
    project_id: '',
    quantity: 0,
    unit: 'kg',
    quality_grade: 'A' as 'A' | 'B' | 'C' | 'rejected',
    notes: '',
  });

  const handleCreateLog = async () => {
    if (!user) return;
    await createLog({
      ...newLog,
      cycle_id: (newLog.cycle_id && newLog.cycle_id !== 'none') ? newLog.cycle_id : null,
      log_date: format(new Date(), 'yyyy-MM-dd'),
      reported_by: user.id,
      photos: [],
      environmental_readings: {},
      location_data: null,
    });
    setShowLogForm(false);
    setNewLog({
      project_id: '',
      cycle_id: '',
      activity_type: 'inspection',
      activity_details: '',
      quantity_used: {},
      weather_data: { temp: '', humidity: '', rainfall: '' },
      issues_reported: '',
    });
  };

  const handleCreateCycle = async () => {
    await createCycle({
      ...newCycle,
      expected_harvest_date: newCycle.expected_harvest_date || null,
      status: 'active',
      stage: 'germination',
      growing_conditions: {},
      notes: null,
      actual_harvest_date: null,
      created_by: user?.id || null,
    });
    setShowCycleForm(false);
  };

  const handleRecordHarvest = async () => {
    if (!user) return;
    await createRecord({
      ...newHarvest,
      harvest_date: format(new Date(), 'yyyy-MM-dd'),
      recorded_by: user.id,
    });
    setShowHarvestForm(false);
  };

  const activeCycles = cycles.filter(c => c.status === 'active');

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowCycleForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Cycle
        </Button>
        <Button onClick={() => setShowLogForm(true)} variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Add Daily Log
        </Button>
        <Button onClick={() => setShowHarvestForm(true)} variant="outline" className="gap-2">
          <Package className="h-4 w-4" />
          Record Harvest
        </Button>
      </div>

      <Tabs defaultValue="cycles" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="cycles">Active Cycles</TabsTrigger>
          <TabsTrigger value="logs">Daily Logs</TabsTrigger>
          <TabsTrigger value="harvests">Harvests</TabsTrigger>
        </TabsList>

        <TabsContent value="cycles" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCycles.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active cultivation cycles. Create one to get started.
                </CardContent>
              </Card>
            ) : (
              activeCycles.map(cycle => {
                const daysActive = differenceInDays(new Date(), new Date(cycle.start_date));
                const daysToHarvest = cycle.expected_harvest_date
                  ? differenceInDays(new Date(cycle.expected_harvest_date), new Date())
                  : null;

                return (
                  <Card key={cycle.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Leaf className="h-5 w-5 text-green-500" />
                            {cycle.cycle_name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">{cycle.crop_type}</p>
                        </div>
                        <Badge className={stageColors[cycle.stage]}>
                          {cycle.stage}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Days Active</p>
                            <p className="font-semibold">{daysActive} days</p>
                          </div>
                          {daysToHarvest !== null && (
                            <div>
                              <p className="text-muted-foreground">Days to Harvest</p>
                              <p className={`font-semibold ${daysToHarvest < 0 ? 'text-red-500' : daysToHarvest < 7 ? 'text-amber-500' : 'text-green-500'}`}>
                                {daysToHarvest < 0 ? `${Math.abs(daysToHarvest)} overdue` : `${daysToHarvest} days`}
                              </p>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Project: {cycle.project?.project_name || 'Unknown'}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setSelectedCycleId(cycle.id);
                            setNewLog(prev => ({ ...prev, cycle_id: cycle.id, project_id: cycle.project_id }));
                            setShowLogForm(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Activity
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Farm Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {logs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No logs found</p>
                  ) : (
                    logs.map(log => {
                      const Icon = activityIcons[log.activity_type] || Calendar;
                      return (
                        <div key={log.id} className="border rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium capitalize">{log.activity_type.replace('_', ' ')}</p>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(log.log_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{log.activity_details}</p>
                              {log.issues_reported && (
                                <p className="text-sm text-amber-600 mt-1">⚠️ {log.issues_reported}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                {log.cycle?.cycle_name && `Cycle: ${log.cycle.cycle_name} • `}
                                By: {log.reporter?.name || 'Unknown'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="harvests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Harvest Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {records.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No harvest records yet</p>
                  ) : (
                    records.map(record => (
                      <div key={record.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{record.cycle?.cycle_name || 'Unknown Cycle'}</p>
                            <p className="text-sm text-muted-foreground">{record.cycle?.crop_type}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{record.quantity} {record.unit}</p>
                            {record.quality_grade && (
                              <Badge variant={record.quality_grade === 'A' ? 'default' : record.quality_grade === 'rejected' ? 'destructive' : 'secondary'}>
                                Grade {record.quality_grade}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {format(new Date(record.harvest_date), 'MMM d, yyyy')} • By: {record.recorder?.name || 'Unknown'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Cycle Dialog */}
      <Dialog open={showCycleForm} onOpenChange={setShowCycleForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Cultivation Cycle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project</label>
              <Select value={newCycle.project_id} onValueChange={(v) => setNewCycle(prev => ({ ...prev, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Cycle Name</label>
              <Input
                value={newCycle.cycle_name}
                onChange={(e) => setNewCycle(prev => ({ ...prev, cycle_name: e.target.value }))}
                placeholder="e.g., Spring 2026 Batch 1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Crop Type</label>
              <Input
                value={newCycle.crop_type}
                onChange={(e) => setNewCycle(prev => ({ ...prev, crop_type: e.target.value }))}
                placeholder="e.g., Tomatoes, Microgreens"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={newCycle.start_date}
                  onChange={(e) => setNewCycle(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Expected Harvest</label>
                <Input
                  type="date"
                  value={newCycle.expected_harvest_date}
                  onChange={(e) => setNewCycle(prev => ({ ...prev, expected_harvest_date: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={handleCreateCycle} className="w-full">Create Cycle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Log Dialog */}
      <Dialog open={showLogForm} onOpenChange={setShowLogForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Daily Farm Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project</label>
              <Select value={newLog.project_id} onValueChange={(v) => setNewLog(prev => ({ ...prev, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Cycle (Optional)</label>
              <Select value={newLog.cycle_id} onValueChange={(v) => setNewLog(prev => ({ ...prev, cycle_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Cycle</SelectItem>
                  {cycles.filter(c => c.project_id === newLog.project_id || !newLog.project_id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.cycle_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Activity Type</label>
              <Select value={newLog.activity_type} onValueChange={(v: any) => setNewLog(prev => ({ ...prev, activity_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="watering">💧 Watering</SelectItem>
                  <SelectItem value="fertilizing">🌱 Fertilizing</SelectItem>
                  <SelectItem value="pest_control">🐛 Pest Control</SelectItem>
                  <SelectItem value="pruning">✂️ Pruning</SelectItem>
                  <SelectItem value="harvesting">📦 Harvesting</SelectItem>
                  <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                  <SelectItem value="inspection">✅ Inspection</SelectItem>
                  <SelectItem value="planting">🌿 Planting</SelectItem>
                  <SelectItem value="other">📝 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Activity Details</label>
              <Textarea
                value={newLog.activity_details}
                onChange={(e) => setNewLog(prev => ({ ...prev, activity_details: e.target.value }))}
                placeholder="Describe what was done..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Issues (Optional)</label>
              <Textarea
                value={newLog.issues_reported}
                onChange={(e) => setNewLog(prev => ({ ...prev, issues_reported: e.target.value }))}
                placeholder="Any problems observed..."
              />
            </div>
            <Button onClick={handleCreateLog} className="w-full" disabled={!newLog.project_id || !newLog.activity_details}>
              Add Log
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Harvest Record Dialog */}
      <Dialog open={showHarvestForm} onOpenChange={setShowHarvestForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Harvest</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Cycle</label>
              <Select value={newHarvest.cycle_id} onValueChange={(v) => {
                const cycle = cycles.find(c => c.id === v);
                setNewHarvest(prev => ({ ...prev, cycle_id: v, project_id: cycle?.project_id || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
                <SelectContent>
                  {cycles.filter(c => c.status === 'active').map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.cycle_name} - {c.crop_type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  value={newHarvest.quantity}
                  onChange={(e) => setNewHarvest(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Unit</label>
                <Select value={newHarvest.unit} onValueChange={(v) => setNewHarvest(prev => ({ ...prev, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="pieces">Pieces</SelectItem>
                    <SelectItem value="bunches">Bunches</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Quality Grade</label>
              <Select value={newHarvest.quality_grade} onValueChange={(v: any) => setNewHarvest(prev => ({ ...prev, quality_grade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Grade A (Premium)</SelectItem>
                  <SelectItem value="B">Grade B (Good)</SelectItem>
                  <SelectItem value="C">Grade C (Acceptable)</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newHarvest.notes}
                onChange={(e) => setNewHarvest(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any observations..."
              />
            </div>
            <Button onClick={handleRecordHarvest} className="w-full" disabled={!newHarvest.cycle_id || newHarvest.quantity <= 0}>
              Record Harvest
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
