import { useState, useEffect, useCallback, memo, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useTaskAssignments, TaskAssignment, TaskComment } from '@/hooks/useTaskAssignments';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus, Loader2, CheckCircle, Clock, AlertTriangle,
  MessageSquare, Paperclip, Send, Target, CalendarClock, Mic, ExternalLink, Search
} from 'lucide-react';
import { AudioRecorder } from '@/components/AudioRecorder';
import { AudioWaveform } from '@/components/AudioWaveform';

// Helper to render clickable links in text
const renderClickableText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline hover:text-blue-700 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part.length > 30 ? part.slice(0, 30) + '...' : part}
          <ExternalLink className="w-3 h-3 inline ml-0.5" />
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
};
interface Employee {
  id: string;
  name: string;
  department: string;
}

// Memoized TaskCard component - moved OUTSIDE the main component to prevent re-creation
const TaskCard = memo(({
  task,
  taskComments,
  commentCount,
  isSelected,
  onToggleComments,
  onUpdateProgress,
  onMarkComplete,
  onAddComment,
  userId
}: {
  task: TaskAssignment;
  taskComments: TaskComment[];
  commentCount: number;
  isSelected: boolean;
  onToggleComments: (taskId: string) => void;
  onUpdateProgress: (taskId: string, progress: number) => void;
  onMarkComplete: (taskId: string) => void;
  onAddComment: (taskId: string, comment: string, audioUrl?: string) => void;
  userId: string | undefined;
}) => {
  const [localComment, setLocalComment] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const isOverdue = isPast(new Date(task.due_date)) && task.status !== 'completed';

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">High</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
      default: return <Badge>{priority}</Badge>;
    }
  };

  const getStatusBadge = () => {
    if (task.status === 'completed') return <Badge className="bg-green-500">Completed</Badge>;
    if (isPast(new Date(task.due_date))) return <Badge variant="destructive">Overdue</Badge>;
    if (task.status === 'in_progress') return <Badge className="bg-blue-500">In Progress</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  const handleSubmitComment = () => {
    if (localComment.trim()) {
      onAddComment(task.id, localComment);
      setLocalComment('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const handleAudioRecorded = async (audioBlob: Blob, duration: number) => {
    setIsUploadingAudio(true);
    try {
      const fileName = `task-voice-${Date.now()}.webm`;
      const filePath = `task-comments/${task.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('voice-comments')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
        });

      if (error) {
        if (error.message.includes('not found')) {
          toast.error('Voice comments storage not configured');
          return;
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('voice-comments')
        .getPublicUrl(filePath);

      onAddComment(task.id, '🎤 Voice Comment', publicUrl);
      toast.success('Voice comment added');
    } catch (error: any) {
      console.error('Error uploading audio:', error);
      toast.error('Failed to upload voice comment');
    } finally {
      setIsUploadingAudio(false);
    }
  };

  return (
    <Card className={isOverdue ? 'border-destructive' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getPriorityBadge(task.priority)}
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="w-4 h-4" />
            <span className={isOverdue ? 'text-destructive' : ''}>
              {isOverdue ? 'Overdue: ' : 'Due: '}
              {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
            </span>
          </div>
        </div>
        <CardTitle className="text-lg mt-2">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{task.description}</p>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Assigned by: <span className="font-medium text-foreground">{task.assigned_by_name}</span>
          </span>
          <span className="text-muted-foreground">
            Assigned to: <span className="font-medium text-foreground">{task.assigned_to_name}</span>
          </span>
        </div>

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary opacity-70">Advancement</span>
              <p className="text-xs font-bold">Mission Progress</p>
            </div>
            <span className="text-xl font-black text-primary">{task.progress_percentage}%</span>
          </div>
          
          <div className="relative py-2">
            <Progress value={task.progress_percentage} className="h-1.5 relative z-10" />
            {task.assigned_to === userId && task.status !== 'completed' && (
              <div className="mt-4 p-3 bg-muted/30 rounded-xl border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-50">Update Status</span>
                  <span className="text-xs font-bold text-primary">{task.progress_percentage}% → {task.progress_percentage}%</span>
                </div>
                <Slider
                  value={[task.progress_percentage]}
                  onValueChange={([v]) => onUpdateProgress(task.id, v)}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="border-t pt-4 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleComments(task.id)}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comments ({isSelected ? taskComments.length : commentCount})
            </span>
          </Button>

          {isSelected && (
            <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              {/* Comment list */}
              <div className="space-y-4 max-h-80 overflow-y-auto px-1 py-2 custom-scrollbar">
                {taskComments.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-4 uppercase tracking-[0.2em] opacity-50 font-bold">No discussion recorded</p>
                ) : (
                  taskComments.map(comment => {
                    const isMyComment = comment.user_id === userId;
                    const isVoice = comment.attachment_url && (
                      comment.attachment_url.includes('voice') ||
                      comment.attachment_url.includes('webm') ||
                      comment.attachment_url.includes('audio')
                    );

                    return (
                      <div
                        key={comment.id}
                        className={cn(
                          "flex flex-col max-w-[90%]",
                          isMyComment ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div
                          className={cn(
                            "p-3 rounded-2xl text-sm shadow-md relative group transition-all",
                            isMyComment
                              ? "bg-primary text-primary-foreground rounded-br-none border border-primary/20 shadow-primary/5"
                              : "bg-card border border-border rounded-bl-none shadow-black/10"
                          )}
                        >
                          {!isMyComment && (
                            <p className="text-[9px] font-black uppercase tracking-wider text-primary mb-1.5 opacity-80">{comment.user_name}</p>
                          )}

                          {isVoice ? (
                            <div className="min-w-[200px] py-0.5">
                              <AudioWaveform
                                src={comment.attachment_url!}
                                compact
                                className={isMyComment ? "text-primary-foreground" : "text-primary"}
                              />
                            </div>
                          ) : (
                            <p className="break-words leading-relaxed font-medium">
                              {renderClickableText(comment.comment)}
                            </p>
                          )}
                        </div>
                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-1.5 px-1 opacity-50">
                          {format(new Date(comment.created_at), 'HH:mm')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add comment with voice recorder */}
              <div className="mt-2 bg-muted/20 p-2 rounded-2xl border border-border/50 focus-within:border-primary/30 transition-all" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-2 items-center">
                  <AudioRecorder
                    onAudioRecorded={handleAudioRecorded}
                    disabled={isUploadingAudio}
                    className="shrink-0"
                  />
                  <Input
                    value={localComment}
                    onChange={(e) => setLocalComment(e.target.value)}
                    placeholder={isUploadingAudio ? "Uploading..." : "Type message..."}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => e.stopPropagation()}
                    className="border-0 bg-transparent focus-visible:ring-0 px-1 text-xs h-9 placeholder:text-muted-foreground/40 font-medium"
                    disabled={isUploadingAudio}
                  />
                  <Button 
                    size="icon" 
                    className={cn(
                      "h-8 w-8 rounded-xl shrink-0 transition-all",
                      localComment.trim() ? "bg-primary text-primary-foreground scale-100 opacity-100" : "opacity-0 scale-50 w-0"
                    )}
                    onClick={handleSubmitComment} 
                    disabled={!localComment.trim() || isUploadingAudio}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mark Complete */}
        {task.assigned_to === userId && task.status !== 'completed' && (
          <Button
            className="w-full mt-2"
            onClick={() => onMarkComplete(task.id)}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark as Complete
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

TaskCard.displayName = 'TaskCard';

export default function TaskAssignmentPage() {
  const { user } = useAuth();
  const { tasks, comments, commentCounts, isLoading, isSaving, createTask, updateTask, addComment, fetchComments, refetch } = useTaskAssignments();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // Form states
  const [assignTo, setAssignTo] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');

  // Department filter and search for employee selection
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Task search state
  const [taskSearch, setTaskSearch] = useState('');

  const role = user?.role.toLowerCase() || '';
  const canAssign = ['admin', 'ceo', 'gm', 'boi', 'gmo', 'smo'].includes(role);

  // Get unique departments from employees
  const departments = [...new Set(employees.map(e => e.department))].filter(Boolean).sort();

  // Filter employees by department and search
  const filteredEmployees = employees.filter(emp => {
    const targetDept = deptFilter === 'all' ? null : deptFilter;
    const matchesDept = !targetDept || emp.department?.toLowerCase() === targetDept.toLowerCase();
    const matchesSearch = !employeeSearch || emp.name.toLowerCase().includes(employeeSearch.toLowerCase());
    return matchesDept && matchesSearch;
  });

  // Group employees by department for display
  const groupedEmployees = filteredEmployees.reduce((acc, emp) => {
    const dept = emp.department || 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);

  // Filter tasks by search query
  const filterTasksBySearch = (taskList: typeof tasks) => {
    if (!taskSearch.trim()) return taskList;
    const query = taskSearch.toLowerCase();
    return taskList.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.assigned_to_name?.toLowerCase().includes(query) ||
      t.assigned_by_name?.toLowerCase().includes(query)
    );
  };

  // Filter tasks
  const myTasks = filterTasksBySearch(tasks.filter(t => t.assigned_to === user?.id));
  const assignedByMe = filterTasksBySearch(tasks.filter(t => t.assigned_by === user?.id));
  const allTasks = filterTasksBySearch(tasks); // All tasks for admin view

  useEffect(() => {
    const fetchEmployees = async () => {
      // CEO can assign tasks to ANY user, Admin can assign to non-CEO users
      const query = supabase
        .from('profiles')
        .select('id, name, department')
        .neq('is_active', false)  // Exclude deactivated users
        .order('name');

      // Only filter roles for Admin, CEO sees everyone
      if (role === 'admin') {
        // Admin cannot assign tasks to CEO
        query.neq('role', 'CEO');
      }

      const { data } = await query;
      setEmployees(data || []);
    };
    if (canAssign) fetchEmployees();
  }, [canAssign, role]);

  useEffect(() => {
    if (selectedTask) {
      fetchComments(selectedTask);
    }
  }, [selectedTask, fetchComments]);

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('task-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, (payload) => {
        // Refresh comments for the selected task
        if (selectedTask) {
          fetchComments(selectedTask);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, fetchComments, selectedTask]);

  const handleSubmit = async () => {
    if (!assignTo || !title || !description || !dueDate) return;

    const result = await createTask({
      assigned_to: assignTo,
      title,
      description,
      priority,
      due_date: new Date(dueDate).toISOString(),
    });

    if (result.success) {
      setDialogOpen(false);
      setAssignTo('');
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
    }
  };

  const handleToggleComments = useCallback((taskId: string) => {
    setSelectedTask(prev => prev === taskId ? null : taskId);
  }, []);

  const handleUpdateProgress = useCallback(async (taskId: string, progress: number) => {
    await updateTask(taskId, {
      progress_percentage: progress,
      status: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'pending'
    });
  }, [updateTask]);

  const handleMarkComplete = useCallback(async (taskId: string) => {
    await updateTask(taskId, { status: 'completed', progress_percentage: 100 });
  }, [updateTask]);

  const handleAddComment = useCallback(async (taskId: string, comment: string, audioUrl?: string) => {
    await addComment(taskId, comment, audioUrl);
  }, [addComment]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {canAssign ? 'Task Assignment' : 'My Tasks'}
          </h1>
          <p className="text-muted-foreground">
            {canAssign ? 'Assign and track tasks for employees' : 'View and update your assigned tasks'}
          </p>
        </div>

        {canAssign && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Assign Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Assign New Task</DialogTitle>
              </DialogHeader>

              <ScrollArea className="max-h-[80vh] px-1">
                <div className="space-y-4 mt-4 pr-3 pb-2">
                  {/* Department Filter */}
                  <div>
                    <Label>Filter by Department</Label>
                    <Select
                      value={deptFilter}
                      onValueChange={setDeptFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map(dept => (
                          <SelectItem key={dept} value={dept.toLowerCase()}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Employee Search */}
                  <div>
                    <Label>Search Employee</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        placeholder="Type to search by name..."
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Assign To * ({filteredEmployees.length} found)</Label>
                    <ScrollArea className="h-40 border rounded-md p-2">
                      {filteredEmployees.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No employees found matching "{employeeSearch}"
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {Object.entries(groupedEmployees)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([dept, emps]) => (
                              <div key={dept}>
                                <div className="text-xs font-semibold text-muted-foreground py-1 sticky top-0 bg-background">
                                  {dept.toUpperCase()} ({emps.length})
                                </div>
                                {emps.sort((a, b) => a.name.localeCompare(b.name)).map(emp => (
                                  <Button
                                    key={emp.id}
                                    variant={assignTo === emp.id ? "default" : "ghost"}
                                    size="sm"
                                    className="w-full justify-start h-8 text-sm"
                                    onClick={() => setAssignTo(emp.id)}
                                  >
                                    {emp.name}
                                  </Button>
                                ))}
                              </div>
                            ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  <div>
                    <Label>Task Title *</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter task title..."
                    />
                  </div>

                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe the task in detail..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Priority *</Label>
                      <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Due Date *</Label>
                      <Input
                        type="datetime-local"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={!assignTo || !title || !description || !dueDate || isSaving}
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
                    Assign Task
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {canAssign ? 'Assigned by Me' : 'My Tasks'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {canAssign ? assignedByMe.length : myTasks.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">
              {(canAssign ? assignedByMe : myTasks).filter(t => t.status === 'in_progress').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">
              {(canAssign ? assignedByMe : myTasks).filter(t => t.status === 'completed').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              {(canAssign ? assignedByMe : myTasks).filter(t =>
                isPast(new Date(t.due_date)) && t.status !== 'completed'
              ).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={taskSearch}
          onChange={(e) => setTaskSearch(e.target.value)}
          placeholder="Search tasks by title, description, or assignee..."
          className="pl-9"
        />
      </div>

      {/* Tasks */}
      <Tabs defaultValue={canAssign ? 'all' : 'mytasks'}>
        <TabsList>
          {canAssign && <TabsTrigger value="all">All Tasks ({allTasks.length})</TabsTrigger>}
          {canAssign && <TabsTrigger value="assigned">Assigned by Me ({assignedByMe.length})</TabsTrigger>}
          <TabsTrigger value="mytasks">My Tasks ({myTasks.length})</TabsTrigger>
        </TabsList>

        {canAssign && (
          <TabsContent value="all" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allTasks.length === 0 ? (
                <Card className="col-span-2">
                  <CardContent className="py-12 text-center">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tasks found</p>
                  </CardContent>
                </Card>
              ) : (
                allTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    taskComments={comments[task.id] || []}
                    commentCount={commentCounts[task.id] || 0}
                    isSelected={selectedTask === task.id}
                    onToggleComments={handleToggleComments}
                    onUpdateProgress={handleUpdateProgress}
                    onMarkComplete={handleMarkComplete}
                    onAddComment={handleAddComment}
                    userId={user?.id}
                  />
                ))
              )}
            </div>
          </TabsContent>
        )}

        {canAssign && (
          <TabsContent value="assigned" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedByMe.length === 0 ? (
                <Card className="col-span-2">
                  <CardContent className="py-12 text-center">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tasks assigned yet</p>
                  </CardContent>
                </Card>
              ) : (
                assignedByMe.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    taskComments={comments[task.id] || []}
                    commentCount={commentCounts[task.id] || 0}
                    isSelected={selectedTask === task.id}
                    onToggleComments={handleToggleComments}
                    onUpdateProgress={handleUpdateProgress}
                    onMarkComplete={handleMarkComplete}
                    onAddComment={handleAddComment}
                    userId={user?.id}
                  />
                ))
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="mytasks" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myTasks.length === 0 ? (
              <Card className="col-span-2">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No tasks assigned to you</p>
                </CardContent>
              </Card>
            ) : (
              myTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  taskComments={comments[task.id] || []}
                  commentCount={commentCounts[task.id] || 0}
                  isSelected={selectedTask === task.id}
                  onToggleComments={handleToggleComments}
                  onUpdateProgress={handleUpdateProgress}
                  onMarkComplete={handleMarkComplete}
                  onAddComment={handleAddComment}
                  userId={user?.id}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
