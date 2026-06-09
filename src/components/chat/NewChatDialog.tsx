import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePresence } from "@/hooks/usePresence";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Plus, Loader2, Filter, Users, ShieldAlert, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Profile = {
    id: string;
    name: string | null;
    role: string | null;
    department: string | null;
};

export const NewChatDialog = ({ children, defaultGroupMode }: { children: React.ReactNode; defaultGroupMode?: boolean }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'selection' | 'details'>('selection');
    const { onlineUsers } = usePresence();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [groupName, setGroupName] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");
    const [allDepartments, setAllDepartments] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    const isAdmin = user?.role?.toLowerCase() === 'admin';

    useEffect(() => {
        if (open) {
            fetchProfiles();
            setSelectedUsers([]);
            setGroupName("");
            setSearchTerm("");
            setDeptFilter("all");
            setStep('selection');
        }
    }, [open]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (open && step === 'selection') fetchProfiles(searchTerm, deptFilter);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, deptFilter, open, step]);

    const fetchProfiles = async (search = "", dept = "all") => {
        setLoading(true);
        try {
            const profileSelect = isAdmin ? 'id, name, role, department' : 'id, name';
            let query = supabase
                .from('profiles')
                .select(profileSelect)
                .neq('id', user?.id)
                .limit(100);

            if (search) {
                query = query.ilike('name', `%${search}%`);
            }

            if (isAdmin && dept !== "all") {
                query = query.eq('department', dept);
            }

            const { data, error } = await query;
            if (error) throw error;
            setProfiles((data as any) || []);

            if (isAdmin && allDepartments.length === 0 && data) {
                const depts = Array.from(new Set((data as any[]).map((p: any) => p.department).filter(Boolean))) as string[];
                setAllDepartments(depts);
            }
        } catch (error) {
            console.error('Error fetching profiles:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const toggleUser = (userId: string) => {
        setSelectedUsers(prev => {
            const isRemoving = prev.includes(userId);
            if (!isRemoving && prev.length >= 1 && !isAdmin) {
                toast.error("Only admins can create group chats");
                return prev;
            }
            return isRemoving
                ? prev.filter(id => id !== userId)
                : [...prev, userId];
        });
    };

    const handleNext = () => {
        if (selectedUsers.length === 0) return;
        if (selectedUsers.length === 1) {
            handleCreateChat(); // Direct chat
        } else {
            if (!isAdmin) {
                toast.error("Only admins can create group chats");
                return;
            }
            setStep('details');
        }
    };

    const handleCreateChat = async () => {
        if (!user || selectedUsers.length === 0 || creating) return;

        if (selectedUsers.length > 1 && !groupName.trim()) {
            toast.error("Please enter a group name");
            return;
        }

        setCreating(true);

        try {
            if (selectedUsers.length === 1) {
                const selectedUserId = selectedUsers[0];

                // Check existing direct chat
                const { data: myConversations } = await supabase
                    .from('chat_participants')
                    .select('conversation_id, chat_conversations!inner(type)')
                    .eq('user_id', user.id)
                    .eq('chat_conversations.type', 'direct');

                let existingConversationId = null;
                if (myConversations && myConversations.length > 0) {
                    const conversationIds = myConversations.map(c => c.conversation_id);
                    const { data: participantsMatch } = await supabase
                        .from('chat_participants')
                        .select('conversation_id')
                        .in('conversation_id', conversationIds)
                        .eq('user_id', selectedUserId);

                    if (participantsMatch && participantsMatch.length > 0) {
                        existingConversationId = participantsMatch[0].conversation_id;
                    }
                }

                if (existingConversationId) {
                    setOpen(false);
                    navigate(`/chat/${existingConversationId}`);
                    return;
                }

                const { data: newConv, error: convError } = await supabase
                    .from('chat_conversations')
                    .insert({ type: 'direct', created_by: user.id })
                    .select()
                    .single();

                if (convError) throw convError;

                await supabase.from('chat_participants').insert([
                    { conversation_id: newConv.id, user_id: selectedUserId, role: 'member' }
                ]);

                setOpen(false);
                navigate(`/chat/${newConv.id}`);
                toast.success('Chat started');
            } else {
                // Group Chat
                const { data: newConv, error: convError } = await supabase
                    .from('chat_conversations')
                    .insert({
                        type: 'group',
                        created_by: user.id,
                        name: groupName.trim()
                    })
                    .select()
                    .single();

                if (convError) throw convError;

                const participants = selectedUsers.map(uid => ({
                    conversation_id: newConv.id,
                    user_id: uid,
                    role: 'member'
                }));

                await supabase.from('chat_participants').insert(participants);

                setOpen(false);
                navigate(`/chat/${newConv.id}`);
                toast.success('Group created');
            }
        } catch (error: any) {
            console.error('Error creating chat:', error);
            toast.error(error.message || 'Failed to create chat');
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="p-0 gap-0 overflow-hidden sm:max-w-[480px] bg-background border-border/50 shadow-2xl">
                <DialogHeader className="px-6 py-4 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-xl font-semibold tracking-tight">
                            {step === 'selection' ? (selectedUsers.length > 1 ? 'Add Participants' : 'New Message') : 'Group Details'}
                        </DialogTitle>
                        {step === 'selection' && selectedUsers.length > 1 && (
                            <Badge variant="secondary" className="h-6 px-2 rounded-md font-bold">
                                {selectedUsers.length} Selected
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    {step === 'selection' ? (
                        <>
                            {!isAdmin && (
                                <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                                    <p className="text-[11px] font-medium text-amber-600">
                                        Only administrators can create group chats. You can start direct conversations.
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 h-10 bg-muted/20 border-border/50"
                                    />
                                </div>
                                {isAdmin && (
                                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                                        <SelectTrigger className="w-[150px] h-10 bg-muted/20 border-border/50 text-xs text-muted-foreground">
                                            <Filter className="w-3.5 h-3.5 mr-2" />
                                            <SelectValue placeholder="Dept" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {allDepartments.map(dept => (
                                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            <Command className="border border-border/50 rounded-lg overflow-hidden h-[340px] shadow-sm bg-card">
                                <CommandList className="h-full overflow-y-auto custom-scrollbar">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <span className="text-sm font-medium">Finding people...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <CommandEmpty className="py-12 text-center">
                                                <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                                                <p className="text-muted-foreground font-medium">No users found.</p>
                                            </CommandEmpty>
                                            <CommandGroup heading="Suggestions" className="px-2">
                                                {profiles.map((profile) => {
                                                    const isSelected = selectedUsers.includes(profile.id);
                                                    return (
                                                        <CommandItem
                                                            key={profile.id}
                                                            onSelect={() => toggleUser(profile.id)}
                                                            className={cn(
                                                                "flex items-center gap-3 p-2.5 mb-1 cursor-pointer rounded-lg transition-all duration-200",
                                                                isSelected
                                                                    ? "bg-primary/10 text-primary aria-selected:bg-primary/15"
                                                                    : "hover:bg-muted aria-selected:bg-muted"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-5 h-5 border rounded-md flex items-center justify-center transition-all duration-200",
                                                                isSelected
                                                                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                                                    : "border-muted-foreground/30"
                                                            )}>
                                                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                                            </div>

                                                            <div className="relative">
                                                                <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
                                                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                                        {profile.name?.[0]?.toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                {onlineUsers.has(profile.id) && (
                                                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                                                                )}
                                                            </div>

                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-bold text-sm truncate">
                                                                    {profile.name}
                                                                </span>
                                                                {isAdmin && (
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                                                        {profile.role || 'Employee'}
                                                                    </span>
                                                                    {profile.department && (
                                                                        <span className="text-[10px] text-muted-foreground/60 truncate">
                                                                            • {profile.department}
                                                                        </span>
                                                                    )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CommandItem>
                                                    );
                                                })}
                                            </CommandGroup>
                                        </>
                                    )}
                                </CommandList>
                            </Command>

                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={handleNext}
                                    disabled={selectedUsers.length === 0 || loading}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all font-bold px-10 h-11 rounded-lg"
                                >
                                    {selectedUsers.length > 1 ? 'Next' : 'Start Chat'}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col items-center gap-6 py-4">
                            <div className="relative group">
                                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center border-2 border-dashed border-primary/30 group-hover:border-primary transition-colors cursor-pointer">
                                    <Users className="w-8 h-8 text-primary/40 group-hover:text-primary transition-colors" />
                                </div>
                                <Button size="icon" variant="secondary" className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="w-full space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Group Name</label>
                                    <Input
                                        placeholder="Group name (required)..."
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        className="h-12 bg-muted/20 border-border/50 text-base font-medium"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Selected Members ({selectedUsers.length})</label>
                                    <ScrollArea className="h-[120px] rounded-lg border border-border/50 bg-muted/5 p-2">
                                        <div className="flex flex-wrap gap-2">
                                            {profiles.filter(p => selectedUsers.includes(p.id)).map(p => (
                                                <Badge key={p.id} variant="secondary" className="px-2 py-1 bg-muted/50 border-border/50 gap-1">
                                                    {p.name}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-3 w-3 hover:bg-transparent"
                                                        onClick={() => toggleUser(p.id)}
                                                    >
                                                        <Plus className="h-2 w-2 rotate-45" />
                                                    </Button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>

                            <div className="flex w-full gap-3 pt-4 border-t border-border/50">
                                <Button
                                    variant="ghost"
                                    onClick={() => setStep('selection')}
                                    className="flex-1 font-bold h-11"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleCreateChat}
                                    disabled={!groupName.trim() || creating}
                                    className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all font-bold h-11 rounded-lg"
                                >
                                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Finish
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
