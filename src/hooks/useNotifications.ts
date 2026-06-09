import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { pushAlert } from '@/components/AlertPopup';
import {
  playEscalationAlert,
  playDangerAlert,
  playAnnouncementAlert,
  playTaskAlert,
  playSLABreachAlert,
  playPaymentAlert
} from '@/lib/alertSounds';

export interface Notification {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string;
  read_status: boolean;
  related_record_id: string | null;
  created_at: string;
  expires_at: string;
  role: string;
}

// Notification types by role
const ROLE_NOTIFICATION_TYPES: Record<string, string[]> = {
  admin: ['payment_approved', 'payment_rejected', 'payment_hold', 'payment_paid', 'leave_request', 'escalation', 'po_request', 'wo_request', 'employee_issue', 'sla_breach', 'escalation_assigned', 'escalation_critical', 'critical_assigned', 'critical_blast', 'chat_message'],
  ceo: ['payment_approved', 'payment_hold', 'escalation', 'sla_breach', 'critical_issue', 'leave_request', 'escalation_assigned', 'escalation_critical', 'critical_assigned', 'critical_blast', 'chat_message'],
  hr: ['leave_request', 'employee_issue', 'hr_attestation', 'late_submission', 'payment_new', 'chat_message'],
  gm: ['escalation', 'payment_verified', 'critical_issue', 'escalation_assigned', 'escalation_critical', 'critical_assigned', 'critical_blast', 'chat_message'],
  gmo: ['escalation', 'sla_breach', 'critical_issue', 'escalation_assigned', 'escalation_critical', 'critical_assigned', 'critical_blast', 'chat_message'],
  boi: ['payment_status', 'escalation', 'escalation_assigned', 'escalation_critical', 'critical_assigned', 'critical_blast', 'chat_message'],
  director: ['payment_status', 'escalation', 'escalation_assigned', 'critical_assigned', 'chat_message'],
  nsm: ['escalation', 'escalation_assigned', 'escalation_critical', 'critical_assigned', 'critical_blast', 'sla_breach', 'chat_message'],
  data: ['escalation', 'critical_assigned', 'critical_blast', 'sla_breach', 'chat_message'],
  accounts: ['payment_approved', 'payment_paid', 'chat_message'],
  smo: ['escalation', 'payment_status', 'escalation_assigned', 'chat_message'],
  employee: ['payment_approved', 'payment_rejected', 'payment_hold', 'payment_paid', 'leave_approved', 'leave_rejected', 'admin_review', 'hr_attestation', 'late_submission', 'eod_submitted', 'chat_message'],
};


export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const handleNotificationClick = useCallback((notification: Notification) => {
    // 1. Determine destination based on notification type
    let path = '';
    const role = user?.role?.toLowerCase() || 'employee';

    // Escalation & SLA routing
    if (['escalation_assigned', 'escalation_critical', 'sla_breach'].includes(notification.type)) {
      path = `/dashboard/my-escalations?ticketId=${notification.related_record_id}`;
      if (['ceo', 'admin', 'boi', 'gm'].includes(role)) {
        path = `/dashboard/escalations?ticketId=${notification.related_record_id}`;
      }
    } else if (['critical_assigned', 'critical_blast'].includes(notification.type)) {
      path = `/dashboard/escalations?tab=criticals&ticketId=${notification.related_record_id}`;
    }
    // Task routing
    else if (['task_assigned', 'task_comment', 'task_progress'].includes(notification.type)) {
      path = `/my-tasks?taskId=${notification.related_record_id}`;
    }
    // Payment routing
    else if (['payment_approved', 'payment_rejected', 'payment_hold', 'payment_paid'].includes(notification.type)) {
      if (['admin'].includes(role)) {
        path = '/admin-payments';
      } else if (['ceo'].includes(role)) {
        path = '/ceo-approvals';
      } else if (['accounts'].includes(role)) {
        path = '/accounts-execution';
      } else {
        path = '/my-requests';
      }
    }
    // Payment Reminder routing
    else if (['payment_reminder', 'payment_reminder_direct'].includes(notification.type)) {
      if (['admin'].includes(role)) {
        path = '/admin-payments';
      } else if (['ceo'].includes(role)) {
        path = '/ceo-approvals';
      } else if (['accounts'].includes(role)) {
        path = '/accounts-execution';
      } else if (['smo'].includes(role)) {
        path = '/smo/payment-audit';
      } else if (['gmo'].includes(role)) {
        path = '/gmo/payment-audit';
      } else if (['gm'].includes(role)) {
        path = '/gm/payment-audit';
      } else if (['boi'].includes(role)) {
        path = '/boi/payment-audit';
      } else if (['director'].includes(role)) {
        path = '/director/payment-audit';
      } else if (['hr'].includes(role)) {
        path = '/hr/payment-audit';
      } else {
        path = '/my-requests';
      }

      // Add record ID if direct reminder
      if (notification.type === 'payment_reminder_direct' && notification.related_record_id) {
        path += `?highlight=${notification.related_record_id}`;
      }
    }
    else if (notification.type === 'payment_status') {
      if (['admin'].includes(role)) {
        path = '/admin-payments';
      } else if (['ceo'].includes(role)) {
        path = '/ceo-approvals';
      } else if (['accounts'].includes(role)) {
        path = '/accounts-execution';
      } else {
        path = '/my-requests';
      }
    }
    else if (notification.type === 'payment_new' || notification.type === 'payment_verified') {
      if (['admin'].includes(role)) {
        path = '/admin-payments';
      } else if (['ceo'].includes(role)) {
        path = '/ceo-approvals';
      } else if (['hr'].includes(role)) {
        path = '/hr/payment-audit';
      } else {
        path = '/my-requests';
      }
    }
    // Leave routing
    else if (['leave_approved', 'leave_rejected', 'leave_request'].includes(notification.type)) {
      if (['hr', 'admin', 'ceo'].includes(role)) {
        path = '/leave-management';
      } else {
        path = '/leave-request';
      }
    }
    // LOP routing
    else if (['lop_verified', 'lop_approved', 'lop_rejected', 'lop_marked'].includes(notification.type)) {
      if (['hr', 'admin'].includes(role)) {
        path = '/lop-management';
      } else {
        path = '/my-lop';
      }
    }
    // HR / Attendance routing
    else if (notification.type === 'hr_attestation') {
      path = '/lop-management';
    }
    else if (['attendance', 'selfie_attendance'].includes(notification.type)) {
      if (['hr', 'admin'].includes(role)) {
        path = '/selfie-attendance';
      } else {
        path = '/day-start';
      }
    }
    else if (notification.type === 'late_submission') {
      if (['hr', 'admin', 'ceo'].includes(role)) {
        path = '/employee-activity';
      } else {
        path = '/day-start';
      }
    }
    else if (notification.type === 'eod_submitted') {
      path = '/eod-summary';
    }
    else if (notification.type === 'admin_review') {
      path = '/admin-payments';
    }
    // Chat routing
    else if (notification.type === 'chat_message') {
      path = `/chat/${notification.related_record_id}`;
    }
    // Announcement / general
    else if (notification.type === 'announcement') {
      path = '/announcements';
    }

    // 2. Mark as read
    markAsRead(notification.id);

    // 3. Navigate if path exists
    if (path) {
      navigate(path);
    }
  }, [user, navigate]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const notifs = (data || []) as Notification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read_status).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [user, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_status: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read_status: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_status: true })
        .eq('user_id', user.id)
        .eq('read_status', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      // Since we can't delete via RLS, we'll just remove from local state
      // and mark as read
      await markAsRead(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    handleNotificationClick,
    refetch: fetchNotifications,
  };
}
