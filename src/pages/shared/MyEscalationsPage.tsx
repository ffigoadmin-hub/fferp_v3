import { motion } from 'framer-motion';
import { Shield, Loader2, Filter, AlertTriangle, Zap } from 'lucide-react';
import { AssignedEscalationsSection } from '@/components/shared/AssignedEscalationsSection';
import { AssignedCriticalsSection } from '@/components/shared/AssignedCriticalsSection';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MyEscalationsPage() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 max-w-7xl mx-auto p-6"
        >
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Shield className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">My Command Center</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                <span className="font-medium text-gray-700">{user?.name}</span>
                                <span className="mx-2 text-gray-300">•</span>
                                <span className="uppercase font-medium">{user?.department || 'Operations'}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-semibold text-green-700">SYSTEM ACTIVE</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="all" className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <TabsList className="bg-gray-100 p-1 rounded-xl">
                        <TabsTrigger
                            value="all"
                            className="rounded-lg px-5 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                        >
                            Unified View
                        </TabsTrigger>
                        <TabsTrigger
                            value="escalations"
                            className="rounded-lg px-5 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                        >
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5 inline" />
                            Escalations
                        </TabsTrigger>
                        <TabsTrigger
                            value="criticals"
                            className="rounded-lg px-5 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm transition-all"
                        >
                            <Zap className="w-3.5 h-3.5 mr-1.5 inline" />
                            Criticals
                        </TabsTrigger>
                    </TabsList>

                    <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-500">
                        <Filter className="w-3.5 h-3.5" />
                        SORT: RECENT FIRST
                    </div>
                </div>

                <TabsContent value="all" className="space-y-6 mt-0 border-none p-0 outline-none">
                    <AssignedEscalationsSection />
                    <AssignedCriticalsSection />
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
