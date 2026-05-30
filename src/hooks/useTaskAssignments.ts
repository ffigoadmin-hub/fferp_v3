import { isMissingTable } from '@/lib/supabase-error-guard';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TaskAssignment {
  id: string;
  assigned_to: string;
  assigned_to_name?: string;
  assigned_by: string;
  assigned_by_name?: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  progress_percentage: number;
  attachments: string[] | null;
  completed_at: string | null;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  user_name?: string;
  comment: string;
  attachment_url: string | null;
  created_at: string;
}

export function useTaskAssignments() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [comments, setComments] = useState<Record<string, TaskComment[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('task_assignments')
        .select(`
          *,
          assignee:profiles!task_assignments_assigned_to_fkey(name),
          assigner:profiles!task_assignments_assigned_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((task: any) => ({
        ...task,
        assigned_to_name: task.assignee?.name,
        assigned_by_name: task.assigner?.name,
      }));

      setTasks(formatted);

      // Fetch comment counts for all tasks
      if (data && data.length > 0) {
        const taskIds = data.map((t: any) => t.id);
        const { data: countData, error: countError } = await supabase
          .from('task_comments')
          .select('task_id')
          .in('task_id', taskIds);

        if (!countError && countData) {
          const counts: Record<string, number> = {};
          countData.forEach((c: any) => {
            counts[c.task_id] = (counts[c.task_id] || 0) + 1;
          });
          setCommentCounts(counts);
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      const _isMissing = (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('schema cache'); if (!_isMissing) if (!isMissingTable(error)) toast.error('Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchComments = useCallback(async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          user:profiles!task_comments_user_id_fkey(name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((c: any) => ({
        ...c,
        user_name: c.user?.name,
      }));

      setComments(prev => ({ ...prev, [taskId]: formatted }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    // Set up real-time subscription for task assignments
    const taskChannel = supabase
      .channel(`tasks-realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignments' }, () => {
        console.log('[useTaskAssignments] Task update received - refetching');
        fetchTasks();
      })
      .subscribe();

    // Set up real-time subscription for task comments
    const commentChannel = supabase
      .channel(`task-comments-realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, (payload) => {
        const record = payload.new as any;
        const taskId = record?.task_id;
        if (taskId) {
          console.log('[useTaskAssignments] Comment update received - refetching comments for task', taskId);
          fetchComments(taskId);
        }
        // Also refresh comment counts
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(commentChannel);
    };
  }, [fetchTasks, fetchComments]);

  const createTask = async (data: {
    assigned_to: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    due_date: string;
    attachments?: string[];
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    console.log('[TaskAssignment] Attempting task creation:', {
      assigned_by: user.id,
      user_role: user.role,
      data
    });

    setIsSaving(true);

    try {
      const { data: newTask, error } = await supabase
        .from('task_assignments')
        .insert({
          ...data,
          assigned_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification to assignee - separate from main transaction to prevent blocking
      if (newTask) {
        supabase.from('notifications').insert({
          user_id: data.assigned_to,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `You have been assigned a new task: "${data.title}" (Priority: ${data.priority.toUpperCase()})`,
          role: 'employee',
          related_record_id: newTask.id,
        }).then(({ error: notifError }) => {
          if (notifError) console.error('Failed to send task notification:', notifError);
        });
      }

      toast.success('Task assigned successfully');
      await fetchTasks();
      return { success: true };
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error(error.message || 'Failed to assign task');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  const updateTask = async (id: string, data: Partial<TaskAssignment>) => {
    setIsSaving(true);

    try {
      const updateData: any = { ...data };
      if (data.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.progress_percentage = 100;

        // Delete audio files from storage when task is completed
        await deleteTaskAudioFiles(id);
      }

      const { error } = await supabase
        .from('task_assignments')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Send notification for progress update
      const task = tasks.find(t => t.id === id);
      if (task && user) {
        const notifyTarget = user.id === task.assigned_to ? task.assigned_by : task.assigned_to;
        
        let title = 'Task Update';
        let message = `Mission "${task.title}" was updated by ${user.name}`;
        
        if (data.status === 'completed') {
           title = '✅ Mission Accomplished';
           message = `Strategic goal "${task.title}" has been marked COMPLETED by ${user.name}`;
        } else if (data.progress_percentage !== undefined) {
           title = `📈 Progress: ${data.progress_percentage}%`;
           message = `New tactical advancement on "${task.title}" reported by ${user.name}`;
        }

        await supabase.from('notifications').insert({
          user_id: notifyTarget,
          type: 'task_progress',
          title: title,
          message: message,
          role: 'employee',
          related_record_id: id,
        });
      }

      toast.success('Task updated');
      await fetchTasks();
      return { success: true };
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      return { success: false, error };
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to delete audio files for a task
  const deleteTaskAudioFiles = async (taskId: string) => {
    try {
      // Get all comments with audio attachments for this task
      const { data: audioComments } = await supabase
        .from('task_comments')
        .select('attachment_url')
        .eq('task_id', taskId)
        .not('attachment_url', 'is', null);

      if (!audioComments || audioComments.length === 0) return;

      // Extract file paths and delete from storage
      for (const comment of audioComments) {
        if (comment.attachment_url && comment.attachment_url.includes('voice-comments')) {
          // Extract the path from the URL
          const urlParts = comment.attachment_url.split('/voice-comments/');
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            await supabase.storage.from('voice-comments').remove([filePath]);
          }
        }
      }

      console.log(`Deleted ${audioComments.length} audio files for completed task ${taskId}`);
    } catch (error) {
      console.error('Error deleting task audio files:', error);
      // Don't throw - audio cleanup is not critical
    }
  };

  const addComment = async (taskId: string, comment: string, attachmentUrl?: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          comment,
          attachment_url: attachmentUrl || null,
        });

      if (error) throw error;

      // Send notification to task assigner about new comment
      const task = tasks.find(t => t.id === taskId);
      if (task && user) {
        const notifyTarget = user.id === task.assigned_to ? task.assigned_by : task.assigned_to;
        
        await supabase.from('notifications').insert({
          user_id: notifyTarget,
          type: 'task_comment',
          title: '💬 You got a reply',
          message: `${user.name} messaged you on "${task.title}": ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
          role: 'employee',
          related_record_id: taskId,
        });
      }

      toast.success('Comment added');
      await fetchComments(taskId);
      return { success: true };
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
      return { success: false, error };
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Task deleted');
      await fetchTasks();
      return { success: true };
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
      return { success: false, error };
    }
  };

  return {
    tasks,
    comments,
    commentCounts,
    isLoading,
    isSaving,
    createTask,
    updateTask,
    addComment,
    deleteTask,
    fetchComments,
    refetch: fetchTasks,
  };
}
