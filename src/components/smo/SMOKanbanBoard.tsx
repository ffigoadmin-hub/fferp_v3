import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useSMOTasks, type SMOTask } from '@/hooks/useSMOData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { 
  Loader2, CheckSquare, Clock, Play, FileCheck, 
  ArrowRight, Upload, GripVertical 
} from 'lucide-react';
import { cn } from '@/lib/utils';

type KanbanColumn = 'pending' | 'in_progress' | 'completed';

const columnConfig: Record<KanbanColumn, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'To Do', color: 'border-l-muted-foreground', icon: <Clock className="w-4 h-4" /> },
  in_progress: { label: 'In Progress', color: 'border-l-primary', icon: <Play className="w-4 h-4" /> },
  completed: { label: 'Done', color: 'border-l-green-500', icon: <CheckSquare className="w-4 h-4" /> },
};

interface CompleteTaskDialogProps {
  open: boolean;
  onClose: () => void;
  task: SMOTask | null;
  onComplete: (proofUrl: string, notes: string) => void;
  isLoading: boolean;
}

function CompleteTaskDialog({ open, onClose, task, onComplete, isLoading }: CompleteTaskDialogProps) {
  const [proofUrl, setProofUrl] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!proofUrl) {
      toast.error('Proof URL is required');
      return;
    }
    onComplete(proofUrl, notes);
    setProofUrl('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Task</Label>
            <p className="text-sm text-muted-foreground">{task?.title}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="proof">Proof URL (Google Drive/Docs) *</Label>
            <Input
              id="proof"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Completion Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe what was done..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isLoading || !proofUrl}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ 
  task, 
  onMoveToProgress, 
  onMoveToComplete 
}: { 
  task: SMOTask; 
  onMoveToProgress: (task: SMOTask) => void;
  onMoveToComplete: (task: SMOTask) => void;
}) {
  const isOverdue = isPast(new Date(task.due_date)) && task.status !== 'completed';

  return (
    <div className={cn(
      "p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow",
      isOverdue && "border-destructive"
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'outline'}>
            {task.priority}
          </Badge>
        </div>
        {isOverdue && <Badge variant="destructive">Overdue</Badge>}
      </div>

      <h4 className="font-medium text-sm mb-1 line-clamp-2">{task.title}</h4>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>Due: {format(new Date(task.due_date), 'dd MMM')}</span>
        <span className={isOverdue ? 'text-destructive' : ''}>
          {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span>Progress</span>
          <span className="font-bold">{task.progress_percentage}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all" 
            style={{ width: `${task.progress_percentage}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {task.status === 'pending' && (
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 h-7 text-xs"
            onClick={() => onMoveToProgress(task)}
          >
            <Play className="w-3 h-3 mr-1" /> Start
          </Button>
        )}
        {task.status === 'in_progress' && (
          <Button 
            size="sm" 
            className="flex-1 h-7 text-xs"
            onClick={() => onMoveToComplete(task)}
          >
            <FileCheck className="w-3 h-3 mr-1" /> Complete
          </Button>
        )}
        {task.status === 'completed' && (
          <div className="flex items-center gap-1 text-green-600 text-xs">
            <CheckSquare className="w-3 h-3" /> Done
          </div>
        )}
      </div>
    </div>
  );
}

export function SMOKanbanBoard() {
  const { user } = useAuth();
  const { tasks, isLoading, updateTaskStatus } = useSMOTasks();
  const [completingTask, setCompletingTask] = useState<SMOTask | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Filter to only show tasks assigned to current user
  const myTasks = tasks.filter(t => t.assigned_to === user?.id);

  const tasksByColumn: Record<KanbanColumn, SMOTask[]> = {
    pending: myTasks.filter(t => t.status === 'pending'),
    in_progress: myTasks.filter(t => t.status === 'in_progress'),
    completed: myTasks.filter(t => t.status === 'completed'),
  };

  const handleMoveToProgress = async (task: SMOTask) => {
    const { error } = await updateTaskStatus(task.id, 'in_progress', 25);
    if (error) {
      toast.error('Failed to update task');
    } else {
      toast.success('Task moved to In Progress');
    }
  };

  const handleMoveToComplete = (task: SMOTask) => {
    setCompletingTask(task);
  };

  const handleCompleteTask = async (proofUrl: string, notes: string) => {
    if (!completingTask) return;
    setIsCompleting(true);

    try {
      // Update task status
      const { error } = await updateTaskStatus(completingTask.id, 'completed', 100);
      if (error) throw error;

      // Add completion comment with proof
      await supabase.from('task_comments').insert({
        task_id: completingTask.id,
        user_id: user?.id,
        comment: `✅ Task completed. Notes: ${notes}\n📎 Proof: ${proofUrl}`,
      });

      toast.success('Task completed with proof');
      setCompletingTask(null);
    } catch (error) {
      toast.error('Failed to complete task');
    } finally {
      setIsCompleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Task Kanban</h3>
        <Badge variant="outline">{myTasks.length} Total Tasks</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(columnConfig) as KanbanColumn[]).map((column) => (
          <Card key={column} className={cn("border-l-4", columnConfig[column].color)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {columnConfig[column].icon}
                {columnConfig[column].label}
                <Badge variant="secondary" className="ml-auto">
                  {tasksByColumn[column].length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-3">
                  {tasksByColumn[column].length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No tasks
                    </p>
                  ) : (
                    tasksByColumn[column].map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onMoveToProgress={handleMoveToProgress}
                        onMoveToComplete={handleMoveToComplete}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>

      <CompleteTaskDialog
        open={!!completingTask}
        onClose={() => setCompletingTask(null)}
        task={completingTask}
        onComplete={handleCompleteTask}
        isLoading={isCompleting}
      />
    </div>
  );
}
