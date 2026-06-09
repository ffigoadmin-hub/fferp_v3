import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { format, addDays } from 'date-fns';
import { Plus, Loader2, Megaphone, Trash2, Eye, EyeOff } from 'lucide-react';

export default function AnnouncementsPage() {
  const { announcements, isLoading, isSaving, createAnnouncement, updateAnnouncement, deleteAnnouncement } = useAnnouncements();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form states
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'normal' | 'low'>('normal');
  const [isMarquee, setIsMarquee] = useState(false);
  const [expiresAt, setExpiresAt] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"));

  const handleSubmit = async () => {
    if (!title || !message) return;
    
    const result = await createAnnouncement({
      title,
      message,
      priority,
      is_marquee: isMarquee,
      expires_at: new Date(expiresAt).toISOString(),
    });
    
    if (result.success) {
      setDialogOpen(false);
      setTitle('');
      setMessage('');
      setPriority('normal');
      setIsMarquee(false);
      setExpiresAt(format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return <Badge variant="destructive">Urgent</Badge>;
      case 'high': return <Badge className="bg-orange-500">High</Badge>;
      case 'normal': return <Badge variant="secondary">Normal</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
      default: return <Badge>{priority}</Badge>;
    }
  };

  const isExpired = (date: string) => new Date(date) < new Date();

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
          <h1 className="text-3xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">Broadcast messages to all employees</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title..."
                />
              </div>
              
              <div>
                <Label>Message *</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your announcement message..."
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Expires At</Label>
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Show as Marquee</p>
                  <p className="text-sm text-muted-foreground">
                    Display as a scrolling banner at the top of the screen
                  </p>
                </div>
                <Switch checked={isMarquee} onCheckedChange={setIsMarquee} />
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleSubmit}
                disabled={!title || !message || isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
                Publish Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">
              {announcements.filter(a => a.is_active && !isExpired(a.expires_at)).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marquee</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">
              {announcements.filter(a => a.is_marquee && a.is_active && !isExpired(a.expires_at)).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Urgent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              {announcements.filter(a => a.priority === 'urgent' && a.is_active && !isExpired(a.expires_at)).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-muted-foreground">
              {announcements.filter(a => isExpired(a.expires_at) || !a.is_active).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Announcements Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Marquee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map(ann => {
                const expired = isExpired(ann.expires_at);
                
                return (
                  <TableRow key={ann.id} className={expired ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{ann.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {ann.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(ann.priority)}</TableCell>
                    <TableCell>
                      {ann.is_marquee ? (
                        <Badge className="bg-blue-500">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {expired ? (
                        <Badge variant="secondary">Expired</Badge>
                      ) : ann.is_active ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>{ann.created_by_name}</TableCell>
                    <TableCell>
                      <span className={expired ? 'text-destructive' : ''}>
                        {format(new Date(ann.expires_at), 'dd MMM yyyy, HH:mm')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateAnnouncement(ann.id, { is_active: !ann.is_active })}
                        >
                          {ann.is_active ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAnnouncement(ann.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {announcements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No announcements yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
