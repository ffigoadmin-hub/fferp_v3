import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const typeStyles: Record<string, string> = {
  payment_approved: 'bg-status-live/20 text-status-live',
  payment_rejected: 'bg-status-missed/20 text-status-missed',
  payment_paid: 'bg-status-live/20 text-status-live',
  payment_hold: 'bg-status-late/20 text-status-late',
  attendance: 'bg-status-missed/20 text-status-missed',
  lop_verified: 'bg-status-late/20 text-status-late',
  lop_approved: 'bg-status-missed/20 text-status-missed',
  lop_rejected: 'bg-status-live/20 text-status-live',
  escalation_assigned: 'bg-status-late/20 text-status-late',
  escalation_critical: 'bg-status-missed/20 text-status-missed',
  critical_assigned: 'bg-status-late/20 text-status-late',
  critical_blast: 'bg-status-missed/20 text-status-missed',
  sla_breach: 'bg-status-missed/20 text-status-missed',
  default: 'bg-primary/20 text-primary',
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, handleNotificationClick } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-status-missed text-[10px] font-bold rounded-full flex items-center justify-center text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-3 transition-colors cursor-pointer hover:bg-muted/50',
                    !notification.read_status && 'bg-primary/5'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full mt-2 shrink-0',
                      !notification.read_status ? 'bg-primary' : 'bg-transparent'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          typeStyles[notification.type] || typeStyles.default
                        )}>
                          {notification.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{notification.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read_status && (
                      <Check className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
