import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  playAlert,
  resumeAudioContext,
  playPaymentAlert,
  playSlotOpeningAlert,
  playDangerAlert,
  playEscalationAlert
} from '@/lib/alertSounds';
import { pushAlert, AlertData } from '@/components/AlertPopup';
import { useNotifications } from '@/hooks/useNotifications';

// Cooldown to prevent duplicate alerts
const ALERT_COOLDOWN_MS = 5000;

export function useHighPriorityAlerts() {
  const { user, isAuthenticated } = useAuth();
  const { handleNotificationClick, refetch } = useNotifications();
  const navigate = useNavigate();
  const lastAlertTimeRef = useRef<Record<string, number>>({});
  const [hasInteracted, setHasInteracted] = useState(false);

  // Track user interaction to enable audio
  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      resumeAudioContext();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Request notification permission
  useEffect(() => {
    if (isAuthenticated && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isAuthenticated]);

  // Check cooldown before alerting
  const shouldAlert = useCallback((key: string): boolean => {
    const now = Date.now();
    const lastTime = lastAlertTimeRef.current[key] || 0;
    if (now - lastTime > ALERT_COOLDOWN_MS) {
      lastAlertTimeRef.current[key] = now;
      return true;
    }
    return false;
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback(async (title: string, body: string, tag?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const options = {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: tag || `alert-${Date.now()}`,
          requireInteraction: true,
        };

        // Method 1: Try Service Worker (Preferred for PWA/Mobile)
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration && 'showNotification' in registration) {
            await registration.showNotification(title, options);
            return;
          }
        }

        // Method 2: Fallback to standard constructor
        const notification = new Notification(title, options);

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        setTimeout(() => notification.close(), 15000);
      } catch (e) {
        console.warn('Browser notification failed:', e);
      }


    }
  }, []);

  // Trigger escalation alert
  const triggerEscalationAlert = useCallback(async (ticket: any, isCritical = false) => {
    const key = `escalation-${ticket.id}`;
    if (!shouldAlert(key)) return;

    let projectName = ticket.project?.project_name || '';
    let clientName = ticket.client_name || ticket.customer_name || '';

    // Fetch project details if missing and project_id exists
    if (ticket.project_id && (!projectName || !clientName)) {
      try {
        const { data: project } = await supabase
          .from('projects')
          .select('project_name, client_name')
          .eq('id', ticket.project_id)
          .single();

        if (project) {
          projectName = project.project_name;
          if (!clientName) clientName = project.client_name;
        }
      } catch (err) {
        console.warn('Failed to fetch project details for alert:', err);
      }
    }

    const ticketId = ticket.ticket_number
      ? `#${ticket.ticket_number}`
      : ticket.escalation_number
        ? `ESC-${ticket.escalation_number}`
        : '';

    if (hasInteracted) {
      if (isCritical) {
        playAlert('danger');
      } else {
        playAlert('escalation');
      }
    }

    pushAlert({
      type: isCritical ? 'danger' : 'escalation',
      title: isCritical ? `Critical Issue ${ticketId}` : `New Escalation ${ticketId}`,
      message: ticket.issue_title || ticket.issue_description || 'Requires immediate attention',
      priority: isCritical ? 'critical' : 'high',
      clientName: clientName || undefined,
      projectName: projectName || undefined,
      department: ticket.department || undefined,
      onAction: () => {
        const role = user?.role?.toLowerCase() || 'employee';
        if (isCritical) {
          navigate(`/dashboard/escalations?tab=criticals&ticketId=${ticket.id}`);
        } else {
          if (['ceo', 'admin', 'boi', 'gm'].includes(role)) {
            navigate(`/dashboard/escalations?ticketId=${ticket.id}`);
          } else {
            navigate(`/dashboard/my-escalations?ticketId=${ticket.id}`);
          }
        }
      }
    });

    showBrowserNotification(
      isCritical ? `🚨 CRITICAL: ${ticketId}` : `⚠️ Escalation: ${ticketId}`,
      `${projectName ? `[${projectName}] ` : ''}${ticket.issue_title || ticket.issue_description || 'New ticket requires attention'}`
    );
  }, [hasInteracted, shouldAlert, showBrowserNotification, navigate, user?.role]);

  // Trigger SLA breach alert
  const triggerSLABreachAlert = useCallback(async (ticket: any) => {
    const key = `sla-breach-${ticket.id}`;
    if (!shouldAlert(key)) return;

    let projectName = ticket.project?.project_name || '';
    let clientName = ticket.client_name || ticket.customer_name || '';

    // Fetch project details if missing and project_id exists
    if (ticket.project_id && (!projectName || !clientName)) {
      try {
        const { data: project } = await supabase
          .from('projects')
          .select('project_name, client_name')
          .eq('id', ticket.project_id)
          .single();

        if (project) {
          projectName = project.project_name;
          if (!clientName) clientName = project.client_name;
        }
      } catch (err) {
        console.warn('Failed to fetch project details for alert:', err);
      }
    }

    const ticketId = ticket.ticket_number ? `#${ticket.ticket_number}` : '';

    if (hasInteracted) {
      playAlert('sla_breach');
    }

    pushAlert({
      type: 'sla_breach',
      title: `SLA BREACHED ${ticketId}`,
      message: ticket.issue_title || 'This ticket has exceeded its deadline!',
      priority: 'critical',
      clientName: clientName || undefined,
      projectName: projectName || undefined,
      department: ticket.department || undefined,
      onAction: () => {
        const role = user?.role?.toLowerCase() || 'employee';
        if (['ceo', 'admin', 'boi', 'gm'].includes(role)) {
          navigate(`/dashboard/escalations?ticketId=${ticket.id}`);
        } else {
          navigate(`/dashboard/my-escalations?ticketId=${ticket.id}`);
        }
      }
    });

    showBrowserNotification(
      `🔴 SLA BREACHED: ${ticketId}`,
      `${projectName ? `[${projectName}] ` : ''}This ticket has exceeded its SLA deadline and requires immediate action!`
    );
  }, [hasInteracted, shouldAlert, showBrowserNotification, navigate, user?.role]);

  // Trigger announcement alert
  const triggerAnnouncementAlert = useCallback((announcement: any) => {
    const key = `announcement-${announcement.id}`;
    if (!shouldAlert(key)) return;

    if (hasInteracted) {
      playAlert('announcement');
    }

    pushAlert({
      type: 'announcement',
      title: announcement.title,
      message: announcement.message?.slice(0, 100) + (announcement.message?.length > 100 ? '...' : ''),
    });

    showBrowserNotification(
      `📢 ${announcement.title}`,
      announcement.message?.slice(0, 100) || 'New company announcement'
    );
  }, [hasInteracted, shouldAlert, showBrowserNotification]);

  // Trigger task assignment alert
  const triggerTaskAlert = useCallback((task: any, assignerName?: string) => {
    const key = `task-${task.id}`;
    if (!shouldAlert(key)) return;

    if (hasInteracted) {
      playAlert('task');
    }

    pushAlert({
      type: 'task',
      title: task.title,
      message: `Assigned by ${assignerName || 'Admin'}. Priority: ${task.priority?.toUpperCase() || 'MEDIUM'}`,
      priority: task.priority === 'high' ? 'high' : undefined,
    });

    showBrowserNotification(
      `📋 New Task: ${task.title}`,
      `You have been assigned a new ${task.priority?.toUpperCase() || ''} priority task`
    );
  }, [hasInteracted, shouldAlert, showBrowserNotification]);

  // Trigger LOP alert
  const triggerLOPAlert = useCallback((lop: any, employeeName?: string) => {
    const key = `lop-${lop.id}`;
    if (!shouldAlert(key)) return;

    if (hasInteracted) {
      playAlert('lop');
    }

    const isForSelf = lop.employee_id === user?.id;

    pushAlert({
      type: 'lop',
      title: isForSelf ? 'LOP Marked Against You' : `LOP Marked: ${employeeName || 'Employee'}`,
      message: `Date: ${lop.lop_date}. Reason: ${lop.reason?.slice(0, 50) || 'Not specified'}`,
      priority: 'high',
    });

    showBrowserNotification(
      `⏰ LOP Marked`,
      isForSelf
        ? `You have been marked LOP for ${lop.lop_date}`
        : `LOP marked for ${employeeName} on ${lop.lop_date}`
    );
  }, [hasInteracted, shouldAlert, showBrowserNotification, user?.id]);

  // Trigger Cafe Order Alert
  const triggerCafeOrderAlert = useCallback(async (order: any) => {
    const key = `cafe-order-${order.id}`;
    if (!shouldAlert(key)) return;

    // Fetch dish names for the order
    let itemsInfo = '';
    try {
      const { data: items } = await supabase
        .from('cafe_order_items')
        .select('item_name, quantity')
        .eq('order_id', order.id);

      if (items && items.length > 0) {
        itemsInfo = ` (${items.map(i => `${i.quantity}x ${i.item_name}`).join(', ')})`;
      }
    } catch (e) {
      console.warn('Failed to fetch items for alert:', e);
    }

    if (hasInteracted) {
      playEscalationAlert();
    }

    pushAlert({
      type: 'cafe_priority',
      title: `🍔 New Cafe Order: ${order.order_number}`,
      message: `${order.customer_name}${itemsInfo} - Total: ₹${order.total_amount}`,
      priority: 'critical',
      onAction: () => navigate('/cafe/manager'),
    });

    showBrowserNotification(
      `🍔 New Cafe Order`,
      `${order.customer_name}${itemsInfo} placed order (₹${order.total_amount})`
    );
  }, [hasInteracted, shouldAlert, showBrowserNotification, navigate]);

  // Trigger Cafe Payment Alert
  const triggerCafePaymentAlert = useCallback((order: any) => {
    const key = `cafe-payment-${order.id}`;
    if (!shouldAlert(key)) return;

    if (hasInteracted) {
      playPaymentAlert();
      setTimeout(playEscalationAlert, 500); // Layered sounds for high priority
    }

    pushAlert({
      type: 'cafe_priority',
      title: `💰 Payment Proof: ${order.order_number}`,
      message: `${order.customer_name} uploaded proof for ₹${order.total_amount}`,
      priority: 'critical',
      onAction: () => navigate('/cafe/manager'),
    });

    showBrowserNotification(
      `💰 Cafe Payment Proof`,
      `${order.customer_name} uploaded proof for ${order.order_number}`
    );
  }, [hasInteracted, shouldAlert, showBrowserNotification, navigate]);

  // Trigger Cafe Status Alert (For Employees)
  const triggerCafeStatusAlert = useCallback((order: any) => {
    const key = `cafe-status-${order.id}-${order.order_status}`;
    if (!shouldAlert(key)) return;

    if (hasInteracted) {
      playDangerAlert(); // Maximum priority as requested
    }

    const statusMap: Record<string, string> = {
      verified: '✅ Payment Verified',
      preparing: '👨‍🍳 Preparing your meal',
      ready: '🔔 READY FOR PICKUP!',
      collected: '😋 Enjoy your meal!',
      cancelled: '❌ Order Cancelled',
    };

    pushAlert({
      type: 'cafe_priority',
      title: `🍴 Order Update: ${order.order_number}`,
      message: `${statusMap[order.order_status] || order.order_status}`,
      priority: 'critical',
      onAction: () => navigate('/palm-cafe?view=orders'),
    });

    showBrowserNotification(
      `🍴 Order ${order.order_number} Update`,
      `Status: ${statusMap[order.order_status] || order.order_status}`
    );
  }, [hasInteracted, shouldAlert, showBrowserNotification, navigate]);

  // Process an incoming notification for display and sound
  const processNotification = useCallback((newNotif: any, source: string) => {
    try {
      console.log(`[useHighPriorityAlerts] Processing ${source} notification:`, newNotif);

      // Update local unread counts
      refetch();

      // 1. Play appropriate alert sound
      if (newNotif.type === 'chat_message') {
        playAlert('chat_message');
      } else if (newNotif.role?.toLowerCase() === 'ceo') {
        playAlert('ceo' as any);
      } else if (newNotif.role?.toLowerCase() === 'gm') {
        playAlert('gm' as any);
      } else if (newNotif.type.includes('escalation') || newNotif.type.includes('critical')) {
        playAlert('escalation');
      } else if (newNotif.type === 'sla_breach') {
        playAlert('sla_breach');
      } else if (newNotif.type.includes('payment')) {
        playPaymentAlert();
      } else if (newNotif.role?.toLowerCase() === 'boi') {
        playAlert('boi' as any);
      } else {
        playAlert('task');
      }

      // 2. Map notification types to AlertPopup types
      let alertType: any = 'announcement';

      if (newNotif.type === 'sla_breach') alertType = 'sla_breach';
      else if (newNotif.type.includes('critical')) alertType = 'danger';
      else if (newNotif.type.includes('escalation')) alertType = 'escalation';
      else if (newNotif.type.includes('payment_reminder')) alertType = 'payment_status';
      else if (newNotif.type === 'payment_new' || newNotif.type === 'payment_verified') alertType = 'payment_new';
      else if (newNotif.type === 'payment_approved' || newNotif.type === 'payment_paid') alertType = 'payment_approved';
      else if (newNotif.type === 'payment_rejected' || newNotif.type === 'payment_hold' || newNotif.type === 'payment_status') alertType = 'payment_status';
      else if (newNotif.type.includes('lop_')) alertType = 'lop';
      else if (newNotif.type === 'announcement') alertType = 'announcement';
      else if (newNotif.type === 'chat_message') alertType = 'chat_message';
      else if (newNotif.type === 'task_assigned') alertType = 'task';

      // 3. Push to UI
      pushAlert({
        type: alertType,
        title: newNotif.title,
        message: newNotif.message,
        onAction: () => handleNotificationClick(newNotif),
      });

      // 4. Native Browser Notification
      showBrowserNotification(newNotif.title, newNotif.message, `notif-${newNotif.id}`);
    } catch (err) {
      console.error('[useHighPriorityAlerts] Error processing notification:', err);
    }
  }, [refetch, handleNotificationClick, showBrowserNotification]);

  // Set up all real-time subscriptions
  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const userRole = user.role?.toLowerCase() || 'employee';
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // 1. Client Escalations - for BOI, SMO, GMO, GM, CEO, Admin, NSM
    if (['boi', 'smo', 'gmo', 'gm', 'ceo', 'admin', 'nsm'].includes(userRole)) {
      const escChannel = supabase
        .channel(`alert-esc-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'client_escalations' },
          (payload) => triggerEscalationAlert(payload.new, false)
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'client_escalations' },
          (payload) => {
            const newEsc = payload.new as any;
            const oldEsc = payload.old as any;
            if (newEsc.status === 'breached' && oldEsc.status !== 'breached') {
              triggerSLABreachAlert(newEsc);
            }
            if (newEsc.assigned_role?.toLowerCase() === userRole && oldEsc.assigned_role?.toLowerCase() !== userRole) {
              triggerEscalationAlert(newEsc, false);
            }
          }
        )
        .subscribe();
      channels.push(escChannel);
    }

    // 2. Hourly Criticals - for BOI, GMO, GM, CEO, Admin, DataTeam
    if (['boi', 'gmo', 'gm', 'ceo', 'admin', 'datateam'].includes(userRole)) {
      const critChannel = supabase
        .channel(`alert-crit-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'hourly_criticals' },
          (payload) => triggerEscalationAlert(payload.new, true)
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'hourly_criticals' },
          (payload) => {
            const newCrit = payload.new as any;
            const oldCrit = payload.old as any;
            if (newCrit.blast_triggered_at && !oldCrit.blast_triggered_at) {
              triggerSLABreachAlert(newCrit);
            }
          }
        )
        .subscribe();
      channels.push(critChannel);
    }

    // 3. Cafe Orders - For Managers and Customers
    const cafeChannel = supabase
      .channel(`alert-cafe-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cafe_orders' },
        (payload) => {
          const order = payload.new as any;
          if (['cafe_manager', 'palm_cafe_manager', 'admin'].includes(userRole)) {
            triggerCafeOrderAlert(order);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cafe_orders' },
        (payload) => {
          const order = payload.new as any;
          const oldOrder = payload.old as any;

          // Manager Alerts
          if (['cafe_manager', 'palm_cafe_manager', 'admin'].includes(userRole)) {
            if (order.payment_status === 'proof_uploaded' && oldOrder.payment_status !== 'proof_uploaded') {
              triggerCafePaymentAlert(order);
            }
          }

          // Customer Alerts (Employee/User is the customer)
          if (order.customer_id === user.id) {
            if (order.order_status !== oldOrder.order_status) {
              triggerCafeStatusAlert(order);
            }
          }
        }
      )
      .subscribe();
    channels.push(cafeChannel);

    // 4. Notifications Table (Personal/Role based alerts)
    const notifChannel = supabase
      .channel(`alert-notif-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif.user_id === user.id) {
            processNotification(newNotif, 'Personal');
          } else if (newNotif.role?.toLowerCase() === userRole) {
            processNotification(newNotif, 'Role');
          }
        }
      )
      .subscribe();
    channels.push(notifChannel);

    // 5. Existing Legacy Listeners (Announcements, Tasks, LOP)
    const legacyChannel = supabase
      .channel(`alert-legacy-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => { if ((payload.new as any).is_active) triggerAnnouncementAlert(payload.new); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_assignments' },
        async (payload) => {
          const task = payload.new as any;
          if (task.assigned_to === user.id) {
            const { data } = await supabase.from('profiles').select('name').eq('id', task.assigned_by).single();
            triggerTaskAlert(task, (data as any)?.name);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lop_entries' },
        async (payload) => {
          const lop = payload.new as any;
          if (lop.employee_id === user.id) triggerLOPAlert(lop);
          if (['hr', 'admin', 'boi'].includes(userRole)) {
            const { data } = await supabase.from('profiles').select('name').eq('id', lop.employee_id).single();
            triggerLOPAlert(lop, (data as any)?.name);
          }
        }
      )
      .subscribe();
    channels.push(legacyChannel);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [
    user,
    isAuthenticated,
    triggerEscalationAlert,
    triggerSLABreachAlert,
    triggerAnnouncementAlert,
    triggerTaskAlert,
    triggerLOPAlert,
    triggerCafeOrderAlert,
    triggerCafePaymentAlert,
    triggerCafeStatusAlert,
    processNotification,
    navigate
  ]);

  return {
    triggerEscalationAlert,
    triggerSLABreachAlert,
    triggerAnnouncementAlert,
    triggerTaskAlert,
    triggerLOPAlert,
    hasInteracted,
  };
}
