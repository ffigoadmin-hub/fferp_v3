import { useState, useEffect, useRef, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTaskAssignments } from '@/hooks/useTaskAssignments';
import { useAuth } from '@/contexts/AuthContext';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AudioRecorder } from '@/components/AudioRecorder';
import { AudioWaveform } from '@/components/AudioWaveform';
import {
  Loader2, CheckSquare, Clock, AlertTriangle, MessageSquare,
  Calendar, User, Paperclip, Send, ExternalLink, Mic
} from 'lucide-react';

// Helper to render clickable links
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
          {part}
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
};

export default function MyTasksPage() {
  const { user } = useAuth();
  const { tasks, comments, isLoading, isSaving, fetchComments, updateTask, addComment } = useTaskAssignments();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [progressValue, setProgressValue] = useState<number[]>([0]);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter tasks assigned to the current user
  const myTasks = tasks.filter(t => t.assigned_to === user?.id);

  const pendingTasks = myTasks.filter(t => t.status === 'pending');
  const inProgressTasks = myTasks.filter(t => t.status === 'in_progress');
  const completedTasks = myTasks.filter(t => t.status === 'completed');

  const taskComments = selectedTask ? (comments[selectedTask] || []) : [];

  useEffect(() => {
    if (selectedTask) {
      fetchComments(selectedTask);
      const task = myTasks.find(t => t.id === selectedTask);
      if (task) {
        setProgressValue([task.progress_percentage]);
      }
    }
  }, [selectedTask]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [taskComments, dialogOpen]);

  // Handle deep linking from notifications
  useEffect(() => {
    const taskIdFromUrl = searchParams.get('taskId');
    if (taskIdFromUrl && !dialogOpen && !selectedTask && !isLoading) {
      const task = myTasks.find(t => t.id === taskIdFromUrl);
      if (task) {
        openTaskDialog(taskIdFromUrl);
      }
    }
  }, [searchParams, myTasks, isLoading, dialogOpen, selectedTask]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'in_progress': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-orange-500 text-white';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted';
    }
  };

  const getDueStatus = (dueDate: string) => {
    const due = new Date(dueDate);
    if (isPast(due) && !isToday(due)) {
      return { label: 'Overdue', color: 'text-destructive', icon: AlertTriangle };
    }
    if (isToday(due)) {
      return { label: 'Due Today', color: 'text-orange-500', icon: Clock };
    }
    const days = differenceInDays(due, new Date());
    if (days <= 2) {
      return { label: `${days + 1} days left`, color: 'text-yellow-500', icon: Clock };
    }
    return { label: format(due, 'dd MMM'), color: 'text-muted-foreground', icon: Calendar };
  };

  const handleUpdateProgress = async (taskId: string, currentStatus: string) => {
    const savedProgress = progressValue[0];
    const newStatus = savedProgress === 100 ? 'completed' : (savedProgress > 0 ? 'in_progress' : 'pending');
    const result = await updateTask(taskId, {
      progress_percentage: savedProgress,
      status: newStatus as 'pending' | 'in_progress' | 'completed' | 'overdue',
    });
    if (result.success) {
      setProgressValue([savedProgress]);
    }
  };

  const openTaskDialog = (taskId: string) => {
    setSelectedTask(taskId);
    setDialogOpen(true);
  };

  const closeTaskDialog = () => {
    setDialogOpen(false);
    setSelectedTask(null);
    setNewComment('');

    if (searchParams.get('taskId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('taskId');
      setSearchParams(newParams);
    }
  };

  const handleStartTask = async (taskId: string) => {
    await updateTask(taskId, {
      status: 'in_progress',
      progress_percentage: progressValue[0] > 0 ? progressValue[0] : 5,
    });
  };

  const handleCompleteTask = async (taskId: string) => {
    await updateTask(taskId, {
      status: 'completed',
      progress_percentage: 100,
    });
  };

  const handleAddComment = async () => {
    if (!selectedTask || !newComment.trim()) return;
    await addComment(selectedTask, newComment);
    setNewComment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const handleAudioRecorded = async (audioBlob: Blob, duration: number) => {
    if (!selectedTask) return;
    setIsUploadingAudio(true);
    try {
      const fileName = `task-voice-${Date.now()}.webm`;
      const filePath = `task-comments/${selectedTask}/${fileName}`;

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

      addComment(selectedTask, '🎤 Voice Comment', publicUrl);
      toast.success('Voice comment added');
    } catch (error: any) {
      console.error('Error uploading audio:', error);
      toast.error('Failed to upload voice comment');
    } finally {
      setIsUploadingAudio(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const TaskCard = ({ task }: { task: any }) => {
    const dueStatus = getDueStatus(task.due_date);
    const DueIcon = dueStatus.icon;

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                <Badge variant="outline" className={getStatusColor(task.status).replace('bg-', 'border-').replace('-500', '-500') + ' border'}>
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>
              <CardTitle className="text-lg">{task.title}</CardTitle>
            </div>
            <div className={`flex items-center gap-1 text-sm ${dueStatus.color}`}>
              <DueIcon className="w-4 h-4" />
              <span>{dueStatus.label}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{task.progress_percentage}%</span>
            </div>
            <Progress value={task.progress_percentage} className="h-2" />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>Assigned by: {task.assigned_by_name}</span>
          </div>

          {task.attachments && task.attachments.length > 0 && (
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              {task.attachments.map((url: string, idx: number) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary text-sm hover:underline flex items-center gap-1"
                >
                  Attachment {idx + 1}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            {task.status === 'pending' && (
              <Button size="sm" onClick={() => handleStartTask(task.id)} disabled={isSaving}>
                Start Task
              </Button>
            )}
            {task.status === 'in_progress' && (
              <Button size="sm" variant="outline" onClick={() => handleCompleteTask(task.id)} disabled={isSaving}>
                <CheckSquare className="w-4 h-4 mr-1" />
                Mark Complete
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => openTaskDialog(task.id)}>
              <MessageSquare className="w-4 h-4 mr-1" />
              Chat
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const activeTask = myTasks.find(t => t.id === selectedTask);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">My Tasks</h1>
        <p className="text-sm md:text-base text-muted-foreground">Tasks assigned to you by management</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-3 md:pt-4">
            <div className="text-xl md:text-2xl font-bold text-yellow-500">{pendingTasks.length}</div>
            <p className="text-xs md:text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-3 md:pt-4">
            <div className="text-xl md:text-2xl font-bold text-blue-500">{inProgressTasks.length}</div>
            <p className="text-xs md:text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-3 md:pt-4">
            <div className="text-xl md:text-2xl font-bold text-green-500">{completedTasks.length}</div>
            <p className="text-xs md:text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-3 md:pt-4">
            <div className="text-xl md:text-2xl font-bold text-destructive">
              {myTasks.filter(t => isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== 'completed').length}
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="pending" className="text-xs md:text-sm px-2 py-2">
            <span className="hidden sm:inline">Pending</span>
            <span className="sm:hidden">📋</span>
            <span className="ml-1">({pendingTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="text-xs md:text-sm px-2 py-2">
            <span className="hidden sm:inline">In Progress</span>
            <span className="sm:hidden">🔄</span>
            <span className="ml-1">({inProgressTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs md:text-sm px-2 py-2">
            <span className="hidden sm:inline">Completed</span>
            <span className="sm:hidden">✓</span>
            <span className="ml-1">({completedTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs md:text-sm px-2 py-2">
            <span className="hidden sm:inline">All</span>
            <span className="sm:hidden">📁</span>
            <span className="ml-1">({myTasks.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending tasks</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {pendingTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="in_progress" className="space-y-4 mt-4">
          {inProgressTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tasks in progress</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {inProgressTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-4">
          {completedTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No completed tasks yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {completedTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-4">
          {myTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Tasks Assigned</h3>
                <p className="text-muted-foreground">You don't have any tasks assigned yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {myTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeTaskDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] h-[85vh] flex flex-col p-0">
          {activeTask && (
            <>
              <DialogHeader className="px-6 py-4 border-b">
                <DialogTitle>{activeTask.title}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{activeTask.description}</p>
              </DialogHeader>

              <div className="flex-1 overflow-hidden flex flex-col bg-background cyber-grid relative">
                {/* Comments / Chat Area */}
                <div 
                  ref={scrollRef} 
                  className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10"
                >
                  {/* Progress Update Widget in Chat */}
                  {activeTask.status !== 'completed' && (
                    <div className="mx-4 mb-6">
                      <div className="authority-card border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                        <div className="flex items-center justify-between mb-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Strategic Goal Alignment</span>
                            <h4 className="text-xs font-bold opacity-70">Current Mission Advancement</h4>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black text-primary">{progressValue[0]}%</span>
                          </div>
                        </div>
                        
                        <div className="relative py-4 px-1">
                          <Slider
                            value={progressValue}
                            onValueChange={setProgressValue}
                            max={100}
                            step={5}
                            className="w-full relative z-10"
                          />
                          {/* Background indicator */}
                          <div className="absolute top-1/2 left-0 w-full h-1.5 -translate-y-1/2 bg-muted/20 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary/10 transition-all duration-500 ease-out"
                              style={{ width: `${progressValue[0]}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 text-[10px] font-bold uppercase tracking-wider opacity-50 hover:opacity-100"
                            onClick={() => setProgressValue([activeTask.progress_percentage])}
                          >
                            Reset
                          </Button>
                          <Button
                            size="sm"
                            className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-wider text-[10px] shadow-lg shadow-primary/20"
                            onClick={() => handleUpdateProgress(activeTask.id, activeTask.status)}
                            disabled={isSaving || progressValue[0] === activeTask.progress_percentage}
                          >
                            {isSaving ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : "Commit Update"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {taskComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-30 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center border border-muted/20">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">No mission data recorded</p>
                    </div>
                  ) : (
                    taskComments.map((comment) => {
                      const isMyComment = comment.user_id === user?.id;
                      const isVoice = comment.attachment_url && (
                        comment.attachment_url.includes('voice') ||
                        comment.attachment_url.includes('webm') ||
                        comment.attachment_url.includes('audio')
                      );

                      return (
                        <div
                          key={comment.id}
                          className={cn(
                            "flex flex-col max-w-[85%]",
                            isMyComment ? "ml-auto items-end" : "mr-auto items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "p-3.5 rounded-2xl text-sm shadow-lg relative group transition-all",
                              isMyComment 
                                ? "bg-primary text-primary-foreground rounded-br-none shadow-primary/10 border border-primary/20" 
                                : "bg-card border border-border rounded-bl-none shadow-black/20"
                            )}
                          >
                            {!isMyComment && (
                              <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-1.5 opacity-80">{comment.user_name}</p>
                            )}
                            
                            {isVoice ? (
                              <div className="min-w-[220px] py-1">
                                <AudioWaveform 
                                  src={comment.attachment_url!} 
                                  compact 
                                  className={isMyComment ? "text-primary-foreground" : "text-primary"}
                                />
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                                {renderClickableText(comment.comment)}
                              </div>
                            )}

                            {comment.attachment_url && !isVoice && (
                              <a
                                href={comment.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-2 mt-3 p-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border",
                                  isMyComment 
                                    ? "bg-black/20 hover:bg-black/30 border-white/10" 
                                    : "bg-muted/50 hover:bg-muted border-border"
                                )}
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>Mission Evidence</span>
                                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                              </a>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5 px-1 opacity-60">
                            {format(new Date(comment.created_at), 'HH:mm')}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat Input Area */}
                <div className="p-4 bg-card/80 border-t border-border backdrop-blur-xl relative z-20">
                  <div className="flex items-end gap-3 bg-muted/30 p-2 rounded-2xl border border-border/50 focus-within:border-primary/40 focus-within:bg-muted/50 transition-all">
                    <AudioRecorder
                      onAudioRecorded={handleAudioRecorded}
                      disabled={isUploadingAudio}
                      className="shrink-0 mb-0.5"
                    />
                    
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={isUploadingAudio ? "Processing audio..." : "Enter mission report..."}
                      className="border-0 bg-transparent focus-visible:ring-0 px-1 h-auto py-2.5 text-sm placeholder:text-muted-foreground/50 font-medium"
                      onKeyDown={handleKeyDown}
                      disabled={isUploadingAudio}
                    />
                    
                    <Button
                      size="icon"
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || isSaving || isUploadingAudio}
                      className={cn(
                        "rounded-xl h-10 w-10 shrink-0 transition-all shadow-lg",
                        newComment.trim() 
                          ? "bg-primary text-primary-foreground opacity-100 scale-100" 
                          : "opacity-0 scale-50 w-0 p-0 overflow-hidden"
                      )}
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
