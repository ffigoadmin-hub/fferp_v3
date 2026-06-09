import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { MultiSelect } from '@/components/ui/multi-select';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
}

interface AssignEscalationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    escalationId: string;
    ticketNumber: string;
    issueTitle: string;
    ticketType: 'escalation' | 'critical' | 'site_visit';
    onAssigned?: () => void;
}

export function AssignEscalationModal({
    open,
    onOpenChange,
    escalationId,
    ticketNumber,
    issueTitle,
    ticketType,
    onAssigned
}: AssignEscalationModalProps) {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('all');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch users for assignment
    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                // Fetch ALL active users, no role restriction
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, name, email, role, department')
                    .eq('is_active', true)
                    .order('name');

                if (error) throw error;
                setUsers(data || []);
            } catch (error) {
                console.error('Error fetching users:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (open) {
            fetchUsers();
            setSelectedUserIds([]); // Reset selection on open
        }
    }, [open]);

    // Filter users by selected role for easier finding
    const filteredUsers = (selectedRole && selectedRole !== 'all')
        ? users.filter(u => u.role.toLowerCase() === selectedRole.toLowerCase())
        : users;

    const handleAssign = async () => {
        if (selectedUserIds.length === 0) {
            toast.error('Please select at least one user to assign');
            return;
        }

        setIsSaving(true);
        try {
            const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));
            const primaryUser = selectedUsers[0];

            const table = (ticketType === 'escalation' || ticketType === 'site_visit') ? 'client_escalations' : 'hourly_criticals';
            const timelineTable = (ticketType === 'escalation' || ticketType === 'site_visit') ? 'client_escalation_timeline' : 'hourly_critical_timeline';
            const idField = (ticketType === 'escalation' || ticketType === 'site_visit') ? 'escalation_id' : 'critical_id';

            // 1. Update the record
            const { error: updateError } = await (supabase.from(table) as any)
                .update({
                    assigned_to: primaryUser?.id,
                    assigned_user_id: primaryUser?.id,
                    assigned_user_ids: selectedUserIds,
                    assigned_user_names: selectedUsers.map(u => u.name),
                    assigned_role: selectedUsers.map(u => u.role).join('+'), // Composite role string if mixed
                    assigned_at: new Date().toISOString(),
                    assigned_by: user?.id,
                    status: 'open'
                })
                .eq('id', escalationId);

            if (updateError) throw updateError;

            // 2. Add notifications for ALL assigned users
            const notifications = selectedUsers.map(u => ({
                user_id: u.id,
                type: ticketType === 'escalation' ? 'escalation_assigned' : (ticketType === 'site_visit' ? 'site_visit_assigned' : 'critical_assigned'),
                title: `New ${ticketType === 'escalation' ? 'Escalation' : (ticketType === 'site_visit' ? 'Site Visit Escalation' : 'Critical')} Assigned`,
                content: `You have been assigned to #${ticketNumber}${note ? `: ${note}` : ''}`,
                metadata: { [idField]: escalationId, ticket_number: ticketNumber, ticket_type: ticketType },
                is_read: false
            }));

            const { error: notifyError } = await (supabase.from('notifications') as any)
                .insert(notifications);

            if (notifyError) console.error('Error creating notifications:', notifyError);

            // 3. Add to timeline
            const { error: timelineError } = await (supabase.from(timelineTable) as any)
                .insert({
                    [idField]: escalationId,
                    action: 'assigned',
                    performed_by: user?.id,
                    performed_by_name: (user as any)?.user_metadata?.name || 'BOI',
                    details: {
                        note,
                        assigned_to: selectedUsers.map(u => u.name).join(', '),
                        assigned_role: selectedUsers.map(u => u.role).join('+')
                    }
                });

            if (timelineError) console.error('Error adding timeline entry:', timelineError);

            toast.success(`Assigned to ${selectedUsers.length} user(s)`);
            onOpenChange(false);
            onAssigned?.();

            // Reset state
            setSelectedRole('all');
            setSelectedUserIds([]);
            setNote('');
        } catch (error) {
            console.error('Error assigning escalation:', error);
            toast.error('Failed to assign escalation');
        } finally {
            setIsSaving(false);
        }
    };

    const roleGroups = [...new Set(users.map(u => u.role))].sort();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-primary" />
                        Assign Team
                    </DialogTitle>
                    <DialogDescription>
                        Assign <Badge variant="outline">#{ticketNumber}</Badge> to team members
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Issue Title Preview */}
                    <div className="p-3 rounded-lg bg-muted/50 border">
                        <p className="text-sm font-medium line-clamp-2">{issueTitle}</p>
                    </div>

                    {/* Role Filter */}
                    <div className="space-y-2">
                        <Label>Filter by Role (Optional)</Label>
                        <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Roles" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                {roleGroups.map(role => (
                                    <SelectItem key={role} value={role.toLowerCase()}>
                                        {role} ({users.filter(u => u.role === role).length})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* User Selection (Multi) */}
                    <div className="space-y-2">
                        <Label>Assign To *</Label>
                        {isLoading ? (
                            <div className="flex items-center justify-center h-10">
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                        ) : (
                            <MultiSelect
                                options={filteredUsers.map(u => ({ label: u.name, value: u.id, group: u.role }))}
                                selected={selectedUserIds}
                                onChange={setSelectedUserIds}
                                placeholder="Select team members..."
                            />
                        )}
                        <p className="text-[10px] text-muted-foreground">
                            Selected: {selectedUserIds.length} users
                        </p>
                    </div>

                    {/* Optional Note */}
                    <div className="space-y-2">
                        <Label>Note (Optional)</Label>
                        <Textarea
                            placeholder="Add any instructions or context..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleAssign} disabled={selectedUserIds.length === 0 || isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        Assign & Notify
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
