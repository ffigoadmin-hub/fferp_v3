import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, Calendar, Users, AlertTriangle, Cloud, 
  Eye, Building2, Clock, ImageIcon, CheckCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface SiteUpdate {
  id: string;
  project_id: string;
  work_done: string;
  labor_count: number;
  progress_percentage: number;
  issues_faced: string | null;
  weather_conditions: string | null;
  update_date: string;
  created_at: string;
  photos: string[] | null;
  project?: { project_name: string; project_id: string };
  reporter?: { name: string };
}

interface SiteUpdatesWidgetProps {
  className?: string;
  projectId?: string;
  compact?: boolean;
}

export function SiteUpdatesWidget({ className, projectId, compact = false }: SiteUpdatesWidgetProps) {
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today');

  const fetchUpdates = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('daily_site_updates')
        .select(`
          *,
          project:projects(project_name, project_id),
          reporter:profiles!daily_site_updates_reported_by_fkey(name)
        `)
        .order('update_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUpdates((data || []) as SiteUpdate[]);
    } catch (error) {
      console.error('Error fetching site updates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [projectId]);

  const todayUpdates = updates.filter(u => {
    const updateDate = u.update_date || u.created_at;
    return isToday(parseISO(updateDate));
  });

  const recentUpdates = updates.slice(0, 20);

  // Summary stats
  const totalLaborToday = todayUpdates.reduce((sum, u) => sum + (u.labor_count || 0), 0);
  const projectsUpdatedToday = new Set(todayUpdates.map(u => u.project_id)).size;
  const issuesReportedToday = todayUpdates.filter(u => u.issues_faced).length;

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-5 h-5 text-primary" />
            Site Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  const UpdateCard = ({ update }: { update: SiteUpdate }) => (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium text-sm truncate">
              {update.project?.project_name || 'Unknown Project'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            by {update.reporter?.name || 'Unknown'} • {format(parseISO(update.update_date || update.created_at), 'dd MMM, hh:mm a')}
          </p>
        </div>
        {update.progress_percentage > 0 && (
          <Badge variant="outline" className="shrink-0">
            {update.progress_percentage}%
          </Badge>
        )}
      </div>

      <p className="text-sm line-clamp-2 mb-2">{update.work_done}</p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {update.labor_count > 0 && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {update.labor_count}
          </div>
        )}
        {update.weather_conditions && (
          <div className="flex items-center gap-1">
            <Cloud className="w-3 h-3" />
            {update.weather_conditions}
          </div>
        )}
        {update.photos && update.photos.length > 0 && (
          <div className="flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            {update.photos.length}
          </div>
        )}
      </div>

      {update.issues_faced && (
        <div className="flex items-start gap-2 mt-2 p-2 rounded bg-amber-500/10 text-amber-600 text-xs">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="line-clamp-1">{update.issues_faced}</span>
        </div>
      )}
    </motion.div>
  );

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Site Updates
          </div>
          <Badge variant="outline">{updates.length} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Summary */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 text-center"
          >
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{projectsUpdatedToday}</p>
            <p className="text-xs text-blue-600/70">Sites Updated</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 text-center"
          >
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{totalLaborToday}</p>
            <p className="text-xs text-green-600/70">Total Labor</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800 text-center"
          >
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{issuesReportedToday}</p>
            <p className="text-xs text-amber-600/70">Issues</p>
          </motion.div>
        </div>

        {!compact && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="today" className="gap-1">
                <Clock className="w-3 h-3" />
                Today ({todayUpdates.length})
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-1">
                <Calendar className="w-3 h-3" />
                Recent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-3">
              <ScrollArea className="h-[300px]">
                {todayUpdates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MapPin className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">No updates today</p>
                  </div>
                ) : (
                  <div className="space-y-3 pr-4">
                    {todayUpdates.map((update) => (
                      <UpdateCard key={update.id} update={update} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="recent" className="mt-3">
              <ScrollArea className="h-[300px]">
                {recentUpdates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MapPin className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-sm">No recent updates</p>
                  </div>
                ) : (
                  <div className="space-y-3 pr-4">
                    {recentUpdates.map((update) => (
                      <UpdateCard key={update.id} update={update} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
