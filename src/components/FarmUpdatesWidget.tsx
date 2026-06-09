import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Leaf, Building2, AlertTriangle, CheckCircle2, Loader2, 
  RefreshCw, Filter, Calendar, User, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FarmUpdate {
  id: string;
  project_id: string;
  work_done: string;
  issues_faced: string | null;
  labor_count: number | null;
  progress_percentage: number | null;
  weather_conditions: string | null;
  update_date: string;
  created_at: string;
  project: { project_name: string; vertical: string };
  reporter: { name: string };
  remarks: { remark_type: string; remark_text: string; created_by_name: string }[];
}

interface HarvestSummary {
  project_name: string;
  crop_type: string;
  total_quantity: number;
  unit: string;
  quality_grades: string[];
}

interface FarmUpdatesWidgetProps {
  title?: string;
  maxHeight?: string;
}

export function FarmUpdatesWidget({ 
  title = "Farm Updates",
  maxHeight = "500px"
}: FarmUpdatesWidgetProps) {
  const [updates, setUpdates] = useState<FarmUpdate[]>([]);
  const [harvests, setHarvests] = useState<HarvestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState<'updates' | 'harvests'>('updates');

  const fetchUpdates = async () => {
    setIsLoading(true);
    try {
      // Fetch site updates with project and reporter info
      const query = supabase
        .from('daily_site_updates')
        .select(`
          *,
          project:projects(project_name, vertical),
          reporter:profiles(name)
        `)
        .gte('update_date', selectedDate)
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: updateData, error: updateError } = await query;
      if (updateError) throw updateError;

      // Fetch remarks for these updates
      const updateIds = updateData?.map(u => u.id) || [];
      let updatesWithRemarks: FarmUpdate[] = [];

      if (updateIds.length > 0) {
        const { data: remarkData } = await supabase
          .from('farm_manager_remarks')
          .select('site_update_id, remark_type, remark_text, created_by_name')
          .in('site_update_id', updateIds);

        updatesWithRemarks = (updateData || []).map(u => ({
          ...u,
          project: u.project || { project_name: 'Unknown', vertical: 'unknown' },
          reporter: u.reporter || { name: 'Unknown' },
          remarks: (remarkData || []).filter(r => r.site_update_id === u.id),
        })) as FarmUpdate[];
      }

      // Filter by vertical if selected
      if (selectedVertical !== 'all') {
        updatesWithRemarks = updatesWithRemarks.filter(u => 
          u.project?.vertical?.toLowerCase() === selectedVertical.toLowerCase()
        );
      }

      setUpdates(updatesWithRemarks);

      // Fetch harvest summaries
      const { data: harvestData, error: harvestError } = await supabase
        .from('harvest_records')
        .select(`
          quantity,
          unit,
          quality_grade,
          cycle:cultivation_cycles(crop_type),
          project:projects(project_name)
        `)
        .gte('harvest_date', selectedDate)
        .order('harvest_date', { ascending: false });

      if (!harvestError && harvestData) {
        // Group by project
        const harvestMap = new Map<string, HarvestSummary>();
        harvestData.forEach((h: any) => {
          const key = h.project?.project_name || 'Unknown';
          const existing = harvestMap.get(key);
          if (existing) {
            existing.total_quantity += h.quantity;
            if (h.quality_grade && !existing.quality_grades.includes(h.quality_grade)) {
              existing.quality_grades.push(h.quality_grade);
            }
          } else {
            harvestMap.set(key, {
              project_name: key,
              crop_type: h.cycle?.crop_type || 'Unknown',
              total_quantity: h.quantity,
              unit: h.unit,
              quality_grades: h.quality_grade ? [h.quality_grade] : [],
            });
          }
        });
        setHarvests(Array.from(harvestMap.values()));
      }
    } catch (error) {
      console.error('Error fetching farm updates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [selectedVertical, selectedDate]);

  const issueCount = updates.filter(u => u.issues_faced).length;
  const verifiedCount = updates.filter(u => u.remarks?.some(r => r.remark_type === 'verified')).length;

  return (
    <Card className="border-border/50">
      <CardHeader className="py-4 px-5 border-b border-border/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Leaf className="h-4 w-4 text-green-500" />
            </div>
            {title}
            <Badge variant="secondary" className="ml-2">{updates.length}</Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedVertical} onValueChange={setSelectedVertical}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verticals</SelectItem>
                <SelectItem value="agri">Agri</SelectItem>
                <SelectItem value="civil">Civil</SelectItem>
              </SelectContent>
            </Select>
            
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 px-2 text-xs border border-input rounded-md bg-background"
            />
            
            <Button variant="ghost" size="sm" onClick={fetchUpdates} className="h-8 px-2">
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            {issueCount} with issues
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            {verifiedCount} verified
          </span>
          <span className="flex items-center gap-1">
            <Leaf className="w-3 h-3 text-emerald-500" />
            {harvests.length} harvests
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'updates' | 'harvests')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="updates">Site Updates</TabsTrigger>
            <TabsTrigger value="harvests">Harvest Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="updates">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : updates.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Leaf className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No updates for selected date</p>
              </div>
            ) : (
              <ScrollArea style={{ height: maxHeight }}>
                <div className="space-y-3">
                  {updates.map((update, index) => (
                    <motion.div
                      key={update.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-lg border border-border/30 bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-xs">
                              {update.project?.project_name}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                update.project?.vertical?.toLowerCase() === 'agri' 
                                  ? "bg-green-500/10 text-green-500 border-green-500/30"
                                  : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                              )}
                            >
                              {update.project?.vertical?.toLowerCase() === 'agri' ? (
                                <Leaf className="w-3 h-3 mr-1" />
                              ) : (
                                <Building2 className="w-3 h-3 mr-1" />
                              )}
                              {update.project?.vertical}
                            </Badge>
                            {update.remarks?.some(r => r.remark_type === 'verified') && (
                              <Badge className="bg-green-500/20 text-green-500 border-0 text-xs">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{update.work_done}</p>
                        </div>
                      </div>

                      {update.issues_faced && (
                        <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 text-amber-500 text-sm mb-2">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{update.issues_faced}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {update.reporter?.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(update.created_at), 'MMM d, h:mm a')}
                          </span>
                          {update.labor_count && (
                            <span>👷 {update.labor_count}</span>
                          )}
                          {update.progress_percentage && (
                            <span>📊 {update.progress_percentage}%</span>
                          )}
                        </div>
                      </div>

                      {/* Verification Remarks */}
                      {update.remarks && update.remarks.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/30">
                          {update.remarks.map((remark, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <Badge variant="outline" className={cn(
                                "text-[10px]",
                                remark.remark_type === 'verified' && "bg-green-500/10 text-green-500",
                                remark.remark_type === 'followed_up' && "bg-blue-500/10 text-blue-500",
                                remark.remark_type === 'needs_attention' && "bg-amber-500/10 text-amber-500",
                              )}>
                                {remark.remark_type}
                              </Badge>
                              <span className="text-muted-foreground">
                                {remark.remark_text || 'No comment'} - {remark.created_by_name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          
          <TabsContent value="harvests">
            {harvests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Leaf className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No harvests recorded yet</p>
              </div>
            ) : (
              <ScrollArea style={{ height: maxHeight }}>
                <div className="space-y-3">
                  {harvests.map((harvest, index) => (
                    <motion.div
                      key={harvest.project_name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-lg border border-border/30 bg-card"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Leaf className="w-5 h-5 text-green-500" />
                          <span className="font-medium">{harvest.project_name}</span>
                        </div>
                        <Badge variant="outline" className="bg-green-500/10 text-green-500">
                          {harvest.crop_type}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-green-500">
                          {harvest.total_quantity.toLocaleString()} {harvest.unit}
                        </span>
                        <div className="flex gap-1">
                          {harvest.quality_grades.map(grade => (
                            <Badge key={grade} variant="secondary" className="text-xs">
                              {grade}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
