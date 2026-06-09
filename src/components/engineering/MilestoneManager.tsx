import { useState } from 'react';
import { format, differenceInDays, isPast } from 'date-fns';
import { Plus, Flag, Calendar, AlertTriangle, Clock, CheckCircle2, Loader2, Send, Trash2, ChevronDown, ChevronUp, MapPin, Target, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useMilestones, useDeviationRequests, Milestone } from '@/hooks/useMilestones';
import { cn } from '@/lib/utils';

interface MilestoneManagerProps {
  projectId: string;
  phases: { id: string; phase_name: string }[];
}

export function MilestoneManager({ projectId, phases }: MilestoneManagerProps) {
  const { milestones, isLoading, isSaving, addMilestone, updateMilestone, deleteMilestone } = useMilestones(projectId);
  const { requests, createRequest, isSaving: isRequestSaving } = useDeviationRequests(projectId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeviationDialog, setShowDeviationDialog] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [progress, setProgress] = useState([0]);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);

  const [newMilestone, setNewMilestone] = useState({
    milestone_name: '',
    description: '',
    planned_date: '',
    phase_id: '',
  });

  const [deviationForm, setDeviationForm] = useState({
    new_proposed_date: '',
    reason: '',
  });

  const handleAddMilestone = async () => {
    if (!newMilestone.milestone_name || !newMilestone.planned_date) return;

    await addMilestone({
      project_id: projectId,
      phase_id: newMilestone.phase_id || null,
      milestone_name: newMilestone.milestone_name,
      description: newMilestone.description || null,
      planned_date: newMilestone.planned_date,
      actual_date: null,
      status: 'pending',
      completion_percentage: 0,
    });

    setNewMilestone({ milestone_name: '', description: '', planned_date: '', phase_id: '' });
    setShowAddDialog(false);
  };

  const handleUpdateProgress = async (milestone: Milestone) => {
    const newProgress = progress[0];
    const updates: Partial<Milestone> = {
      completion_percentage: newProgress,
      status: newProgress === 100 ? 'completed' : newProgress > 0 ? 'in_progress' : 'pending',
    };

    if (newProgress === 100) {
      updates.actual_date = new Date().toISOString().split('T')[0];
    }

    await updateMilestone(milestone.id, updates);
    setSelectedMilestone(null);
  };

  const handleRequestDeviation = async () => {
    if (!selectedMilestone || !deviationForm.new_proposed_date || !deviationForm.reason) return;

    await createRequest({
      milestone_id: selectedMilestone.id,
      project_id: projectId,
      original_date: selectedMilestone.planned_date,
      new_proposed_date: deviationForm.new_proposed_date,
      reason: deviationForm.reason,
    });

    setDeviationForm({ new_proposed_date: '', reason: '' });
    setShowDeviationDialog(false);
    setSelectedMilestone(null);
  };

  const openDeviationRequest = (milestone: Milestone) => {
    setSelectedMilestone(milestone);
    setShowDeviationDialog(true);
  };

  const openProgressUpdate = (milestone: Milestone) => {
    setSelectedMilestone(milestone);
    setProgress([milestone.completion_percentage]);
  };

  const getMilestoneStatus = (milestone: Milestone) => {
    if (milestone.status === 'completed' as string) return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Completed', ring: 'ring-emerald-500/30' };

    const plannedDate = new Date(milestone.planned_date);
    const isOverdue = isPast(plannedDate) && milestone.status !== 'completed';
    if (isOverdue) return { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'Overdue', ring: 'ring-rose-500/30' };
    const daysUntil = differenceInDays(plannedDate, new Date());
    if (daysUntil <= 3) return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: `${daysUntil}d left`, ring: 'ring-amber-500/30' };
    return { icon: Calendar, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', label: format(plannedDate, 'MMM d'), ring: 'ring-primary/30' };
  };

  const getPendingRequest = (milestoneId: string) => {
    return requests.find(r => r.milestone_id === milestoneId && !['approved', 'rejected'].includes(r.status));
  };

  // Summary stats
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const overdueCount = milestones.filter(m => {
    const planned = new Date(m.planned_date);
    return isPast(planned) && m.status !== 'completed';
  }).length;
  const overallProgress = milestones.length > 0
    ? Math.round(milestones.reduce((sum, m) => sum + m.completion_percentage, 0) / milestones.length)
    : 0;

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Summary Bar */}
        {milestones.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Total</p>
                  <p className="text-lg font-bold">{milestones.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Done</p>
                  <p className="text-lg font-bold text-emerald-500">{completedCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Overdue</p>
                  <p className="text-lg font-bold text-rose-500">{overdueCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Deviations</p>
                  <p className="text-lg font-bold text-amber-500">{requests.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Progress</p>
                  <p className="text-lg font-bold text-blue-500">{overallProgress}%</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Milestones List */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-5 border-b border-border/30">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Flag className="w-4 h-4 text-primary" />
              Milestones ({milestones.length})
            </CardTitle>
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="h-8 text-xs gap-1">
              <Plus className="w-3 h-3" /> Add Milestone
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {milestones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <Flag className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">No milestones defined</p>
                <p className="text-xs text-muted-foreground/60">Add milestones to track project progress</p>
                <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)} className="mt-2 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Create First Milestone
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {milestones.map((milestone, index) => {
                  const status = getMilestoneStatus(milestone);
                  const StatusIcon = status.icon;
                  const pendingRequest = getPendingRequest(milestone.id);
                  const phaseName = phases.find(p => p.id === milestone.phase_id)?.phase_name;
                  const isExpanded = expandedMilestone === milestone.id;
                  const deviationForMilestone = requests.filter(r => r.milestone_id === milestone.id);

                  return (
                    <div
                      key={milestone.id}
                      className={cn(
                        "transition-colors",
                        isExpanded && "bg-muted/20"
                      )}
                    >
                      {/* Main Row */}
                      <div className="p-4 flex items-center gap-3">
                        {/* Status Indicator */}
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                          status.bg, status.border
                        )}>
                          <StatusIcon className={cn("w-5 h-5", status.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold truncate">{milestone.milestone_name}</h4>
                            {phaseName && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5">{phaseName}</Badge>
                            )}
                            {pendingRequest && (
                              <Badge className="text-[9px] h-4 px-1.5 bg-amber-600 text-white">
                                ⏳ Deviation Pending
                              </Badge>
                            )}
                          </div>
                          {milestone.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{milestone.description}</p>
                          )}

                          {/* Progress Bar */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <div
                              className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden max-w-[200px]"
                            >
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  milestone.status === 'completed'
                                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                    : milestone.completion_percentage > 0
                                      ? 'bg-gradient-to-r from-primary to-primary/70'
                                      : 'bg-muted',
                                  `w-[${milestone.completion_percentage}%]`
                                )}
                              />
                            </div>
                            <span className={cn(
                              "text-xs font-bold tabular-nums",
                              milestone.status === 'completed' ? 'text-emerald-500' : 'text-muted-foreground'
                            )}>
                              {milestone.completion_percentage}%
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                              · {format(new Date(milestone.planned_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={cn("text-[9px] h-5 px-2", status.color, status.border, status.bg)}>
                            {status.label}
                          </Badge>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2"
                            onClick={() => openProgressUpdate(milestone)}
                            disabled={milestone.status === 'completed'}
                          >
                            Update
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setExpandedMilestone(isExpanded ? null : milestone.id)}
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="ml-13 border-l-2 border-border/40 pl-4 space-y-3">
                            {/* Details */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Planned Date</p>
                                <p className="text-xs font-medium">{format(new Date(milestone.planned_date), 'MMM d, yyyy')}</p>
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Actual Date</p>
                                <p className="text-xs font-medium">{milestone.actual_date ? format(new Date(milestone.actual_date), 'MMM d, yyyy') : '—'}</p>
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Status</p>
                                <p className={cn("text-xs font-medium capitalize", status.color)}>{milestone.status.replace('_', ' ')}</p>
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Completion</p>
                                <p className="text-xs font-medium">{milestone.completion_percentage}%</p>
                              </div>
                            </div>

                            {milestone.description && (
                              <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Description</p>
                                <p className="text-xs text-muted-foreground">{milestone.description}</p>
                              </div>
                            )}

                            {/* Deviation History */}
                            {deviationForMilestone.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Deviation Requests</p>
                                {deviationForMilestone.map((req) => (
                                  <div key={req.id} className="p-2.5 bg-muted/40 rounded-lg border border-border/30 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">
                                        {format(new Date(req.original_date), 'MMM d')} → {format(new Date(req.new_proposed_date), 'MMM d, yyyy')}
                                      </span>
                                      <Badge variant="outline" className={cn(
                                        "text-[9px] h-4 px-1.5",
                                        req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                          : req.status === 'rejected' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                      )}>
                                        {req.status.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    <p className="text-muted-foreground">{req.reason}</p>
                                    {req.rejection_reason && (
                                      <p className="text-rose-500 text-[10px]"><strong>Rejection:</strong> {req.rejection_reason}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-1">
                              {milestone.status !== 'completed' && !pendingRequest && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDeviationRequest(milestone)}
                                  className="h-7 text-[10px] text-amber-600 border-amber-500/30 hover:bg-amber-500/5"
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Request Date Change
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMilestone(milestone.id)}
                                className="h-7 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/5 ml-auto"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Milestone Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-primary" />
              Add Milestone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Milestone Name *</Label>
              <Input
                value={newMilestone.milestone_name}
                onChange={(e) => setNewMilestone({ ...newMilestone, milestone_name: e.target.value })}
                placeholder="e.g., Foundation Complete"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Phase</Label>
                <Select
                  value={newMilestone.phase_id || 'none'}
                  onValueChange={(v) => setNewMilestone({ ...newMilestone, phase_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Phase</SelectItem>
                    {phases.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.phase_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Planned Date *</Label>
                <Input
                  type="date"
                  value={newMilestone.planned_date}
                  onChange={(e) => setNewMilestone({ ...newMilestone, planned_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newMilestone.description}
                onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                placeholder="Optional description..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddMilestone} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Update Dialog */}
      <Dialog open={!!selectedMilestone && !showDeviationDialog} onOpenChange={() => setSelectedMilestone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Update Progress
            </DialogTitle>
          </DialogHeader>
          {selectedMilestone && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-xl border border-border/30">
                <h4 className="font-semibold text-sm">{selectedMilestone.milestone_name}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Planned: {format(new Date(selectedMilestone.planned_date), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Completion Progress</Label>
                  <Badge variant="outline" className={cn(
                    "text-sm font-bold tabular-nums",
                    progress[0] === 100 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''
                  )}>
                    {progress[0]}%
                  </Badge>
                </div>
                <Slider
                  value={progress}
                  onValueChange={setProgress}
                  max={100}
                  step={5}
                  className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
              {progress[0] === 100 && (
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <p className="text-xs text-emerald-600">
                      Marking as complete will record today as the actual completion date.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMilestone(null)}>Cancel</Button>
            <Button onClick={() => selectedMilestone && handleUpdateProgress(selectedMilestone)} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deviation Request Dialog */}
      <Dialog open={showDeviationDialog} onOpenChange={setShowDeviationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Request Date Change
            </DialogTitle>
          </DialogHeader>
          {selectedMilestone && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-xl border border-border/30">
                <h4 className="font-semibold text-sm">{selectedMilestone.milestone_name}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Current Planned Date: {format(new Date(selectedMilestone.planned_date), 'MMM d, yyyy')}
                </p>
              </div>
              <div>
                <Label className="text-xs">New Proposed Date *</Label>
                <Input
                  type="date"
                  value={deviationForm.new_proposed_date}
                  onChange={(e) => setDeviationForm({ ...deviationForm, new_proposed_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Reason for Change *</Label>
                <Textarea
                  value={deviationForm.reason}
                  onChange={(e) => setDeviationForm({ ...deviationForm, reason: e.target.value })}
                  placeholder="Explain why the date change is needed..."
                  className="mt-1"
                  rows={3}
                />
              </div>
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-600">
                    This request will go through <strong>SMO → GMO → CEO</strong> approval chain.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeviationDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestDeviation} disabled={isRequestSaving} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isRequestSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
