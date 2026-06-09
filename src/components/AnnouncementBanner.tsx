import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Megaphone, AlertTriangle, Info, Bell } from 'lucide-react';

export function AnnouncementBanner() {
  const { user } = useAuth();
  const { activeAnnouncements } = useAnnouncements();

  if (!user || activeAnnouncements.length === 0) return null;

  // Get marquee announcements (scroll) and urgent ones (static)
  const marqueeAnnouncements = activeAnnouncements.filter(a => a.is_marquee);
  const urgentAnnouncements = activeAnnouncements.filter(a => a.priority === 'urgent' && !a.is_marquee);

  if (marqueeAnnouncements.length === 0 && urgentAnnouncements.length === 0) return null;

  return (
    <div className="space-y-0">
      {/* Urgent Static Announcements */}
      {urgentAnnouncements.map(ann => (
        <div
          key={ann.id}
          className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-destructive">{ann.title}:</span>
            <span className="ml-2 text-sm">{ann.message}</span>
            {ann.created_by_name && (
              <span className="ml-2 text-[10px] opacity-70 italic">- {ann.created_by_name}</span>
            )}
          </div>
        </div>
      ))}

      {/* Marquee Scrolling Announcements */}
      {marqueeAnnouncements.length > 0 && (
        <div className="bg-primary/5 border-b border-primary/20 overflow-hidden">
          <div className="flex items-center">
            <div className="bg-primary/10 px-3 py-2 flex items-center gap-2 shrink-0">
              <Megaphone className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase text-primary">Announcements</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="animate-marquee whitespace-nowrap py-2">
                {marqueeAnnouncements.map((ann, idx) => (
                  <span key={ann.id} className="mx-8">
                    <span className={cn(
                      "font-medium",
                      ann.priority === 'urgent' ? 'text-destructive' :
                        ann.priority === 'high' ? 'text-orange-500' : 'text-foreground'
                    )}>
                      {ann.title}:
                    </span>
                    <span className="ml-2 text-muted-foreground">{ann.message}</span>
                    {ann.created_by_name && (
                      <span className="ml-2 text-xs opacity-60 italic">- {ann.created_by_name}</span>
                    )}
                    {idx < marqueeAnnouncements.length - 1 && (
                      <span className="mx-4 text-muted-foreground">•</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
