import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Headphones, Zap, Loader2, Sparkles, Filter } from 'lucide-react';
import { AssignedEscalationsSection } from '@/components/shared/AssignedEscalationsSection';
import { AssignedCriticalsSection } from '@/components/shared/AssignedCriticalsSection';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MyEscalationsPage() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 max-w-7xl mx-auto"
        >
            {/* Ultra Premium Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-primary/10 border border-white/5 p-8 md:p-12 shadow-2xl">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/5 blur-[120px] rounded-full -mr-20 -mt-20 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-1/4 h-full bg-blue-500/5 blur-[100px] rounded-full -ml-20 -mb-20" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/40 flex items-center justify-center shadow-2xl shadow-primary/20 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                                <Shield className="w-10 h-10 text-white" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-green-500 border-4 border-zinc-900 animate-pulse shadow-lg" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent tracking-tight">
                                    My Command Center
                                </h1>
                                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                            </div>
                            <p className="text-zinc-400 text-lg md:text-xl font-medium max-w-xl leading-relaxed">
                                Name: <span className="text-primary font-bold">{user?.name}</span> • Department: <span className="text-white font-semibold uppercase">{user?.department || 'Operations'}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 text-right">
                        <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">System Status</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                <span className="text-sm font-mono text-zinc-300">NEURAL LINK ACTIVE</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="all" className="w-full">
                <div className="flex items-center justify-between mb-6">
                    <TabsList className="bg-zinc-900/50 border border-white/5 p-1 rounded-2xl">
                        <TabsTrigger value="all" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white transition-all duration-300">
                            Unified View
                        </TabsTrigger>
                        <TabsTrigger value="escalations" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-primary transition-all">
                            Escalations
                        </TabsTrigger>
                        <TabsTrigger value="criticals" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-red-600 data-[state=active]:text-white transition-all">
                            Criticals
                        </TabsTrigger>
                    </TabsList>

                    <div className="hidden md:flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-zinc-400">
                            <Filter className="w-3.5 h-3.5" />
                            SORT: RECENT FIRST
                        </div>
                    </div>
                </div>

                <TabsContent value="all" className="space-y-8 mt-0 border-none p-0 outline-none">
                    <div className="grid grid-cols-1 gap-8">
                        <AssignedEscalationsSection />
                        <AssignedCriticalsSection />
                    </div>
                </TabsContent>

                <TabsContent value="escalations" className="mt-0 border-none p-0 outline-none">
                    <AssignedEscalationsSection />
                </TabsContent>

                <TabsContent value="criticals" className="mt-0 border-none p-0 outline-none">
                    <AssignedCriticalsSection />
                </TabsContent>
            </Tabs>

        </motion.div>
    );
}
