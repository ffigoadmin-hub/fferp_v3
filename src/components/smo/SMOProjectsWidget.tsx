import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSMOProjects } from '@/hooks/useSMOData';
import { useProjectExecution } from '@/hooks/useProjectExecution';
import { useProjectInventory } from '@/hooks/useProjectInventory';
import {
  FolderKanban,
  ChevronDown,
  MapPin,
  Clock,
  IndianRupee,
  Loader2,
  Box,
  Package,
  FileText,
  Activity,
  AlertTriangle,
  Target,
  Wrench,
  CreditCard,
  RefreshCw,
  Layers,
  ArrowRight,
  SearchX
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// Minimal Financial Bar Component with improved transitions
function MinimalProgress({ value, max, label, colorClass = "bg-primary" }: { value: number, max: number, label?: string, colorClass?: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const clampedPercentage = Math.min(percentage, 100);

  return (
    <div className="w-full space-y-2 group">
      {label && (
        <div className="flex justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span>{label}</span>
          <span className="text-foreground group-hover:text-primary transition-colors duration-300">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-muted/50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedPercentage}%` }}
          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }} // Spring-like ease
          className={cn("h-full rounded-full shadow-sm", colorClass)}
        />
      </div>
    </div>
  );
}

// Project Details Card Component
function ProjectDetailsCard({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState('overview');
  const { summary, details, isLoading } = useProjectExecution(projectId);
  const { items: inventoryItems, isLoading: inventoryLoading, getBalance, refetch: refetchInventory } = useProjectInventory(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        <p className="text-xs font-medium text-muted-foreground animate-pulse">Synchronizing Data...</p>
      </div>
    );
  }

  if (!summary || !details) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
        <div className="p-3 bg-card rounded-full shadow-sm mb-3">
          <AlertTriangle className="w-6 h-6 text-amber-500/80" />
        </div>
        <p className="text-sm font-semibold text-foreground">Data Unavailable</p>
        <p className="text-xs text-muted-foreground mt-1">Unable to retrieve execution details.</p>
      </div>
    );
  }

  const materialProgress = summary.total_boq_items > 0
    ? ((summary.delivered_boq_items / summary.total_boq_items) * 100)
    : 0;

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      admin_approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      ceo_approved: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
      completed: 'bg-muted text-muted-foreground border-border',
    };
    return (
      <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5 capitalize transition-colors duration-200 cursor-default", statusStyles[status] || 'bg-muted text-muted-foreground border-border')}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
      {/* Quick Stats Grid with interaction */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'BOQ Items', value: summary.total_boq_items, icon: FileText, color: 'text-muted-foreground', iconBg: 'bg-muted' },
          { label: 'Purchase Orders', value: summary.total_pos, icon: Package, color: 'text-blue-500', iconBg: 'bg-blue-500/10' },
          { label: 'Work Orders', value: summary.total_wos, icon: Wrench, color: 'text-violet-500', iconBg: 'bg-violet-500/10' },
          { label: 'Total Paid', value: `₹${(summary.total_paid / 1000).toFixed(0)}K`, icon: IndianRupee, color: 'text-emerald-500', iconBg: 'bg-emerald-500/10' },
        ].map((stat, i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border shadow-sm hover:border-primary/20 transition-all duration-300 group">
            <div className="flex items-center gap-2.5 mb-2">
              <div className={cn("p-2 rounded-lg transition-colors duration-300", stat.iconBg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">{stat.label}</p>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight ml-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full bg-muted/40 p-1 mb-8 border border-border rounded-xl justify-start h-auto gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'orders', label: 'Procurement', icon: Package },
            { id: 'inventory', label: 'Inventory', icon: Box },
            { id: 'payments', label: 'Financials', icon: CreditCard },
            { id: 'timeline', label: 'Timeline', icon: Clock },
          ].map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="group flex-1 lg:flex-none px-5 py-2.5 text-xs font-semibold uppercase tracking-wide
                data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5
                text-muted-foreground hover:text-foreground hover:bg-card/50
                transition-all duration-200 ease-out"
            >
              <tab.icon className="w-3.5 h-3.5 mr-2 opacity-70 group-hover:opacity-100 group-data-[state=active]:opacity-100 transition-opacity" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-h-[420px] relative">
          <TabsContent value="overview" className="mt-0 space-y-6 focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Phase Tracking */}
              <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
                <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2.5">
                    <Target className="w-4 h-4 text-primary" />
                    Project Phases
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[320px]">
                    <div className="divide-y divide-border">
                      {details.phases?.map((phase: any) => (
                        <div key={phase.id} className="p-5 hover:bg-muted/30 transition-colors duration-200">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Phase {phase.phase_order}</span>
                            <Badge variant="secondary" className="text-[10px] font-semibold bg-muted text-muted-foreground border-border px-2">
                              {phase.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-foreground mb-4 ml-1">{phase.phase_name}</p>
                          <MinimalProgress value={phase.completion_percentage || 0} max={100} colorClass="bg-primary" />
                        </div>
                      ))}
                      {(!details.phases || details.phases.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground space-y-2">
                          <Layers className="w-8 h-8 opacity-20" />
                          <p className="text-sm font-medium opacity-60">No phases defined</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Material Stats */}
              <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300 h-full bg-card">
                <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-orange-500" />
                    Material Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">Overall Delivery</span>
                      <span className="text-2xl font-bold text-foreground tracking-tight">{Math.round(materialProgress)}%</span>
                    </div>
                    <MinimalProgress value={Math.round(materialProgress)} max={100} colorClass="bg-orange-500" />
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border">
                    <div className="space-y-2 p-4 bg-muted/20 rounded-xl border border-border text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pending BOQ</p>
                      <p className="text-3xl font-bold text-foreground">{summary.pending_boq_items}</p>
                    </div>
                    <div className="space-y-2 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center">
                      <p className="text-[10px] text-emerald-600/70 uppercase font-bold tracking-wider">Delivered</p>
                      <p className="text-3xl font-bold text-emerald-700">{summary.delivered_boq_items}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-0 focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Purchase Orders */}
              <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
                <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2.5">
                    <Package className="w-4 h-4 text-blue-500" />
                    Purchase Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[350px]">
                    <div className="divide-y divide-border">
                      {details.purchaseOrders?.map((po: any) => (
                        <div key={po.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors duration-200 group">
                          <div className="min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">PO-{String(po.po_number).padStart(3, '0')}</p>
                            </div>
                            <p className="text-xs text-muted-foreground truncate font-medium">{po.vendor_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground mb-1">₹{Number(po.total_amount).toLocaleString()}</p>
                            {getStatusBadge(po.status)}
                          </div>
                        </div>
                      ))}
                      {(!details.purchaseOrders || details.purchaseOrders.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground space-y-2">
                          <div className="p-3 bg-muted rounded-full">
                            <SearchX className="w-6 h-6 opacity-40" />
                          </div>
                          <p className="text-sm font-medium opacity-60">No Purchase Orders</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Work Orders */}
              <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
                <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2.5">
                    <Wrench className="w-4 h-4 text-violet-500" />
                    Work Orders
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[350px]">
                    <div className="divide-y divide-border">
                      {details.workOrders?.map((wo: any) => (
                        <div key={wo.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors duration-200 group">
                          <div className="min-w-0 max-w-[60%]">
                            <p className="text-sm font-bold text-foreground mb-1 group-hover:text-violet-600 transition-colors">WO-{String(wo.wo_number).padStart(3, '0')}</p>
                            <p className="text-xs text-muted-foreground truncate font-medium">{wo.work_description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground mb-1">₹{Number(wo.total_amount).toLocaleString()}</p>
                            {getStatusBadge(wo.status)}
                          </div>
                        </div>
                      ))}
                      {(!details.workOrders || details.workOrders.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground space-y-2">
                          <div className="p-3 bg-muted rounded-full">
                            <SearchX className="w-6 h-6 opacity-40" />
                          </div>
                          <p className="text-sm font-medium opacity-60">No Work Orders</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="mt-0 focus-visible:outline-none">
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
              <CardHeader className="py-4 px-6 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2.5">
                  <Box className="w-4 h-4 text-emerald-500" />
                  Site Inventory
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => refetchInventory()} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-card transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0 z-10 shadow-sm">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-bold text-muted-foreground h-10 pl-6 text-xs uppercase tracking-wide">Material</TableHead>
                        <TableHead className="font-bold text-muted-foreground h-10 text-right text-xs uppercase tracking-wide">Recv</TableHead>
                        <TableHead className="font-bold text-muted-foreground h-10 text-right text-xs uppercase tracking-wide">Used</TableHead>
                        <TableHead className="font-bold text-muted-foreground h-10 text-right text-xs uppercase tracking-wide">Bal</TableHead>
                        <TableHead className="font-bold text-muted-foreground h-10 text-right pr-6 text-xs uppercase tracking-wide">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryItems.map((item) => {
                        const balance = getBalance(item);
                        const isLowStock = balance <= item.quantity_received * 0.2;
                        return (
                          <TableRow key={item.id} className="border-border hover:bg-muted/30 transition-colors duration-150">
                            <TableCell className="font-semibold text-foreground py-3 pl-6">{item.material_name}</TableCell>
                            <TableCell className="text-right text-muted-foreground font-medium py-3 font-mono text-xs">{item.quantity_received}</TableCell>
                            <TableCell className="text-right text-muted-foreground font-medium py-3 font-mono text-xs">{item.quantity_used}</TableCell>
                            <TableCell className={cn("text-right font-bold py-3 font-mono text-xs", isLowStock ? "text-red-500" : "text-emerald-700")}>
                              {balance}
                            </TableCell>
                            <TableCell className="text-right py-3 pr-6">
                              <Badge variant="outline" className={cn(
                                "text-[10px] uppercase font-bold border-0 px-2.5 py-0.5",
                                item.audit_status === 'verified' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                              )}>
                                {item.audit_status || 'Pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {inventoryItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-48 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                              <Box className="w-8 h-8 opacity-20" />
                              <p className="text-sm font-medium opacity-60">No inventory records</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-0 focus-visible:outline-none">
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
              <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[350px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                    {details.payments?.map((payment: any) => (
                      <div key={payment.id} className="p-4 rounded-xl bg-card border border-border shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 group">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded border border-border group-hover:bg-card group-hover:border-emerald-500/30 transition-colors">PAY-{String(payment.payment_number).padStart(3, '0')}</span>
                          {getStatusBadge(payment.status)}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium mb-4 h-8 line-clamp-2 leading-relaxed">{payment.purpose}</p>
                        <div className="flex items-end justify-between pt-3 border-t border-border group-hover:border-border transition-colors">
                          <span className="text-lg font-bold text-foreground tracking-tight">₹{Number(payment.amount).toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{format(new Date(payment.created_at), 'dd MMM')}</span>
                        </div>
                      </div>
                    ))}
                    {(!details.payments || details.payments.length === 0) && (
                      <div className="col-span-full h-48 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                        <CreditCard className="w-10 h-10 opacity-20" />
                        <p className="text-sm font-medium opacity-60">No payment records</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-0 focus-visible:outline-none">
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300 bg-card">
              <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-primary" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ScrollArea className="h-[350px]">
                  <div className="relative pl-6 space-y-8">
                    <div className="absolute left-[5.5px] top-2 bottom-2 w-px bg-border/60" />
                    {details.timeline?.map((event: any, i: number) => (
                      <div key={i} className="relative group">
                        <div className="absolute -left-[23.5px] top-1.5 w-3.5 h-3.5 rounded-full bg-card border-[2.5px] border-muted-foreground group-hover:border-primary transition-colors duration-300 shadow-sm" />
                        <div className="space-y-1.5 pl-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-foreground capitalize group-hover:text-primary transition-colors duration-200">{event.action?.replace(/_/g, ' ')}</p>
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full">
                              {format(new Date(event.created_at), 'dd MMM HH:mm')}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">
                            Performed by <span className="text-foreground font-semibold">{event.performed_by_name}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!details.timeline || details.timeline.length === 0) && (
                      <div className="text-center text-muted-foreground text-sm py-12 flex flex-col items-center">
                        <Clock className="w-8 h-8 opacity-20 mb-2" />
                        <span className="opacity-60 font-medium">No activity recorded</span>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Project Card Component for individual data fetching
function ProjectCard({
  project,
  isExpanded,
  onToggle
}: {
  project: any,
  isExpanded: boolean,
  onToggle: () => void
}) {
  // Fetch real-time execution summary for this specific project
  const { summary, isLoading } = useProjectExecution(project.id);

  // Use real-time total_paid if available, otherwise fallback to project.current_spend (or 0)
  const currentSpend = summary ? summary.total_paid : (project.current_spend || 0);

  // Safe calculation for budget percentage
  const budgetValue = project.total_project_value || 1;
  const rawPercentage = (currentSpend / budgetValue) * 100;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
        isExpanded ? "md:col-span-2 xl:col-span-3 ring-2 ring-primary/10 shadow-xl" : "h-fit"
      )}
    >
      <div
        className="p-7 cursor-pointer flex-1 relative group bg-gradient-to-br from-card to-muted/10"
        onClick={onToggle}
      >
        {/* Card Header & Status */}
        <div className="flex items-start justify-between mb-8">
          <div className="space-y-1.5 flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-[10px] px-2.5 py-1 font-bold uppercase bg-muted text-muted-foreground border border-border tracking-wider">
                {project.vertical || 'General'}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground">#{project.project_id.slice(-6)}</span>
            </div>
            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors duration-300 line-clamp-1">{project.project_name}</h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <MapPin className="w-3.5 h-3.5 opacity-70" />
              <span className="truncate max-w-[220px]">{project.client_name}</span>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "capitalize font-bold border px-3 py-1 transition-colors duration-300",
              project.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 group-hover:bg-emerald-500/20'
                : 'bg-muted text-muted-foreground border-border'
            )}
          >
            {project.status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />}
            {project.status}
          </Badge>
        </div>

        {/* KPI Metrics */}
        <div className="grid grid-cols-1 mb-8">
          <div className="p-4 bg-muted/20 rounded-xl border border-border/50 group-hover:bg-muted/40 transition-colors duration-300">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Net Spend</p>
            <div className="flex items-end gap-2">
              <p className="text-xl font-bold text-foreground">
                {currentSpend > 0 ? `₹${currentSpend.toLocaleString('en-IN')}` : '₹0'}
              </p>
              {isLoading && <Loader2 className="w-3 h-3 mb-1 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </div>

        {/* Footer Progress & Date */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Timeline</span>
            <span>Target: {format(new Date(project.target_completion_date), 'MMM yyyy')}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: isExpanded ? '45%' : '45%' }}
              transition={{ delay: 0.2, duration: 0.8 }}
            />
          </div>
        </div>

        {/* Interactive Hint */}
        {!isExpanded && (
          <div className="absolute right-6 bottom-8 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Content View */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="border-t border-border relative"
          >
            {/* Inner Content Padding */}
            <div className="p-8 lg:p-10 bg-card">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-border font-sans">
                <div>
                  <h4 className="text-xl font-bold text-foreground tracking-tight">Execution Control</h4>
                  <p className="text-sm font-medium text-muted-foreground mt-1">Detailed operational analytics and logs</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onToggle(); }}
                  className="bg-card hover:bg-muted hover:text-primary hover:border-primary/30 border-border text-muted-foreground font-semibold text-xs uppercase tracking-wide gap-2 h-9 transition-all duration-200 shadow-sm"
                >
                  Close View
                  <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                </Button>
              </div>
              <ProjectDetailsCard projectId={project.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SMOProjectsWidget() {
  const { projects, isLoading } = useSMOProjects();
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center bg-card rounded-3xl border border-dashed border-border shadow-sm">
        <div className="p-4 bg-muted rounded-full mb-4">
          <FolderKanban className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-bold text-foreground">No Assigned Projects</h3>
        <p className="text-muted-foreground text-sm mt-1 max-w-xs font-medium">You currently have no active projects in your pipeline.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <AnimatePresence mode="popLayout">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isExpanded={expandedProject === project.id}
            onToggle={() => setExpandedProject(expandedProject === project.id ? null : project.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
