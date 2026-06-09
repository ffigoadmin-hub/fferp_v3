import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, CheckCircle2, History, AlertCircle, Calendar, Building2, Download, Copy, Link as LinkIcon, FileText, Users, Calculator, Upload, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ExternalLink } from 'lucide-react';

export default function AccountsRentalPaymentPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [paymentDetails, setPaymentDetails] = useState({
        mode: 'NEFT',
        paid_date: format(new Date(), 'yyyy-MM-dd'),
    });
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [processStatus, setProcessStatus] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check if user has permission to execute payments
    const canExecute = ['admin', 'ceo', 'accounts', 'gm'].includes(user?.role?.toLowerCase() || '');

    // Filters for CSV Export
    const [monthFilter, setMonthFilter] = useState(new Date());

    // Separate queries for pending and history to avoid stale counts
    const { data: pendingRecords, isLoading: pendingLoading } = useQuery({
        queryKey: ['accounts-rental-records', 'pending'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_monthly_records')
                .select(`
                    *,
                    rental_properties!inner(*)
                `)
                .eq('status', 'APPROVED_BY_CEO')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const { data: historyRecords, isLoading: historyLoading } = useQuery({
        queryKey: ['accounts-rental-records', 'history'],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('rental_monthly_records')
                .select(`
                    *,
                    rental_properties!inner(*)
                `)
                .eq('status', 'PAYMENT_EXECUTED')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const records = activeTab === 'pending' ? pendingRecords : historyRecords;
    const isLoading = activeTab === 'pending' ? pendingLoading : historyLoading;

    const handleProofFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            toast.error('Please select an image or PDF file');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be less than 10MB');
            return;
        }
        setProofFile(file);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setProofPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setProofPreview(null);
        }
    };

    const uploadProofFile = async (): Promise<string> => {
        if (!proofFile || !selectedRecord) throw new Error('No file selected');
        setIsUploading(true);
        try {
            const fileExt = proofFile.name.split('.').pop();
            const fileName = `rental-proof-${selectedRecord.id}-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('rental-bills')
                .upload(fileName, proofFile);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('rental-bills').getPublicUrl(fileName);
            return publicUrl;
        } finally {
            setIsUploading(false);
        }
    };

    const resetProof = () => {
        setProofFile(null);
        setProofPreview(null);
        setProofUrl(null);
        setProcessStatus('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const markPaidMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRecord) throw new Error("No record selected");

            if (selectedRecord.status === 'PAYMENT_EXECUTED') {
                throw new Error("This record is already marked as paid.");
            }
            if (!proofFile && !proofUrl) {
                throw new Error("Please upload a proof of payment file.");
            }

            let finalProofUrl = proofUrl;
            if (proofFile && !proofUrl) {
                setProcessStatus('Uploading proof...');
                finalProofUrl = await uploadProofFile();
            }

            setProcessStatus('Finalizing payment...');

            const { data, error } = await (supabase as any)
                .from('rental_monthly_records')
                .update({
                    status: 'PAYMENT_EXECUTED',
                    payment_date: paymentDetails.paid_date,
                    payment_mode: paymentDetails.mode,
                    payment_proof_url: finalProofUrl,
                    updated_at: new Date().toISOString()
                } as any)
                .eq('id', selectedRecord.id)
                .select();

            if (error) {
                console.error("Supabase update error:", error);
                throw new Error(`Database error: ${error.message}`);
            }

            if (!data || data.length === 0) {
                throw new Error("Update failed: No record was modified. This is likely a permission issue (RLS). Please ensure you have the 'Accountant', 'Accounts', or 'Admin' role assigned.");
            }

            return data[0];
        },
        onSuccess: async () => {
            console.log("Payment successful, invalidating queries across roles...");

            // Invalidate all related rental queries across dashboards
            await queryClient.invalidateQueries({
                queryKey: ['accounts-rental-records'],
                exact: false
            });
            await queryClient.invalidateQueries({
                queryKey: ['hr-rental-records'],
                exact: false
            });
            await queryClient.invalidateQueries({
                queryKey: ['rsh-rental-records'],
                exact: false
            });

            toast.success('Payment Recorded Successfully');
            setIsPaymentDialogOpen(false);
            setPaymentDetails({ mode: 'NEFT', paid_date: format(new Date(), 'yyyy-MM-dd') });
            resetProof();
            setSelectedRecord(null);
        },
        onError: (err) => toast.error(err.message)
    });

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.info("Copied to clipboard");
    };

    const downloadCSV = () => {
        if (!records || records.length === 0) {
            toast.error("No data to export");
            return;
        }

        let dataToExport = records;
        if (activeTab === 'history') {
            const start = startOfMonth(monthFilter);
            const end = endOfMonth(monthFilter);
            dataToExport = records.filter((r: any) => {
                const date = new Date(r.payment_date || r.updated_at);
                return isWithinInterval(date, { start, end });
            });
        }

        if (dataToExport.length === 0) {
            toast.error("No records found for the selected period.");
            return;
        }

        const headers = ["Property Title", "Category", "Location", "Owner Name", "Bank", "Account No", "IFSC", "Month", "Base Rent", "Additions", "Deductions", "Net Payable", "Payment Date", "Payment Mode", "Split Details"];

        const csvContent = [
            headers.join(","),
            ...dataToExport.map((r: any) => {
                const partners = r.rental_properties?.partner_details || [];
                const splitInfo = partners.length > 0 ? `Shared with ${partners.length} partners` : 'Single Owner';

                return [
                    `"${r.rental_properties.title}"`,
                    `"${r.rental_properties.rental_categories?.name}"`,
                    `"${r.rental_properties.location}"`,
                    `"${r.rental_properties.owner_name}"`,
                    `"${r.rental_properties.bank_name}"`,
                    `"${r.rental_properties.account_number}"`,
                    `"${r.rental_properties.ifsc_code}"`,
                    `"${format(new Date(r.month_year), 'MMM yyyy')}"`,
                    r.base_rent,
                    r.electricity_bill_amount,
                    r.deduction_total,
                    r.net_payable_amount,
                    r.payment_date ? format(new Date(r.payment_date), 'yyyy-MM-dd') : 'N/A',
                    `"${r.payment_mode || ''}"`,
                    `"${splitInfo}"`
                ].join(",")
            })
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `rental_payments_${activeTab}_${format(new Date(), 'yyyyMMdd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper to calc split
    const getSplitDetails = (record: any) => {
        if (!record?.rental_properties) return null;
        const partners = record.rental_properties.partner_details || [];
        if (partners.length === 0) return null;

        const totalAmount = record.net_payable_amount;
        // Logic: Partners get their %, Main Owner gets remainder.
        const partnerSplits = partners.map((p: any) => ({
            ...p,
            amount: (totalAmount * (Number(p.share_percent) || 0)) / 100
        }));

        const totalPartnerShare = partnerSplits.reduce((sum: number, p: any) => sum + p.amount, 0);
        const mainOwnerAmount = totalAmount - totalPartnerShare;

        return {
            mainOwner: {
                name: record.rental_properties.holder_name || record.rental_properties.owner_name,
                bank: record.rental_properties.bank_name,
                account: record.rental_properties.account_number,
                ifsc: record.rental_properties.ifsc_code,
                amount: mainOwnerAmount
            },
            partners: partnerSplits
        };
    };

    const splitInfo = selectedRecord ? getSplitDetails(selectedRecord) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pb-20"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <CreditCard className="w-7 h-7 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Rental Payments</h1>
                        <p className="text-muted-foreground">Execute and track rental payouts</p>
                    </div>
                </div>
                {activeTab === 'history' && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={downloadCSV}>
                            <Download className="w-4 h-4 mr-2" /> Export CSV
                        </Button>
                    </div>
                )}
                {activeTab === 'pending' && (
                    <Button variant="outline" size="sm" onClick={downloadCSV}>
                        <Download className="w-4 h-4 mr-2" /> Export Pending CSV
                    </Button>
                )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-muted/30 p-1 border border-border/50">
                    <TabsTrigger value="pending" className="gap-2">
                        <AlertCircle className="w-4 h-4" /> Pending Payment
                        <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-600">{pendingRecords?.length || 0}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <History className="w-4 h-4" /> Payment History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6 space-y-4">
                    {isLoading ? (
                        <div className="p-12 text-center text-muted-foreground">Loading...</div>
                    ) : records?.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/30">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500 opacity-50" />
                            <p className="text-muted-foreground">No pending payments found.</p>
                        </div>
                    ) : (
                        records?.map((record: any) => {
                            const hasSplit = (record.rental_properties.partner_details || []).length > 0;

                            return (
                                <Card key={record.id} className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col md:flex-row justify-between gap-6">
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-lg font-bold">{record.rental_properties.title}</h3>
                                                        {hasSplit && <Badge variant="destructive" className="flex items-center gap-1"><Users className="w-3 h-3" /> Split Payment</Badge>}
                                                        <Badge variant="outline">{record.rental_properties.rental_categories?.name}</Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        <span className="font-semibold text-foreground">{record.rental_properties.owner_name}</span> • {record.rental_properties.location}
                                                    </p>
                                                </div>

                                                <div className="p-4 bg-muted/50 rounded-lg border border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm relative group">
                                                    <div>
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Bank Name</span>
                                                        <p className="font-medium">{record.rental_properties.bank_name || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Account Number</span>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-mono font-bold tracking-wide">{record.rental_properties.account_number || 'N/A'}</p>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(record.rental_properties.account_number)}>
                                                                <Copy className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">IFSC Code</span>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-mono font-bold">{record.rental_properties.ifsc_code || 'N/A'}</p>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(record.rental_properties.ifsc_code)}>
                                                                <Copy className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Branch</span>
                                                        <p className="font-medium truncate">{record.rental_properties.branch_name || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col justify-between items-end min-w-[200px] border-t md:border-t-0 md:border-l pl-0 md:pl-6 pt-4 md:pt-0">
                                                <div className="text-right space-y-1">
                                                    <div className="text-sm flex justify-between gap-8 text-muted-foreground">
                                                        <span>Base</span>
                                                        <span>₹{record.base_rent.toLocaleString()}</span>
                                                    </div>
                                                    {record.electricity_bill_amount > 0 && (
                                                        <div className="text-sm flex justify-between gap-8 text-emerald-600">
                                                            <span>Additions</span>
                                                            <span>+₹{record.electricity_bill_amount.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    {record.deduction_total > 0 && (
                                                        <div className="text-sm flex justify-between gap-8 text-destructive">
                                                            <span>Deductions</span>
                                                            <span>-₹{record.deduction_total.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    <div className="pt-2 mt-2 border-t flex flex-col items-end">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Net Payable</p>
                                                        <p className="text-3xl font-black text-blue-600">₹{record.net_payable_amount.toLocaleString()}</p>
                                                    </div>
                                                    {canExecute && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-blue-600 hover:bg-blue-700 font-bold px-6 mt-4 w-full"
                                                            onClick={() => { setSelectedRecord(record); setIsPaymentDialogOpen(true); }}
                                                        >
                                                            Mark as Paid
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    {records?.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No payment history found</div>
                    ) : (
                        <div className="grid gap-4">
                            {records?.map((record: any) => (
                                <Card key={record.id} className="opacity-75 hover:opacity-100 transition-opacity">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold">{record.rental_properties.title}</h4>
                                                <p className="text-xs text-muted-foreground">
                                                    Paid on {format(new Date(record.payment_date || record.updated_at), 'dd MMM yyyy')} • {record.payment_mode || 'NEFT'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="text-lg font-bold">₹{record.net_payable_amount.toLocaleString()}</p>
                                            {(record.payment_proof_url || record.payment_proof_link) && (
                                                <a href={record.payment_proof_url || record.payment_proof_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 px-3 py-1.5 rounded-md border border-blue-200 dark:border-blue-500/20 transition-colors">
                                                    <Download className="w-3 h-3" /> Proof
                                                </a>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Confirm Payment</DialogTitle>
                        <DialogDescription>
                            Enter details for {selectedRecord?.rental_properties?.title}.
                        </DialogDescription>
                    </DialogHeader>

                    {splitInfo ? (
                        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                            <div className="flex items-center justify-between font-bold text-sm">
                                <span>Split Payment Breakdown</span>
                                <Badge variant="destructive">Multiple Transfers Required</Badge>
                            </div>
                            <div className="space-y-2 text-sm">
                                {/* Main Owner */}
                                <div className="flex justify-between items-center bg-background p-2 rounded border border-l-4 border-l-emerald-500">
                                    <div>
                                        <p className="font-bold">{splitInfo.mainOwner.name} (Owner)</p>
                                        <p className="text-xs text-muted-foreground">{splitInfo.mainOwner.bank} • {splitInfo.mainOwner.account} • {splitInfo.mainOwner.ifsc}</p>
                                    </div>
                                    <p className="font-bold text-emerald-600">₹{Math.round(splitInfo.mainOwner.amount).toLocaleString()}</p>
                                </div>
                                {/* Partners */}
                                {splitInfo.partners.map((p: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-background p-2 rounded border border-l-4 border-l-blue-500">
                                        <div>
                                            <p className="font-bold">{p.name} ({p.share_percent}%)</p>
                                            <p className="text-xs text-muted-foreground">{p.bank_name} • {p.account_number} • {p.ifsc}</p>
                                        </div>
                                        <p className="font-bold text-blue-600">₹{Math.round(p.amount).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                                Total Payable: <span className="font-bold">₹{selectedRecord?.net_payable_amount.toLocaleString()}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-yellow-500/10 text-yellow-600 rounded-md text-sm font-medium border border-yellow-500/20">
                            Single Transfer • {selectedRecord?.net_payable_amount?.toLocaleString()} to {selectedRecord?.rental_properties?.holder_name}
                        </div>
                    )}

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Payment Mode</Label>
                                <Select value={paymentDetails.mode} onValueChange={(val) => setPaymentDetails({ ...paymentDetails, mode: val })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NEFT">NEFT</SelectItem>
                                        <SelectItem value="IMPS">IMPS</SelectItem>
                                        <SelectItem value="RTGS">RTGS</SelectItem>
                                        <SelectItem value="UPI">UPI</SelectItem>
                                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Date</Label>
                                <Input
                                    type="date"
                                    value={paymentDetails.paid_date}
                                    onChange={(e) => setPaymentDetails({ ...paymentDetails, paid_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Proof of Payment (Upload Screenshot/PDF) <span className="text-destructive">*</span></Label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={handleProofFileSelect}
                            />
                            {proofFile ? (
                                <div className="relative border rounded-lg p-3 bg-muted/30">
                                    {proofPreview ? (
                                        <img src={proofPreview} alt="Proof preview" className="w-full h-40 object-contain rounded-md bg-background" />
                                    ) : (
                                        <div className="flex items-center gap-3 py-2">
                                            <FileText className="w-8 h-8 text-blue-500" />
                                            <div>
                                                <p className="text-sm font-medium">{proofFile.name}</p>
                                                <p className="text-xs text-muted-foreground">{(proofFile.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => { resetProof(); }}
                                        className="absolute top-2 right-2 p-1 rounded-full bg-destructive/90 hover:bg-destructive text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5 transition-colors"
                                >
                                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm font-medium">Click to upload proof</p>
                                    <p className="text-xs text-muted-foreground">PNG, JPG, PDF up to 10MB</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsPaymentDialogOpen(false); resetProof(); }}>Cancel</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 font-bold"
                            onClick={() => markPaidMutation.mutate()}
                            disabled={!proofFile || markPaidMutation.isPending || isUploading}
                        >
                            {(markPaidMutation.isPending || isUploading) ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {processStatus || 'Processing...'}</>
                            ) : (
                                'Confirm & Close'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
