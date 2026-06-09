import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
    Search,
    Filter,
    MessageSquare,
    UserPlus,
    MoreVertical,
    Mail,
    Phone,
    Building2,
    Loader2,
    Users
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { usePresence } from "@/hooks/usePresence";

type Profile = {
    id: string;
    name: string | null;
    role: string | null;
    department: string | null;
    office_number: string | null;
    email?: string | null;
};

export const EmployeeList = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");
    const [departments, setDepartments] = useState<string[]>([]);

    const { onlineUsers } = usePresence();

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('profiles')
                .select('id, name, role, department, office_number')
                .neq('id', user?.id)
                .order('name')
                .limit(50);

            if (search) {
                query = query.ilike('name', `%${search}%`);
            }

            if (deptFilter !== "all") {
                query = query.eq('department', deptFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            setProfiles(data || []);

            // Only update departments on initial load or if not yet set
            if (departments.length === 0 && data) {
                const depts = Array.from(new Set(data.map(p => p.department).filter(Boolean))) as string[];
                setDepartments(depts);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
            toast.error('Failed to load employees');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchEmployees();
        }, 300); // 300ms debounce for search

        return () => clearTimeout(timer);
    }, [search, deptFilter]);

    const requestConnection = async (targetId: string) => {
        if (!user) return;

        try {
            const { error } = await (supabase
                .from('chat_connections' as any) as any)
                .insert({
                    sender_id: user.id,
                    receiver_id: targetId,
                    status: 'pending'
                });

            if (error) {
                if (error.code === '23505') {
                    toast.error("Request already sent or connection exists");
                } else {
                    throw error;
                }
            } else {
                toast.success("Connection request sent!");
            }
        } catch (error) {
            console.error('Error requesting connection:', error);
            toast.error('Failed to send request');
        }
    };

    const filteredEmployees = profiles.filter(p => {
        const matchesSearch = (p.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
            (p.role?.toLowerCase() || "").includes(search.toLowerCase());
        const matchesDept = deptFilter === "all" || p.department === deptFilter;
        return matchesSearch && matchesDept;
    });

    return (
        <div className="flex flex-col h-full bg-background border-r border-border/50 w-80">
            <div className="p-4 border-b border-border/50 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight">People</h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                        <UserPlus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search people..."
                        className="pl-9 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/20"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex gap-2">
                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                        <SelectTrigger className="h-8 bg-muted/30 border-none text-xs">
                            <Filter className="h-3 w-3 mr-2" />
                            <SelectValue placeholder="All Departments" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {departments.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <ScrollArea className="flex-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                        <span className="text-sm font-medium">Loading employees...</span>
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {filteredEmployees.map((employee) => (
                            <div
                                key={employee.id}
                                className={cn(
                                    "group flex flex-col p-3 rounded-lg transition-all border border-transparent",
                                    user?.role !== 'admin' ? "hover:bg-muted/50 hover:border-border/50 cursor-pointer" : "cursor-default"
                                )}
                                onClick={() => user?.role !== 'admin' && requestConnection(employee.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm group-hover:scale-105 transition-transform">
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                {employee.name?.[0]?.toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        {onlineUsers.has(employee.id) && (
                                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                                                {employee.name}
                                            </h4>
                                            {user?.role !== 'admin' && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium bg-primary/5 text-primary border-none">
                                                {employee.role || 'Employee'}
                                            </Badge>
                                            {employee.department && (
                                                <span className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter font-semibold">
                                                    • {employee.department}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {user?.role !== 'admin' && (
                                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex gap-1.5">
                                            <Button size="icon" variant="secondary" className="h-7 w-7 rounded-full bg-muted shadow-sm">
                                                <UserPlus className="h-3.5 w-3.5 text-primary" />
                                            </Button>
                                            <Button size="icon" variant="secondary" className="h-7 w-7 rounded-full bg-muted shadow-sm">
                                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                            <Button size="icon" variant="secondary" className="h-7 w-7 rounded-full bg-muted shadow-sm">
                                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground ml-auto font-medium">
                                            Connect
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}

                        {filteredEmployees.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                                <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-sm font-semibold text-foreground">No matches found</h3>
                                <p className="text-xs max-w-[180px] mt-1">Try adjusting your search or department filter.</p>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
