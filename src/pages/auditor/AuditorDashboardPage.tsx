import { motion } from 'framer-motion';
import { useState, useCallback } from 'react';
import {
    ShieldCheck,
    Users,
    Search,
    FolderKanban,
    AlertTriangle,
    Camera,
    ClipboardList,
    FileSearch,
    LayoutDashboard,
    Banknote,
    Activity,
    History,
    CheckCircle2,
    Lock,
    LayoutPanelTop,
    TrendingUp,
    CreditCard,
    BarChart3,
    RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { AuditorReportingWidget } from '../../components/AuditorReportingWidget';
import { ExecutiveTicketTable } from '@/components/ExecutiveTicketTable';
import { PaymentFlowAnalytics } from '@/components/PaymentFlowAnalytics';
import { EmployeeActivityWidget } from '@/components/EmployeeActivityWidget';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useEscalationEngine } from '@/hooks/useEscalationEngine';
import { cn } from '@/lib/utils';


export default function AuditorDashboardPage() {
    const { requests: paymentRequests, isLoading: paymentsLoading } = usePaymentRequests();
    const { counts } = useEscalationEngine();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 p-6 lg:p-10"
        >
            {/* Dynamic Glassmorphism Header */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-authority-admin/20 via-authority-admin/5 to-transparent p-12 border border-authority-admin/20 shadow-2xl">
                <div className="absolute top-0 right-0 -m-20 w-80 h-80 bg-authority-admin/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-0 left-0 -m-20 w-60 h-60 bg-blue-500/5 rounded-full blur-[80px]" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 rounded-2xl bg-authority-admin/10 border border-authority-admin/20">
                            <ShieldCheck className="w-8 h-8 text-authority-admin" />
                        </div>
                        <div className="text-center md:text-left">
                            <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                                <div className="flex items-center gap-6">
                                    <span className="text-[10px] font-bold text-authority-admin uppercase tracking-[0.2em] opacity-50 px-1 border-l-2 border-authority-admin/30">Intelligence Suite</span>
                                </div>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/80 to-foreground/40 bg-clip-text text-transparent">
                                National Head Auditor
                            </h1>
                        </div>
                    </div>
                </div>
            </div>


            {/* Audit Navigation */}
            <Tabs defaultValue="intelligence" className="w-full">
                <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    <TabsList className="bg-muted/50 p-1.5 h-auto gap-1 rounded-2xl border border-border/50">
                        <TabsTrigger value="intelligence" className="gap-2 px-6 py-3 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg font-bold text-sm transition-all duration-300">
                            <Activity className="w-4 h-4" /> Intelligence Hub
                        </TabsTrigger>
                        <TabsTrigger value="activity" className="gap-2 px-6 py-3 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg font-bold text-sm transition-all duration-300">
                            <Users className="w-4 h-4" /> Activity Monitor
                        </TabsTrigger>
                        <TabsTrigger value="tickets" className="gap-2 px-6 py-3 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg font-bold text-sm transition-all duration-300 relative">
                            <AlertTriangle className="w-4 h-4" /> Tickets
                            {(counts?.escalationActive || 0) + (counts?.criticalActive || 0) > 0 && (
                                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-white border-0 animate-bounce text-[10px]">
                                    {(counts?.escalationActive || 0) + (counts?.criticalActive || 0)}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="payments" className="gap-2 px-6 py-3 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg font-bold text-sm transition-all duration-300 relative">
                            <Banknote className="w-4 h-4" /> Payment Intelligence
                            {(paymentRequests?.length || 0) > 0 && (
                                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-green-600 text-white border-0 text-[10px]">
                                    {paymentRequests?.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="intelligence" className="space-y-8 motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <AuditorReportingWidget />
                </TabsContent>

                <TabsContent value="activity" className="space-y-8 motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <EmployeeActivityWidget title="National Personnel Activity Ledger" />
                </TabsContent>

                <TabsContent value="tickets" className="space-y-6 motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ExecutiveTicketTable role="admin" />
                </TabsContent>

                <TabsContent value="payments" className="space-y-8 motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-bold tracking-tight">Financial Flow Analytics</h2>
                        </div>
                        <PaymentFlowAnalytics requests={paymentRequests} />
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <CreditCard className="w-5 h-5 text-green-500" />
                            <h2 className="text-xl font-bold tracking-tight">Payment Audit Queue</h2>
                        </div>
                        <div className="p-12 text-center space-y-6 rounded-[2rem] bg-gradient-to-br from-authority-admin/10 via-background to-background border border-authority-admin/20 shadow-xl">
                            <div className="w-20 h-20 rounded-full bg-authority-admin/20 flex items-center justify-center mx-auto shadow-inner">
                                <CreditCard className="w-10 h-10 text-authority-admin" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black tracking-tight text-foreground">Farmers Factory Verification</h3>
                                <p className="text-muted-foreground font-medium max-w-md mx-auto">
                                    Process and verify incoming payment requests from the Farmers Factory department.
                                </p>
                            </div>
                            <Button
                                onClick={() => window.location.href = '/auditor/payment-audit'}
                                className="h-14 rounded-2xl bg-authority-admin hover:bg-authority-admin/90 px-10 font-black shadow-lg shadow-authority-admin/20 transition-all hover:-translate-y-1 active:scale-95 text-lg"
                            >
                                <ShieldCheck className="w-6 h-6 mr-2" /> Enter Audit Pipeline
                            </Button>
                        </div>
                    </section>
                </TabsContent>

            </Tabs>
        </motion.div >
    );
}
