import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Plus, Clock, CheckCircle2, AlertCircle, Loader2, Calendar, 
  Send, FileText, MessageSquare, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDailySiteUpdates, DailySiteUpdate } from '@/hooks/useDailySiteUpdates';
import { useProjectTimeline } from '@/hooks/useProjectTimeline';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ProjectDailyLogsWidgetProps {
  projectId: string;
  phases: { id: string; phase_name: string }[];
  canEdit?: boolean;
  userRole?: string;
}

export function ProjectDailyLogsWidget({ 
  projectId, 
  phases, 
  canEdit = false,
  userRole = 'engineer'
}: ProjectDailyLogsWidgetProps) {
  const { updates, isLoading, isSaving, createUpdate } = useDailySiteUpdates(projectId);
  const { refetch: refetchTimeline } = useProjectTimeline(projectId);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemarkDialog, setShowRemarkDialog] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<DailySiteUpdate | null>(null);
  const [expandedDates, setExpandedDates] = useState<string[]>([format(new Date(), 'yyyy-MM-dd')]);

  const [newUpdate, setNewUpdate] = useState({
    phase_id: '',
    work_done: '',
    issues_faced: '',
    labor_count: 0,
    progress_percentage: 0,
    weather_conditions: '',
  });

  const [remark, setRemark] = useState('');

  const handleSubmitUpdate = async () => {
    if (!newUpdate.work_done.trim()) return;

    await createUpdate({
      project_id: projectId,
      phase_id: newUpdate.phase_id || undefined,
      work_done: newUpdate.work_done,
      issues_faced: newUpdate.issues_faced || undefined,
      labor_count: newUpdate.labor_count || undefined,
      progress_percentage: newUpdate.progress_percentage || undefined,
      weather_conditions: newUpdate.weather_conditions || undefined,
    });

    setNewUpdate({
      phase_id: '',
      work_done: '',
      issues_faced: '',
      labor_count: 0,
      progress_percentage: 0,
      weather_conditions: '',
    });
    setShowAddDialog(false);
    refetchTimeline();
  };

  const handleAddRemark = async () => {
    if (!selectedUpdate || !remark.trim()) return;

    // TODO: This would typically add a remark to the update and project timeline
    // For now, we'll just close the dialog
    setShowRemarkDialog(false);
    setSelectedUpdate(null);
    setRemark('');
    refetchTimeline();
  };

  const toggleDate = (date: string) => {
    setExpandedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  // Group updates by date
  const groupedUpdates = updates.reduce((acc, update) => {
    const date = update.update_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(update);
    return acc;
  }, {} as Record<string, DailySiteUpdate[]>);

  const sortedDates = Object.keys(groupedUpdates).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="py-4 px-5 border-b border-border/30 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            Daily Site Updates
            <Badge variant="secondary" className="ml-2">{updates.length}</Badge>
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Update
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4">
          {sortedDates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">No updates yet</p>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add First Update
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {sortedDates.map((date) => (
                  <Collapsible 
                    key={date} 
                    open={expandedDates.includes(date)}
                    onOpenChange={() => toggleDate(date)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{format(new Date(date), 'EEEE, MMMM d, yyyy')}</span>
                          <Badge variant="outline" className="text-xs">
                            {groupedUpdates[date].length} updates
                          </Badge>
                        </div>
                        {expandedDates.includes(date) ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <AnimatePresence>
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 space-y-2"
                        >
                          {groupedUpdates[date].map((update) => (
                            <div 
                              key={update.id}
                              className="p-4 rounded-lg border border-border/30 bg-card hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    {update.phase?.phase_name && (
                                      <Badge variant="outline" className="text-xs">
                                        {update.phase.phase_name}
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(update.created_at), 'h:mm a')}
                                    </span>
                                    {update.reporter?.name && (
                                      <span className="text-xs text-muted-foreground">
                                        by {update.reporter.name}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Work Done
                                      </p>
                                      <p className="text-sm">{update.work_done}</p>
                                    </div>

                                    {update.issues_faced && (
                                      <div>
                                        <p className="text-xs font-medium text-amber-400 mb-1 flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" />
                                          Issues Faced
                                        </p>
                                        <p className="text-sm text-muted-foreground">{update.issues_faced}</p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                    {update.labor_count > 0 && (
                                      <span>👷 {update.labor_count} workers</span>
                                    )}
                                    {update.progress_percentage > 0 && (
                                      <span>📊 {update.progress_percentage}% progress</span>
                                    )}
                                    {update.weather_conditions && (
                                      <span>🌤️ {update.weather_conditions}</span>
                                    )}
                                  </div>
                                </div>

                                {(userRole === 'farm_manager' || userRole === 'gmo' || userRole === 'smo') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUpdate(update);
                                      setShowRemarkDialog(true);
                                    }}
                                    className="gap-1.5"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                    Remark
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      </AnimatePresence>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add Update Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Add Daily Update
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Phase (optional)</Label>
              <Select 
                value={newUpdate.phase_id || 'none'} 
                onValueChange={(v) => setNewUpdate({ ...newUpdate, phase_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General Update</SelectItem>
                  {phases.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Work Done Today *</Label>
              <Textarea
                value={newUpdate.work_done}
                onChange={(e) => setNewUpdate({ ...newUpdate, work_done: e.target.value })}
                placeholder="Describe what was completed today..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label>Issues Faced</Label>
              <Textarea
                value={newUpdate.issues_faced}
                onChange={(e) => setNewUpdate({ ...newUpdate, issues_faced: e.target.value })}
                placeholder="Any problems or blockers..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Labor Count</Label>
                <Input
                  type="number"
                  value={newUpdate.labor_count}
                  onChange={(e) => setNewUpdate({ ...newUpdate, labor_count: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Progress %</Label>
                <Input
                  type="number"
                  value={newUpdate.progress_percentage}
                  onChange={(e) => setNewUpdate({ ...newUpdate, progress_percentage: Number(e.target.value) })}
                  max={100}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Weather</Label>
                <Input
                  value={newUpdate.weather_conditions}
                  onChange={(e) => setNewUpdate({ ...newUpdate, weather_conditions: e.target.value })}
                  placeholder="Sunny, Rain..."
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitUpdate} 
              disabled={isSaving || !newUpdate.work_done.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Update
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Remark Dialog (for Farm Manager) */}
      <Dialog open={showRemarkDialog} onOpenChange={setShowRemarkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Add Verification Remark
            </DialogTitle>
          </DialogHeader>

          {selectedUpdate && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">{selectedUpdate.work_done}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(selectedUpdate.created_at), 'MMM d, h:mm a')}
                </p>
              </div>

              <div>
                <Label>Your Remark *</Label>
                <Textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Add verification notes, follow-up actions..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setRemark('Verified ✓');
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Verified
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setRemark('Followed up - ');
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Followed Up
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemarkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRemark} disabled={!remark.trim()}>
              Add Remark
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
