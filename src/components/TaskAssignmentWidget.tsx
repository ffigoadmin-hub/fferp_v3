import { useState, useEffect, useCallback, memo, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Plus, Loader2, CheckCircle, Clock, AlertTriangle,
  MessageSquare, Send, Target, CalendarClock, ClipboardList,
  Search, Mic, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AudioRecorder } from './AudioRecorder';
import { AudioWaveform } from './AudioWaveform';

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
          className="text-primary underline hover:text-primary/80 inline-flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {part.length > 25 ? part.slice(0, 25) + '...' : part}
          <ExternalLink className="w-2 h-2" />
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

interface TaskAssignmentWidgetProps {
  title?: string;
  restrictDepartments?: string[];
  showOnlyMyTasks?: boolean;
}

// Memoized TaskCard component
const TaskCard = memo(({
  task,
  taskComments,
  isSelected,
  onToggleComments,
  onUpdateProgress,
  onMarkComplete,
  onAddComment,
  userId
}: {
  task: TaskAssignment;
  taskComments: TaskComment[];
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
    if (task.status === 'completed') return <Badge className="bg-status-live">Completed</Badge>;
    if (isPast(new Date(task.due_date))) return <Badge variant="destructive">Overdue</Badge>;
    if (task.status === 'in_progress') return <Badge className="bg-primary">In Progress</Badge>;
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
      const fileName = `widget-voice-${Date.now()}.webm`;
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
    <div className={cn(
      "p-4 border rounded-lg",
      isOverdue ? 'border-destructive bg-destructive/5' : 'hover:bg-muted/50'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getPriorityBadge(task.priority)}
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="w-3 h-3" />
          <span className={isOverdue ? 'text-destructive' : ''}>
            {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
          </span>
        </div>
      </div>

      <h4 className="font-semibold mb-1">{task.title}</h4>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{task.description}</p>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>To: <span className="font-medium text-foreground">{task.assigned_to_name}</span></span>
        <span>By: <span className="font-medium text-foreground">{task.assigned_by_name}</span></span>
      </div>

      {/* Progress */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span>Progress</span>
          <span className="font-bold">{task.progress_percentage}%</span>
        </div>
        <Progress value={task.progress_percentage} className="h-1.5" />
      </div>

      {/* Comments Toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onToggleComments(task.id)}
        className="w-full justify-center text-xs h-8"
      >
        <MessageSquare className="w-3 h-3 mr-1" />
        Comments ({taskComments.length})
      </Button>

      {isSelected && (
        <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* Comments List - WhatsApp Style */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {taskComments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No comments yet</p>
            ) : (
              taskComments.map(comment => {
                const isVoice = comment.attachment_url && (
                  comment.attachment_url.includes('voice') ||
                  comment.attachment_url.includes('webm') ||
                  comment.attachment_url.includes('audio')
                );
                const isMyComment = comment.user_id === userId;

                return (
                  <div
                    key={comment.id}
                    className={cn(
                      "p-2 rounded-lg text-xs max-w-[85%]",
                      isMyComment
                        ? "ml-auto bg-primary/20 rounded-br-none"
                        : "mr-auto bg-muted rounded-bl-none"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-medium text-primary">{comment.user_name}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {format(new Date(comment.created_at), 'dd MMM, HH:mm')}
                      </span>
                    </div>

                    {/* Voice Message - with Waveform */}
                    {isVoice ? (
                      <AudioWaveform
                        src={comment.attachment_url!}
                        compact
                        className="bg-background/50"
                      />
                    ) : (
                      <p className="break-words">{renderClickableText(comment.comment)}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Input Area */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-full p-1">
            <Input
              value={localComment}
              onChange={(e) => setLocalComment(e.target.value)}
              placeholder="Type a message..."
              className="h-8 text-sm border-0 bg-transparent focus-visible:ring-0 flex-1"
              onKeyDown={handleKeyDown}
            />
            <Button size="sm" className="h-8 w-8 p-0 rounded-full" onClick={handleSubmitComment} disabled={!localComment.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Voice Recording */}
          <div className="flex items-center justify-center">
            <AudioRecorder
              onAudioRecorded={handleAudioRecorded}
              disabled={isUploadingAudio}
            />
            {isUploadingAudio && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Sending...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

TaskCard.displayName = 'TaskCard';

export function TaskAssignmentWidget({ title = "Task Assignment", showOnlyMyTasks = false, restrictDepartments }: TaskAssignmentWidgetProps) {
  const { user } = useAuth();
  const { tasks, comments, isLoading, isSaving, createTask, updateTask, addComment, fetchComments, refetch } = useTaskAssignments();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'assigned' | 'mytasks'>(showOnlyMyTasks ? 'mytasks' : 'assigned');

  // Form states
  const [assignTo, setAssignTo] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');

  // Employee filter states
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const role = user?.role?.toLowerCase() || '';
  const userDepartment = user?.department || '';
  const canAssign = !showOnlyMyTasks && ['admin', 'ceo', 'gm', 'gmo', 'smo', 'boi', 'purchase_head', 'vendor_head'].includes(role);

  // Debug: Log current user info
  console.log('TaskAssignment DEBUG:', {
    userId: user?.id,
    userName: user?.name,
    role,
    department: userDepartment,
    canAssign,
    isSuperAssigner: ['ceo', 'admin', 'gm', 'gmo', 'purchase_head', 'vendor_head'].includes(role)
  });

  // Filter tasks
  const myTasks = tasks.filter(t => t.assigned_to === user?.id);
  const assignedByMe = tasks.filter(t => t.assigned_by === user?.id);

  // Search filter
  const filterTasks = (taskList: TaskAssignment[]) => {
    if (!searchQuery) return taskList;
    const query = searchQuery.toLowerCase();
    return taskList.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.assigned_to_name?.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query)
    );
  };

  // Get unique departments from employees
  const departments = [...new Set(employees.map(e => e.department))].filter(Boolean).sort();

  // Filter employees by department and search
  const filteredEmployees = employees.filter(emp => {
    const targetDept = deptFilter === 'all' ? null : deptFilter;
    const matchesDept = !targetDept || emp.department?.toLowerCase() === targetDept.toLowerCase();
    const matchesSearch = !employeeSearch || emp.name.toLowerCase().includes(employeeSearch.toLowerCase());
    return matchesDept && matchesSearch;
  });

  // Group filtered employees by department
  const groupedEmployees = filteredEmployees.reduce((acc, emp) => {
    const dept = emp.department || 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);

  // ✅ SUPER ASSIGNERS: CEO, Admin, GM, GMO, Purchase Head, Vendor Head can assign tasks
  const SUPER_ASSIGNERS = ['ceo', 'admin', 'gm', 'gmo', 'purchase_head', 'vendor_head'];
  const isSuperAssigner = SUPER_ASSIGNERS.includes(role);

  useEffect(() => {
    // Don't fetch until we know the user's role
    if (!role) {
      console.log('TaskAssignment: Waiting for user role...');
      return;
    }

    const fetchEmployees = async () => {
      console.log('TaskAssignment: Fetching employees for role:', role, '| isSuperAssigner:', isSuperAssigner);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, department, role')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]);
        return;
      }

      console.log('TaskAssignment: Fetched', data?.length, 'active employees from database');

      // ✅ SUPER ASSIGNERS (CEO, Admin, GM, GMO) → SHOW ALL USERS - NO FILTERS
      // EXCEPT for Purchase Head and Vendor Head who are restricted to their departments
      if (SUPER_ASSIGNERS.includes(role)) {
        let allEmployees = (data || []).map(e => ({ id: e.id, name: e.name, department: e.department }));
        
        // Purchase Head restriction
        if (role === 'purchase_head') {
          allEmployees = allEmployees.filter(e => e.department?.toLowerCase().includes('purchase'));
          console.log('TaskAssignment: Purchase Head - Restricted to Purchase department');
        } 
        // Vendor Head restriction
        else if (role === 'vendor_head') {
          allEmployees = allEmployees.filter(e => e.department?.toLowerCase().includes('vendor'));
          console.log('TaskAssignment: Vendor Head - Restricted to Vendor Sourcing department');
        }
        // Apply restrictDepartments filter if provided via props
        else if (restrictDepartments?.length) {
          allEmployees = allEmployees.filter(e => restrictDepartments.some(d => e.department?.toLowerCase().includes(d.toLowerCase())));
          console.log('TaskAssignment: Restricted to departments:', restrictDepartments, '→', allEmployees.length, 'employees');
        }
        
        setEmployees(allEmployees);
        return;
      }

      // SMO: Filter for their own department's staff only
      if (role === 'smo') {
        console.log('TaskAssignment: SMO - filtering to department:', userDepartment);
        const filtered = (data || []).filter(emp => {
          const dept = (emp.department || '').toLowerCase();
          return dept === userDepartment.toLowerCase();
        });
        setEmployees(filtered.map(e => ({ id: e.id, name: e.name, department: e.department })));
        return;
      }

      // Default for other roles (BOI, etc.) - show all employees
      console.log('TaskAssignment: Default role - showing all employees');
      setEmployees((data || []).map(e => ({ id: e.id, name: e.name, department: e.department })));
    };

    if (canAssign) {
      fetchEmployees();
    }
  }, [canAssign, role, userDepartment, isSuperAssigner, restrictDepartments]);

  useEffect(() => {
    if (selectedTask) {
      fetchComments(selectedTask);
    }
  }, [selectedTask, fetchComments]);

  // Real-time subscription with proper callback
  useEffect(() => {
    const channel = supabase
      .channel('task-assignments-realtime-v2')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_assignments'
      }, (payload) => {
        console.log('Task assignment change detected:', payload);
        refetch();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_comments'
      }, (payload) => {
        console.log('Task comment change detected:', payload);
        if (selectedTask) fetchComments(selectedTask);
      })
      .subscribe((status) => {
        console.log('Task realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, fetchComments, selectedTask]);

  const handleSubmit = async () => {
    if (!assignTo || !taskTitle || !description || !dueDate) return;

    const result = await createTask({
      assigned_to: assignTo,
      title: taskTitle,
      description,
      priority,
      due_date: new Date(dueDate).toISOString(),
    });

    if (result.success) {
      setDialogOpen(false);
      setAssignTo('');
      setTaskTitle('');
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

  // Stats
  const displayTasks = activeTab === 'assigned' ? assignedByMe : myTasks;
  const filteredTasks = filterTasks(displayTasks);
  const pendingCount = displayTasks.filter(t => t.status === 'pending').length;
  const inProgressCount = displayTasks.filter(t => t.status === 'in_progress').length;
  const completedCount = displayTasks.filter(t => t.status === 'completed').length;
  const overdueCount = displayTasks.filter(t => isPast(new Date(t.due_date)) && t.status !== 'completed').length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {title}
            </CardTitle>
            {!showOnlyMyTasks && (
              <CardDescription>Assign and track tasks for your team</CardDescription>
            )}
            {showOnlyMyTasks && (
              <CardDescription>Tasks assigned to you</CardDescription>
            )}
          </div>
          {canAssign && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Assign Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Assign New Task</DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[80vh] px-1">
                  <div className="space-y-4 mt-4 pr-3 pb-2">
                    {/* Employee Search - Live Filter */}
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
                      {role !== 'ceo' && role !== 'admin' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Filtered by department access
                        </p>
                      )}
                    </div>

                    {/* Employee Select with Filtered List */}
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
                      {assignTo && (
                        <p className="text-xs text-primary mt-1">
                          Selected: {employees.find(e => e.id === assignTo)?.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label>Task Title *</Label>
                      <Input
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
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
                      disabled={!assignTo || !taskTitle || !description || !dueDate || isSaving}
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

        {/* Search & Tabs */}
        <div className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {!showOnlyMyTasks && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="assigned">Assigned by Me ({assignedByMe.length})</TabsTrigger>
                <TabsTrigger value="mytasks">My Tasks ({myTasks.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold">{pendingCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-primary/10 text-center">
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-lg font-bold text-primary">{inProgressCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-status-live/10 text-center">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-lg font-bold text-status-live">{completedCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-destructive/10 text-center">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-lg font-bold text-destructive">{overdueCount}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {activeTab === 'assigned' ? 'No tasks assigned yet' : 'No tasks assigned to you'}
                </p>
                {canAssign && activeTab === 'assigned' && (
                  <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Assign First Task
                  </Button>
                )}
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  taskComments={comments[task.id] || []}
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
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
