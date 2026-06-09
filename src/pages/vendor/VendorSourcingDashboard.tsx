import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useVendorSourcingQueue, SourcingQueueItem } from '@/hooks/useVendorSourcingQueue';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useVendorWorkRequests } from '@/hooks/useVendorWorkRequests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, ShoppingCart, Users, IndianRupee, 
  Search, Filter, Plus, Save, CheckCircle, 
  ExternalLink, AlertTriangle, RefreshCw,
  Building2, Database, ClipboardCheck, Clock,
  TrendingDown, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Import existing widgets to preserve functionality
import { VendorDatabaseWidget } from '@/components/vendor/VendorDatabaseWidget';
import { VendorSourcingEOD } from '@/components/vendor/VendorSourcingEOD';
import { EmployeeActivityWidget } from '@/components/EmployeeActivityWidget';
import { TaskAssignmentWidget } from '@/components/TaskAssignmentWidget';

export default function VendorSourcingDashboard() {
  const { queue, isLoading, updateQuotes, completeSourcing, refetch } = useVendorSourcingQueue();
  const { alignVendor: alignWorkOrder } = useWorkOrders();
  const { alignVendor: alignWorkRequest } = useVendorWorkRequests();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';
  const isGMOrCEO = userRole === 'gm' || userRole === 'ceo';

  const [selectedItem, setSelectedItem] = useState<SourcingQueueItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mainTab, setMainTab] = useState(isGMOrCEO ? 'database' : 'requests');

  // Update default tab when auth loads
  useEffect(() => {
    if (isGMOrCEO && mainTab === 'requests') {
      setMainTab('database');
    }
  }, [isGMOrCEO]);

  // Align Vendor Form state
  const [isInternal, setIsInternal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'upi'>('bank');
  const [vendorData, setVendorData] = useState({
    aligned_vendor_name: '',
    aligned_vendor_contact: '',
    final_price: 0,
    vendor_account_number: '',
    vendor_beneficiary_name: '',
    vendor_gst: '',
    vendor_ifsc: '',
    vendor_bank_name: '',
    vendor_upi: '',
    vendor_upi_number: '',
    aligned_vendor_details: {} as any
  });

  // Internal WO state
  const [woData, setWoData] = useState({
    detailed_scope: '',
    terms_and_conditions: '',
    start_date: '',
    advance_amount: 0,
  });

  const handleAlignVendor = async (requestId: string, queueId: string, sourceType: 'work_order' | 'work_request') => {
    if (!isInternal && (!vendorData.aligned_vendor_name || vendorData.final_price <= 0)) {
      toast.error('Please fill vendor name and amount');
      return;
    }

    // Validation based on payment method
    if (!isInternal) {
      if (paymentMethod === 'bank' && (!vendorData.vendor_account_number || !vendorData.vendor_ifsc)) {
        toast.error('Bank account and IFSC are required for bank transfers');
        return;
      }
      if (paymentMethod === 'upi' && !vendorData.vendor_upi && !vendorData.vendor_upi_number) {
        toast.error('UPI ID or Phone Number is required for UPI transfers');
        return;
      }
    } else {
      if (!woData.detailed_scope || !woData.start_date) {
        toast.error('Detailed scope and start date are required for internal sourcing');
        return;
      }
    }

    try {
      let success = false;
      const combinedUpi = [
        vendorData.vendor_upi,
        vendorData.vendor_upi_number ? `No: ${vendorData.vendor_upi_number}` : ''
      ].filter(Boolean).join(' | ');

      const bankData = isInternal ? {
        vendor_name: 'INTERNAL SOURCING (IGO GROUP)',
        vendor_contact: 'Internal team',
        negotiated_amount: vendorData.final_price,
        vendor_bank_name: 'IGO GROUP INTERNAL',
        vendor_account_number: 'N/A',
        vendor_ifsc_code: 'N/A',
        vendor_upi: 'N/A'
      } : (paymentMethod === 'bank' ? {
        vendor_name: vendorData.aligned_vendor_name,
        vendor_contact: vendorData.aligned_vendor_contact,
        negotiated_amount: vendorData.final_price,
        vendor_bank_name: vendorData.vendor_bank_name,
        vendor_account_number: vendorData.vendor_account_number,
        vendor_ifsc_code: vendorData.vendor_ifsc,
        vendor_upi: null
      } : {
        vendor_name: vendorData.aligned_vendor_name,
        vendor_contact: vendorData.aligned_vendor_contact,
        negotiated_amount: vendorData.final_price,
        vendor_bank_name: null,
        vendor_account_number: null,
        vendor_ifsc_code: null,
        vendor_upi: combinedUpi
      });

      if (sourceType === 'work_order') {
        const res = await alignWorkOrder(requestId, bankData);
        success = res.success;
      } else {
        await alignWorkRequest(requestId, {
          aligned_vendor_name: bankData.vendor_name,
          aligned_vendor_contact: bankData.vendor_contact,
          final_price: vendorData.final_price,
          vendor_bank_name: bankData.vendor_bank_name,
          vendor_account_number: bankData.vendor_account_number,
          vendor_ifsc: bankData.vendor_ifsc_code,
          vendor_upi: bankData.vendor_upi,
          vendor_gst: vendorData.vendor_gst,
          aligned_vendor_details: { 
            ...vendorData.aligned_vendor_details,
            is_internal: isInternal,
            payment_method: isInternal ? 'internal' : paymentMethod,
            beneficiary_name: vendorData.vendor_beneficiary_name,
            gst_number: vendorData.vendor_gst,
            bank_account: paymentMethod === 'bank' ? vendorData.vendor_account_number : null,
            ifsc: paymentMethod === 'bank' ? vendorData.vendor_ifsc : null,
            upi_address: paymentMethod === 'upi' ? vendorData.vendor_upi : null,
            upi_phone: paymentMethod === 'upi' ? vendorData.vendor_upi_number : null,
            combined_upi: paymentMethod === 'upi' ? combinedUpi : null,
            detailed_scope: woData.detailed_scope,
            terms_and_conditions: woData.terms_and_conditions,
            start_date: woData.start_date,
            advance_amount: woData.advance_amount
          }
        });
        success = true;
      }

      if (success) {
        if (sourceType === 'work_order') {
          await completeSourcing(queueId);
        }
        setSelectedItem(null);
        setPaymentMethod('bank');
        setIsInternal(false);
        setVendorData({
          aligned_vendor_name: '',
          aligned_vendor_contact: '',
          final_price: 0,
          vendor_account_number: '',
          vendor_beneficiary_name: '',
          vendor_gst: '',
          vendor_ifsc: '',
          vendor_bank_name: '',
          vendor_upi: '',
          vendor_upi_number: '',
          aligned_vendor_details: {}
        });
        setWoData({
          detailed_scope: '',
          terms_and_conditions: '',
          start_date: '',
          advance_amount: 0,
        });
        refetch();
      }
    } catch (error) {
      console.error('Error in alignment:', error);
    }
  };

  const filteredQueue = queue.filter(item => 
    item.display_details.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.display_details.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeItems = filteredQueue.filter(item => 
    item.queue_status !== 'completed' && item.status !== 'vendor_aligned'
  );

  const historyItems = filteredQueue.filter(item => 
    item.queue_status === 'completed' || item.status === 'vendor_aligned'
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="dashboard-header flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vendor Sourcing Dashboard</h1>
            <p className="text-muted-foreground text-sm">New Budget-Approved Workflow Management</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl w-fit">
          {!isGMOrCEO && (
            <TabsTrigger value="requests" className="rounded-lg gap-2">
              <Clock className="w-4 h-4" /> Requests Queue
            </TabsTrigger>
          )}
          <TabsTrigger value="database" className="rounded-lg gap-2">
            <Database className="w-4 h-4" /> Vendor Master
          </TabsTrigger>
          {!isGMOrCEO && (
            <TabsTrigger value="eod" className="rounded-lg gap-2">
              <ClipboardCheck className="w-4 h-4" /> My EOD
            </TabsTrigger>
          )}
          {!isGMOrCEO && (
            <TabsTrigger value="team" className="rounded-lg gap-2">
              <Users className="w-4 h-4" /> Team Activity
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Queue List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search WO or Project..."
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="icon"><Filter className="w-4 h-4" /></Button>
              </div>

              {/* Active Queue */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Pending Sourcing ({activeItems.length})
                  </h3>
                </div>

                {activeItems.length === 0 ? (
                  <Card className="authority-card border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg">Queue is empty</h3>
                      <p className="text-muted-foreground max-w-xs">No budget-approved work orders are currently pending sourcing.</p>
                    </CardContent>
                  </Card>
                ) : (
                  activeItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className={`authority-card cursor-pointer transition-all hover:border-primary/50 group ${selectedItem?.id === item.id ? 'ring-2 ring-primary border-primary' : ''}`}
                        onClick={() => {
                          setSelectedItem(item);
                          setVendorData(prev => ({ 
                            ...prev, 
                            final_price: item.display_details.budget 
                          }));
                          setWoData(prev => ({
                            ...prev,
                            detailed_scope: item.display_details.description
                          }));
                        }}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-primary font-bold">
                                  {typeof item.display_details.number === 'number' ? `WO-${String(item.display_details.number).padStart(3, '0')}` : item.display_details.number}
                                </span>
                                <Badge variant="outline" className={`text-[10px] uppercase font-bold border-opacity-30 ${item.source_type === 'work_order' ? 'text-authority-gmo border-authority-gmo' : 'text-blue-500 border-blue-500'}`}>
                                  {item.source_type === 'work_order' ? 'Budget Approved' : 'Request Approved'}
                                </Badge>
                                {item.display_details.phase_name && (
                                  <Badge variant="secondary" className="text-[10px]">{item.display_details.phase_name}</Badge>
                                )}
                              </div>
                              <h3 className="font-semibold text-base group-hover:text-primary transition-colors">{item.display_details.description}</h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {item.display_details.project_name} • <Users className="w-3 h-3" /> {item.display_details.requester_name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground uppercase font-semibold">Max Budget</p>
                              <p className="text-lg font-bold text-primary">₹{item.display_details.budget.toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">Logged {format(new Date(item.created_at), 'MMM d, h:mm a')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Aligned History */}
              {historyItems.length > 0 && (
                <div className="pt-6 space-y-4 border-t border-border/50">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Aligned History ({historyItems.length})
                  </h3>
                  <div className="space-y-3 opacity-80 hover:opacity-100 transition-opacity">
                    {historyItems.map((item, index) => (
                      <Card key={item.id} className="authority-card border-green-500/20 bg-green-500/5">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm">{item.display_details.description}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {item.display_details.project_name} • Aligned on {format(new Date(item.updated_at), 'MMM d')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-600/5 mb-1">ALIGNED</Badge>
                              <p className="text-sm font-bold text-green-600">₹{item.display_details.budget.toLocaleString()}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Alignment Sidebar */}
            <div className="lg:col-span-1">
              <AnimatePresence mode="wait">
                {selectedItem ? (
                  <motion.div
                    key="alignment-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <Card className="authority-card border-primary/20 sticky top-6 shadow-xl shadow-primary/5">
                      <CardHeader className="bg-primary/5 border-b py-4">
                        <CardTitle className="text-sm uppercase tracking-wider text-primary font-bold flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Align Vendor & Finalize
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-4">
                        {/* Internal vs External Toggle */}
                        <div className="flex p-1 bg-muted/50 rounded-lg mb-2">
                          <Button 
                            variant={!isInternal ? 'default' : 'ghost'} 
                            className="flex-1 text-[10px] font-bold uppercase h-8"
                            onClick={() => setIsInternal(false)}
                          >
                            External Vendor
                          </Button>
                          <Button 
                            variant={isInternal ? 'default' : 'ghost'} 
                            className="flex-1 text-[10px] font-bold uppercase h-8"
                            onClick={() => setIsInternal(true)}
                          >
                            Internal Sourcing
                          </Button>
                        </div>

                        {!isInternal ? (
                          <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Vendor Identity</Label>
                              <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                  value={vendorData.aligned_vendor_name}
                                  onChange={e => setVendorData(prev => ({ ...prev, aligned_vendor_name: e.target.value }))}
                                  placeholder="Enter vendor name..."
                                  className="pl-9 h-10 border-primary/10"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs font-semibold">Contact Info</Label>
                                <Input 
                                  value={vendorData.aligned_vendor_contact}
                                  onChange={e => setVendorData(prev => ({ ...prev, aligned_vendor_contact: e.target.value }))}
                                  placeholder="Phone or Email"
                                  className="h-10 border-primary/10"
                                />
                              </div>
                            </div>

                            <div className="pt-2">
                              <Label className="text-xs font-semibold mb-2 block">Payment Method</Label>
                              <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                                <SelectTrigger className="h-10 bg-muted/20">
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bank">Bank Transfer</SelectItem>
                                  <SelectItem value="upi">UPI Transfer</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-4">
                              {paymentMethod === 'bank' ? (
                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Bank Name</Label>
                                    <Input 
                                      value={vendorData.vendor_bank_name}
                                      onChange={e => setVendorData(prev => ({ ...prev, vendor_bank_name: e.target.value }))}
                                      placeholder="e.g. HDFC Bank"
                                      className="bg-background/50 text-sm h-9"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Beneficiary Name</Label>
                                    <Input 
                                      value={vendorData.vendor_beneficiary_name}
                                      onChange={e => setVendorData(prev => ({ ...prev, vendor_beneficiary_name: e.target.value }))}
                                      placeholder="Account holder name"
                                      className="bg-background/50 text-sm h-9"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Account Number</Label>
                                    <Input 
                                      value={vendorData.vendor_account_number}
                                      onChange={e => setVendorData(prev => ({ ...prev, vendor_account_number: e.target.value }))}
                                      placeholder="000000000000"
                                      className="bg-background/50 text-sm h-9"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">IFSC Code</Label>
                                    <Input 
                                      value={vendorData.vendor_ifsc}
                                      onChange={e => setVendorData(prev => ({ ...prev, vendor_ifsc: e.target.value }))}
                                      placeholder="IFSC0000000"
                                      className="bg-background/50 text-sm h-9"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Vendor GST (Optional)</Label>
                                    <Input 
                                      value={vendorData.vendor_gst}
                                      onChange={e => setVendorData(prev => ({ ...prev, vendor_gst: e.target.value }))}
                                      placeholder="22AAAAA0000A1Z5"
                                      className="bg-background/50 text-sm h-9"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-blue-600/70">UPI ID / VPA</Label>
                                    <Input 
                                      value={vendorData.vendor_upi}
                                      onChange={e => setVendorData(prev => ({ ...prev, vendor_upi: e.target.value }))}
                                      placeholder="vendor@upi"
                                      className="bg-background/50 text-sm h-9 border-blue-200 focus:border-blue-400"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase text-blue-600/70">UPI Phone Number (10 Digits)</Label>
                                    <Input 
                                      value={vendorData.vendor_upi_number}
                                      onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        setVendorData(prev => ({ ...prev, vendor_upi_number: val }));
                                      }}
                                      placeholder="Ex: 9876543210"
                                      className="bg-background/50 text-sm h-9 border-blue-200 focus:border-blue-400"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                            <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 mb-2">
                              <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Internal Team</p>
                              <p className="text-sm font-semibold text-indigo-900/80">IGO GROUP (INTERNAL)</p>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Detailed Scope *</Label>
                              <Textarea 
                                value={woData.detailed_scope}
                                onChange={e => setWoData(prev => ({ ...prev, detailed_scope: e.target.value }))}
                                placeholder="Detailed work specifications..."
                                className="h-24 text-xs"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs font-semibold">Start Date *</Label>
                                <Input 
                                  type="date"
                                  value={woData.start_date}
                                  onChange={e => setWoData(prev => ({ ...prev, start_date: e.target.value }))}
                                  className="h-9 text-xs"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-semibold">Advance Amount</Label>
                                <Input 
                                  type="number"
                                  value={woData.advance_amount}
                                  onChange={e => setWoData(prev => ({ ...prev, advance_amount: Number(e.target.value) }))}
                                  className="h-9 text-xs"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Terms & Conditions</Label>
                              <Textarea 
                                value={woData.terms_and_conditions}
                                onChange={e => setWoData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                                placeholder="Special terms for internal work..."
                                className="h-16 text-xs"
                              />
                            </div>
                          </div>
                        )}

                        <div className="pt-2">
                          <Label className="text-xs font-semibold mb-2 block text-primary/80">Final Agreed Amount</Label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                            <Input 
                              type="number"
                              value={vendorData.final_price}
                              onChange={e => setVendorData(prev => ({ ...prev, final_price: Number(e.target.value) }))}
                              className="pl-9 h-11 text-lg font-bold border-primary ring-primary/20 bg-primary/5"
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1 px-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                              Limit: ₹{selectedItem.display_details.budget.toLocaleString()}
                            </p>
                            {vendorData.final_price > 0 && (
                              <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${
                                vendorData.final_price > selectedItem.display_details.budget ? 'text-authority-gmo animate-pulse' : 'text-green-600'
                              }`}>
                                {vendorData.final_price > selectedItem.display_details.budget ? (
                                  <>
                                    <TrendingUp className="w-3 h-3" />
                                    +{(((vendorData.final_price - selectedItem.display_details.budget) / selectedItem.display_details.budget) * 100).toFixed(1)}% OVER
                                  </>
                                ) : (
                                  <>
                                    <TrendingDown className="w-3 h-3" />
                                    {(((selectedItem.display_details.budget - vendorData.final_price) / selectedItem.display_details.budget) * 100).toFixed(1)}% UNDER
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {vendorData.final_price > selectedItem.display_details.budget && (
                            <div className="mt-3 p-3 rounded-xl bg-authority-gmo/10 border border-authority-gmo/20 space-y-1 animate-in zoom-in-95 duration-200">
                              <div className="flex items-center gap-2 text-authority-gmo text-xs font-bold">
                                <AlertTriangle className="w-4 h-4" />
                                <span>BUDGET DEVIATION DETECTED</span>
                              </div>
                              <p className="text-[10px] text-authority-gmo/70 leading-tight">
                                This alignment exceeds the approved budget by <strong>₹{(vendorData.final_price - selectedItem.display_details.budget).toLocaleString()}</strong>. Standard escalation rules apply for approval.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 flex flex-col gap-2">
                          <Button 
                            className={`w-full h-11 font-bold shadow-lg shadow-primary/10 ${isInternal ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-primary hover:bg-primary/90'}`} 
                            onClick={() => handleAlignVendor(selectedItem.request_id, selectedItem.id, selectedItem.source_type)}
                          >
                            <Save className="w-4 h-4 mr-2" /> 
                            {isInternal ? 'Create Internal WO' : 'Complete Alignment'}
                          </Button>
                          <Button variant="ghost" className="text-muted-foreground text-xs h-8" onClick={() => setSelectedItem(null)}>
                            Close Form
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-muted/5 border-2 border-dashed border-border rounded-xl p-10 text-center sticky top-6"
                  >
                    <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <h4 className="font-semibold text-muted-foreground">No Selection</h4>
                    <p className="text-sm text-muted-foreground/60 mt-1">Select a Work Order from the queue to start vendor alignment.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="database">
          <VendorDatabaseWidget />
        </TabsContent>

        <TabsContent value="eod">
          <VendorSourcingEOD />
        </TabsContent>

        <TabsContent value="team">
          <div className="space-y-6">
            <EmployeeActivityWidget
              title="Vendor Sourcing Activity Monitor"
              filterDepartments={['Vendor Sourcing']}
            />
            <TaskAssignmentWidget
              title="Assign Sourcing Tasks"
              restrictDepartments={['Vendor Sourcing']}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper components that should exist in the project
const Separator = ({ className }: { className?: string }) => <div className={`h-[1px] bg-border ${className}`} />;
