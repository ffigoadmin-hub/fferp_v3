import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
    Building2, 
    ChevronRight, 
    Users, 
    Loader2,
    Search
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useChat } from "./ChatLayout";

type DepartmentStats = {
    name: string;
    count: number;
};

export const DepartmentList = () => {
    const { setActiveTab } = useChat();
    const [departments, setDepartments] = useState<DepartmentStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('department');

            if (error) throw error;

            const counts: Record<string, number> = {};
            data?.forEach(p => {
                if (p.department) {
                    counts[p.department] = (counts[p.department] || 0) + 1;
                }
            });

            const stats = Object.entries(counts).map(([name, count]) => ({
                name,
                count
            })).sort((a, b) => b.count - a.count);

            setDepartments(stats);
        } catch (error) {
            console.error('Error fetching departments:', error);
        } finally {
            setLoading(false);
        }
    };

    const filtered = departments.filter(d => 
        d.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-background border-r border-border/50 w-80">
            <div className="p-4 border-b border-border/50 space-y-4">
                <h2 className="text-xl font-bold tracking-tight">Departments</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search departments..." 
                        className="pl-9 bg-muted/30 border-none h-9 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="p-2 space-y-1">
                        {filtered.map((dept) => (
                            <div 
                                key={dept.name}
                                className="group flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 cursor-pointer transition-all border border-transparent hover:border-primary/10"
                                onClick={() => setActiveTab('employees')}
                            >
                                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                    <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                                        {dept.name}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Users className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                            {dept.count} Members
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
};
