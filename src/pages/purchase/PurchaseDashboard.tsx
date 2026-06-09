import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Clock, CheckCircle, Truck, Search, RefreshCw, FileText, Plus, Scale, MessageSquare, Eye, ShoppingBag, ArrowRight, Split, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMaterialRequests } from '@/hooks/useMaterialRequests';
import { useVendorQuotes } from '@/hooks/useVendorQuotes';
import { usePurchaseProgress } from '@/hooks/usePurchaseProgress';
import { cn } from '@/lib/utils';
import { AddQuoteForm } from '@/components/purchase/AddQuoteForm';
import { QuoteComparisonModal } from '@/components/purchase/QuoteComparisonModal';
import { PurchaseProgressModal } from '@/components/purchase/PurchaseProgressModal';
import { MaterialRequestDetailModal } from '@/components/purchase/MaterialRequestDetailModal';
import { InternalRequestDialog } from '@/components/purchase/InternalRequestDialog';
import { ApprovalChainDisplay, getMaterialApprovalSteps } from '@/components/purchase/ApprovalChainDisplay';
import { EmployeeActivityWidget } from '@/components/EmployeeActivityWidget';
import { TaskAssignmentWidget } from '@/components/TaskAssignmentWidget';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'New Requests', color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: Clock },
  sourcing: { label: 'Sourcing', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: Search },
  quoted: { label: 'Quoted', color: 'text-violet-400', bgColor: 'bg-violet-500/20', icon: FileText },
  approved: { label: 'Approved', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: CheckCircle },
  ordered: { label: 'Ordered', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20', icon: Package },
  delivered: { label: 'Delivered', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: Truck },
};

const urgencyConfig: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

type DashboardView = 'requests' | 'tracking' | 'completed' | 'team';

// Completed Orders Section Component
function CompletedOrdersSection({ requests }: { requests: any[] }) {
  const completedOrders = requests.filter(r =>
    r.order_status === 'delivered' &&
    r.farm_audit_status === 'verified' &&
    r.added_to_inventory === true
  );

  if (completedOrders.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Completed Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No completed orders yet</p>
            <p className="text-sm">Orders will appear here after delivery verification and inventory addition</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Completed Orders
          <Badge variant="secondary" className="ml-2 bg-green-500/20 text-green-400">{completedOrders.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Project</TableHead>
                <TableHead className="font-semibold">Items</TableHead>
                <TableHead className="font-semibold">Delivery Date</TableHead>
                <TableHead className="font-semibold">Audited By</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-semibold">{order.project?.project_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{order.project?.project_id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {order.boq_items?.length || 0} items
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">
                      {order.actual_delivery_date
                        ? new Date(order.actual_delivery_date).toLocaleDateString()
                        : '—'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground">
                      {order.farm_audit_notes || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-green-500/20 text-green-400 border-0 gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Completed
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Order Tracking Section Component - For active orders
function OrderTrackingSection({ requests, updateRequest }: { requests: any[], updateRequest: any }) {
  const activeOrders = requests.filter(r =>
    r.status === 'ordered' || (r.order_status && r.order_status !== 'delivered' && r.order_status !== 'not_ordered')
  );

  const statusOptions = [
    { value: 'ordered', label: 'Ordered', icon: Package, color: 'text-indigo-400' },
    { value: 'shipped', label: 'Shipped', icon: Truck, color: 'text-blue-400' },
    { value: 'loading', label: 'Loading', icon: RefreshCw, color: 'text-amber-400' },
    { value: 'unloading', label: 'Unloading', icon: RefreshCw, color: 'text-orange-400' },
    { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'text-emerald-400' },
  ];

  if (activeOrders.length === 0) {
    return (
      <Card className="border-border/50 bg-black/20 backdrop-blur-xl">
        <CardContent className="py-12 text-center text-muted-foreground">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No active orders being tracked</p>
          <p className="text-sm">Once a request is marked as "Ordered", it will appear here for status updates.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeOrders.map((order) => (
          <Card key={order.id} className="border-border/50 bg-black/20 backdrop-blur-xl hover:border-primary/30 transition-all group">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="font-bold truncate max-w-[180px]">{order.project?.project_name || 'Internal Request'}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{order.project?.project_id || 'INTERNAL-REQ'}</p>
                </div>
                <Badge className={cn(
                  "capitalize border-none shadow-sm",
                  order.urgency === 'critical' ? 'bg-red-500/20 text-red-400 shadow-red-500/10' :
                    order.urgency === 'high' ? 'bg-amber-500/20 text-amber-400 shadow-amber-500/10' :
                      'bg-blue-500/20 text-blue-400 shadow-blue-500/10'
                )}>
                  {order.urgency}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/30">
                <Package className="w-4 h-4 text-primary/70" />
                <span className="font-medium text-foreground/80">{order.boq_items?.length || 0} items requested</span>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Current Lifecycle status</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    defaultValue={order.order_status || 'ordered'}
                    onValueChange={(val) => updateRequest(order.id, {
                      order_status: val,
                      status: val === 'delivered' ? 'delivered' : 'ordered',
                      actual_delivery_date: val === 'delivered' ? new Date().toISOString() : order.actual_delivery_date
                    })}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background/50 border-border/40 hover:border-primary/40 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover/95 backdrop-blur-lg border-border/40">
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          <div className="flex items-center gap-2">
                            <opt.icon className={cn("w-3 h-3", opt.color)} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all font-bold"
                    onClick={() => updateRequest(order.id, {
                      status: 'delivered',
                      order_status: 'delivered',
                      actual_delivery_date: new Date().toISOString()
                    })}
                  >
                    <CheckCircle className="w-3 h-3" />
                    Delivered
                  </Button>
                </div>
              </div>

              {order.estimated_delivery_date && (
                <div className="pt-2 border-t border-border/20 flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Est. Arrival</span>
                  <span className="text-xs font-mono font-bold text-primary">{new Date(order.estimated_delivery_date).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function PurchaseDashboard() {
  const { requests, isLoading, isSaving, updateRequest, splitRequest, refetch } = useMaterialRequests();
  const { quotes, addQuote, selectQuote, isSaving: quoteSaving } = useVendorQuotes();
  const { logs, addProgress, isLoading: progressLoading, getLogsForRequest, getLogsForGroup } = usePurchaseProgress();
  const [dashboardView, setDashboardView] = useState<DashboardView>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [addQuoteOpen, setAddQuoteOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const isApprovedByGMO = (r: any) => {
    // FIX: Allow visibility for requests that are in 'pending', 'sourcing', 'quoted', or 'approved'
    // even if they are 'pending_smo' (e.g. after a split or after adding quotes)
    if (r.status === 'pending' || r.status === 'sourcing' || r.status === 'quoted' || r.status === 'approved') return true;

    return r.approval_status !== 'pending_smo' && r.approval_status !== 'pending_gmo';
  };

  const filteredRequests = requests.filter(r => {
    if (!isApprovedByGMO(r)) return false;
    // Safety: Hide requests with no items (usually redundant after a full split)
    if (!r.boq_items || r.boq_items.length === 0) return false;

    const matchesSearch = r.project?.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    // For 'quoted' tab, include 'approved' requests since they are ready to be ordered
    if (activeTab === 'quoted') {
      return matchesSearch && (r.status === 'quoted' || r.status === 'approved');
    }

    const matchesTab = activeTab === 'all' || r.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const stats = {
    pending: requests.filter(r => isApprovedByGMO(r) && r.boq_items?.length > 0 && r.status === 'pending').length,
    sourcing: requests.filter(r => isApprovedByGMO(r) && r.boq_items?.length > 0 && r.status === 'sourcing').length,
    quoted: requests.filter(r => isApprovedByGMO(r) && r.boq_items?.length > 0 && (r.status === 'quoted' || r.status === 'approved')).length,
    ordered: requests.filter(r => isApprovedByGMO(r) && r.boq_items?.length > 0 && (r.status === 'ordered' || r.order_status === 'ordered' || r.order_status === 'loading')).length,
  };

  const handleStartSourcing = async (requestId: string) => {
    await updateRequest(requestId, { status: 'sourcing' });
  };

  const handleAddQuote = async (data: any) => {
    if (!selectedRequestId) return;
    const request = requests.find(r => r.id === selectedRequestId);
    if (!request) return;

    await addQuote({
      material_request_id: selectedRequestId,
      project_id: request.project_id,
      boq_item_id: null,
      vendor_name: data.vendor_name,
      vendor_contact: data.vendor_contact,
      vendor_email: null,
      quoted_unit_price: data.unit_price,
      quoted_total: data.total_price,
      quote_document_url: null,
      validity_date: data.validity_date || null,
      delivery_days: data.delivery_days,
      notes: data.notes,
      quote_drive_link: data.quote_drive_link || null,
      vendor_bank_name: data.vendor_bank_name || null,
      vendor_account_number: data.vendor_account_number || null,
      vendor_ifsc: data.vendor_ifsc || null,
      vendor_gst: data.vendor_gst || null,
      quoted_items: data.item_prices || [],
    });

    // Check if we have 3 quotes, update status to quoted
    const requestQuotes = quotes.filter(q => q.material_request_id === selectedRequestId);
    if (requestQuotes.length >= 2) {
      await updateRequest(selectedRequestId, { status: 'quoted' });
    }
  };

  const handleSelectQuote = async (quoteId: string) => {
    if (!selectedRequestId) return;
    await selectQuote(quoteId, selectedRequestId);
    // Refetch material requests to get updated approval_status
    await refetch();
    setCompareOpen(false);
  };

  const handleAddProgress = async (requestId: string, updateText: string, statusUpdate?: string) => {
    await addProgress(requestId, updateText, statusUpdate);
    toast.success('Progress update added');
  };

  const getQuotesForRequest = (requestId: string) => {
    return quotes.filter(q => q.material_request_id === requestId);
  };

  const selectedRequest = selectedRequestId ? requests.find(r => r.id === selectedRequestId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
            <ShoppingBag className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Purchase Dashboard
            </h1>
            <p className="text-muted-foreground text-sm">Manage material requests and procurement orders</p>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Internal Request Button */}
          <InternalRequestDialog>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-500/20 group transition-all duration-300 hover:scale-105">
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              Raise Internal Request
            </Button>
          </InternalRequestDialog>
        </div>

        <Button variant="outline" onClick={() => refetch()} className="gap-2 shrink-0">
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </motion.div>

      {/* Main View Tabs */}
      <Tabs value={dashboardView} onValueChange={(v) => setDashboardView(v as DashboardView)} className="mb-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-black/40 backdrop-blur-md border border-white/5">
          <TabsTrigger value="requests" className="gap-2">
            <Package className="w-4 h-4" />
            Material Requests
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-2">
            <Truck className="w-4 h-4" />
            Order Status
            {requests.filter(r => r.status === 'ordered').length > 0 && (
              <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center bg-primary text-[10px] text-primary-foreground">
                {requests.filter(r => r.status === 'ordered').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Completed
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="w-4 h-4" />
            Team Monitor
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {dashboardView === 'completed' ? (
        <CompletedOrdersSection requests={requests} />
      ) : dashboardView === 'tracking' ? (
        <OrderTrackingSection requests={requests} updateRequest={updateRequest} />
      ) : dashboardView === 'team' ? (
        <div className="space-y-6">
          <EmployeeActivityWidget
            title="Purchase Team Activity"
            filterDepartments={['Purchase']}
          />
          <div className="mt-6">
            <TaskAssignmentWidget
              title="Assign Tasks to Purchase Team"
              restrictDepartments={['Purchase']}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
            {Object.entries(stats).map(([key, value], i) => {
              const config = statusConfig[key];
              const isActive = activeTab === key;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card
                    className={cn(
                      "relative overflow-hidden border-border/50 cursor-pointer transition-all duration-300",
                      "bg-black/20 backdrop-blur-sm hover:scale-[1.02] hover:shadow-xl hover:border-primary/40",
                      isActive ? "ring-2 ring-primary/50 border-primary/50 shadow-lg shadow-primary/10" : "hover:bg-black/30"
                    )}
                    onClick={() => setActiveTab(key)}
                  >
                    {/* Background Glow */}
                    <div className={cn(
                      "absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity",
                      config.bgColor
                    )} />

                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", config.bgColor, "shadow-inner")}>
                          <config.icon className={cn("w-6 h-6", config.color)} />
                        </div>
                        <div className="text-right">
                          <p className={cn("text-3xl font-black tracking-tighter transition-all", isActive ? "scale-110 " + config.color : "text-foreground")}>
                            {value}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                            {config.label}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Requests Table - Full Width */}
            <div className="xl:col-span-4 space-y-4">
              {/* Search & Filter Bar */}
              <Card className="border-border/50">
                <CardContent className="p-3 md:p-4">
                  <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by project or requester..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-muted/30"
                      />
                    </div>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                      <TabsList className="grid grid-cols-5 w-full md:w-auto">
                        <TabsTrigger value="pending" className="text-xs px-2">New</TabsTrigger>
                        <TabsTrigger value="sourcing" className="text-xs px-2">Sourcing</TabsTrigger>
                        <TabsTrigger value="quoted" className="text-xs px-2">Quoted</TabsTrigger>
                        <TabsTrigger value="ordered" className="text-xs px-2">Ordered</TabsTrigger>
                        <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>

              {/* Requests Table */}
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="pb-0 px-4 md:px-6 pt-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Material Requests
                    <Badge variant="secondary" className="ml-2">{filteredRequests.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 md:p-2">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-semibold">Project</TableHead>
                          <TableHead className="font-semibold">Requester</TableHead>
                          <TableHead className="font-semibold text-center">Items</TableHead>
                          <TableHead className="font-semibold text-center">Urgency</TableHead>
                          <TableHead className="font-semibold text-center">Status</TableHead>
                          <TableHead className="font-semibold">Approval Progress</TableHead>
                          <TableHead className="font-semibold text-center">Quotes</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequests.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12">
                              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Package className="w-10 h-10 opacity-30" />
                                <p className="font-medium">No requests found</p>
                                <p className="text-sm">Material requests will appear here</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRequests.map((request, index) => {
                            const requestQuotes = getQuotesForRequest(request.id);
                            const requestLogs = request.split_group_id
                              ? getLogsForGroup(request.split_group_id, requests)
                              : getLogsForRequest(request.id);
                            return (
                              <motion.tr
                                key={request.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="group hover:bg-muted/50 cursor-pointer border-b border-border/50 last:border-0"
                                onClick={() => { setSelectedRequestId(request.id); setDetailOpen(true); }}
                              >
                                <TableCell className="font-medium py-4">
                                  <div className="max-w-[200px]">
                                    <p className="truncate font-bold text-foreground group-hover:text-primary transition-colors">
                                      {request.project?.project_name || 'Internal Request'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <Badge variant="secondary" className="text-[10px] px-1.5 font-normal bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20">
                                        {request.project?.project_id || 'INTERNAL-PROC-REQ'}
                                      </Badge>
                                      {request.phase?.phase_name && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 font-normal border-amber-500/30 text-amber-500">
                                          {request.phase.phase_name}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{request.requester?.name || 'Unknown'}</p>
                                    <p className="text-xs text-muted-foreground">{request.requester?.department || ''}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex flex-col gap-1 max-w-[200px]">
                                    {request.boq_items?.slice(0, 2).map((item: any, i: number) => (
                                      <div key={i} className="text-xs text-left">
                                        <span className="font-medium text-foreground">{item.material_name || 'Item'}</span>
                                        {item.specification && (
                                          <span className="text-[10px] text-muted-foreground block truncate max-w-[180px] opacity-80 pl-1 border-l-2 border-primary/20 ml-0.5">
                                            {item.specification}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {(request.boq_items?.length || 0) > 2 && (
                                      <Badge variant="outline" className="w-fit text-[10px] h-5 mt-0.5">
                                        +{(request.boq_items?.length || 0) - 2} more
                                      </Badge>
                                    )}
                                    {(request.boq_items?.length || 0) === 0 && (
                                      <span className="text-xs text-muted-foreground">No items</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={cn("capitalize", urgencyConfig[request.urgency])}>
                                    {request.urgency}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={cn(statusConfig[request.status]?.bgColor, statusConfig[request.status]?.color, "border-0")}>
                                    {statusConfig[request.status]?.label || request.status}
                                  </Badge>
                                </TableCell>
                                {/* Approval Progress Column - Only show AFTER quote is selected */}
                                <TableCell>
                                  {request.selected_quote_id && request.approval_status ? (
                                    <ApprovalChainDisplay
                                      steps={getMaterialApprovalSteps(request)}
                                      className="scale-75 origin-left"
                                    />
                                  ) : request.status === 'quoted' && !request.selected_quote_id ? (
                                    <span className="text-xs text-amber-400">Select quote first</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className={cn(
                                    "inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold",
                                    requestQuotes.length >= 3
                                      ? "bg-green-500/20 text-green-400"
                                      : "bg-muted text-muted-foreground"
                                  )}>
                                    {requestQuotes.length}/3
                                  </div>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => { setSelectedRequestId(request.id); setDetailOpen(true); }}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    {request.status === 'pending' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 h-8"
                                        onClick={() => handleStartSourcing(request.id)}
                                      >
                                        <ArrowRight className="w-3 h-3" />
                                        Start
                                      </Button>
                                    )}
                                    {request.status === 'sourcing' && (
                                      <Button
                                        size="sm"
                                        className="gap-1 h-8"
                                        onClick={() => { setSelectedRequestId(request.id); setAddQuoteOpen(true); }}
                                      >
                                        <Plus className="w-3 h-3" />
                                        Quote
                                      </Button>
                                    )}
                                    {/* Only show Compare button if quoted AND no quote selected yet (regardless of approval_status) */}
                                    {request.status === 'quoted' && !request.selected_quote_id && (
                                      <Button
                                        size="sm"
                                        className="gap-1 h-8"
                                        onClick={() => { setSelectedRequestId(request.id); setCompareOpen(true); }}
                                      >
                                        <Scale className="w-3 h-3" />
                                        Compare
                                      </Button>
                                    )}
                                    {/* Mark as Ordered */}
                                    {request.status === 'approved' && (
                                      <Button
                                        size="sm"
                                        className="gap-1 h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                                        onClick={() => updateRequest(request.id, { status: 'ordered', order_status: 'ordered' })}
                                      >
                                        <Package className="w-3 h-3" />
                                        Ordered
                                      </Button>
                                    )}

                                    {/* Mark as Delivered */}
                                    {request.status === 'ordered' && (
                                      <Button
                                        size="sm"
                                        className="gap-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        onClick={() => updateRequest(request.id, { status: 'delivered', order_status: 'delivered', actual_delivery_date: new Date().toISOString() })}
                                      >
                                        <Truck className="w-3 h-3" />
                                        Delivered
                                      </Button>
                                    )}

                                    {/* Show approval status badge if quote selected and in approval flow but not yet approved */}
                                    {request.selected_quote_id && request.approval_status && request.status !== 'approved' && request.status !== 'ordered' && request.status !== 'delivered' && (
                                      <Badge variant="outline" className={cn(
                                        "h-8 px-2 flex items-center shrink-0",
                                        request.approval_status === 'ceo_approved'
                                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                                          : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                      )}>
                                        {request.approval_status === 'pending_gm' ? 'Pending GM' :
                                          request.approval_status === 'pending_admin' ? 'Pending Admin' :
                                            request.approval_status === 'pending_ceo' ? 'Pending CEO' :
                                              request.approval_status === 'ceo_approved' ? 'Approved' :
                                                request.approval_status}
                                      </Badge>
                                    )}
                                    {request.status !== 'pending' && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 relative"
                                        onClick={() => { setSelectedRequestId(request.id); setProgressOpen(true); }}
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                        {requestLogs.length > 0 && (
                                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] flex items-center justify-center">
                                            {requestLogs.length}
                                          </span>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </motion.tr>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Add Quote Modal */}
          <AddQuoteForm
            open={addQuoteOpen}
            onOpenChange={setAddQuoteOpen}
            onSubmit={handleAddQuote}
            isLoading={quoteSaving}
            boqItems={selectedRequest?.boq_items || []}
          />

          {/* Quote Comparison Modal */}
          {selectedRequestId && (
            <QuoteComparisonModal
              open={compareOpen}
              onOpenChange={setCompareOpen}
              quotes={getQuotesForRequest(selectedRequestId)}
              onSelectQuote={handleSelectQuote}
              isLoading={quoteSaving}
            />
          )}

          {/* Progress Update Modal */}
          {selectedRequestId && (
            <PurchaseProgressModal
              open={progressOpen}
              onOpenChange={setProgressOpen}
              requestId={selectedRequestId}
              projectName={selectedRequest?.project?.project_name}
              existingLogs={selectedRequest?.split_group_id
                ? getLogsForGroup(selectedRequest.split_group_id, requests)
                : getLogsForRequest(selectedRequestId)}
              onSubmit={handleAddProgress}
              isLoading={progressLoading}
            />
          )}

          {/* Material Request Detail Modal */}
          <MaterialRequestDetailModal
            open={detailOpen}
            onOpenChange={setDetailOpen}
            request={selectedRequest || null}
            progressLogs={selectedRequestId ? getLogsForRequest(selectedRequestId) : []}
            onStartSourcing={() => {
              if (selectedRequestId) {
                handleStartSourcing(selectedRequestId);
                setDetailOpen(false);
              }
            }}
            onAddQuote={() => {
              setDetailOpen(false);
              setAddQuoteOpen(true);
            }}
            onSplit={splitRequest}
            isLoading={isSaving}
          />
        </>
      )}
    </div>
  );
}
