import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  event_type: 'holiday' | 'event' | 'leave_day';
  description?: string;
  created_by: string;
}

interface CompanyCalendarPageProps {
  embedded?: boolean;
}

export default function CompanyCalendarPage({ embedded = false }: CompanyCalendarPageProps) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  
  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<'holiday' | 'event' | 'leave_day'>('holiday');
  const [formDescription, setFormDescription] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'ceo';

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('company_calendar')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setEvents((data || []) as CalendarEvent[]);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSaveEvent = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }
    if (!formTitle.trim()) {
      toast.error('Please enter a title for the event');
      return;
    }

    try {
      const eventData = {
        title: formTitle,
        date: format(selectedDate, 'yyyy-MM-dd'),
        event_type: formType,
        description: formDescription || null,
        created_by: user?.id,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('company_calendar')
          .update(eventData)
          .eq('id', editingEvent.id);
        if (error) throw error;
        toast.success('Event updated');
      } else {
        const { error } = await supabase
          .from('company_calendar')
          .insert(eventData);
        if (error) throw error;
        
        // Call broadcast edge function
        try {
          await supabase.functions.invoke('broadcast-calendar-event', {
            body: { title: formTitle, date: format(selectedDate, 'yyyy-MM-dd'), event_type: formType }
          });
        } catch (e) {
          console.log('Broadcast notification skipped');
        }
        
        toast.success('Event created');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Failed to save event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('company_calendar')
        .delete()
        .eq('id', eventId);
      if (error) throw error;
      toast.success('Event deleted');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormType('holiday');
    setFormDescription('');
    setEditingEvent(null);
    setSelectedDate(null);
  };

  const openAddDialog = (date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setFormTitle('');
    setFormType('holiday');
    setFormDescription('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedDate(new Date(event.date));
    setFormTitle(event.title);
    setFormType(event.event_type);
    setFormDescription(event.description || '');
    setIsDialogOpen(true);
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(new Date(event.date), day));
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'holiday': return 'bg-red-500/20 text-red-600 border-red-500/30';
      case 'event': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
      case 'leave_day': return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
      default: return 'bg-muted';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'holiday': return 'Holiday';
      case 'event': return 'Event';
      case 'leave_day': return 'Leave Day';
      default: return type;
    }
  };

  return (
    <div className={embedded ? "" : "p-6 max-w-6xl mx-auto"}>
      {/* Header - Hidden when embedded */}
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarIcon className="w-6 h-6" />
              Company Calendar
            </h1>
            <p className="text-muted-foreground">View holidays, events, and company announcements</p>
          </div>
        </div>
      )}

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-2 md:p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center text-xs md:text-sm font-medium text-muted-foreground py-1 md:py-2">
                <span className="md:hidden">{day}</span>
                <span className="hidden md:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[50px] md:min-h-[100px] bg-muted/20 rounded-lg" />
            ))}

            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[50px] md:min-h-[100px] p-1 md:p-2 rounded-lg border transition-colors ${
                    isToday ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                  }`}
                  onClick={() => isAdmin && openAddDialog(day)}
                >
                  <div className="flex items-center justify-between mb-0.5 md:mb-1">
                    <span className={`text-xs md:text-sm font-medium ${isToday ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5 md:w-6 md:h-6 opacity-50 hover:opacity-100 hidden md:flex"
                        onClick={(e) => { e.stopPropagation(); openAddDialog(day); }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-0.5 md:space-y-1">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className={`text-[10px] md:text-xs p-0.5 md:p-1 rounded border cursor-pointer ${getEventTypeColor(event.event_type)}`}
                        onClick={(e) => { e.stopPropagation(); isAdmin && openEditDialog(event); }}
                      >
                        <p className="font-medium truncate">{event.title}</p>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events
              .filter(e => new Date(e.date) >= new Date())
              .slice(0, 10)
              .map(event => (
                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={getEventTypeColor(event.event_type)}>
                      {getEventTypeLabel(event.event_type)}
                    </Badge>
                    <div>
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(event.date), 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(event)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteEvent(event.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            {events.filter(e => new Date(e.date) >= new Date()).length === 0 && (
              <p className="text-center text-muted-foreground py-4">No upcoming events</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <p className="text-sm font-medium mt-1">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : '-'}
              </p>
            </div>
            <div>
              <Label>Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Diwali Holiday"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="event">Company Event</SelectItem>
                  <SelectItem value="leave_day">Declared Leave Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Additional details..."
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSaveEvent}>
                {editingEvent ? 'Update' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
