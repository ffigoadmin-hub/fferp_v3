import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, CheckCircle2, History, AlertCircle, Calendar, Building2, Download, Copy, Link as LinkIcon, FileText, Users, Calculator, Upload, Loader2, X, FileSpreadsheet } from 'lucide-react';
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
import { generateRentalKotakBulkFile } from '@/lib/kotakBankExport';

export function RentalPaymentsSubTab() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    // Stable ref so dialog doesn't reset if parent re-renders mid-upload
    const selectedRecordRef = useRef<any>(null);
    const setSelectedRecordStable = useCallback((record: any) => {
        selectedRecordRef.current = record;
        setSelectedRecord(record);
    }, []);

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

    // Separate queries for pending and history to avoid stale counts.
    // High staleTime (5 min) prevents background refetches from interrupting the payment dialog.
    // Refetch is BLOCKED while a payment is being processed to prevent mid-upload tab resets.
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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
        staleTime: 5 * 60 * 1000, // 5 minutes — no background refetch during payment flow
        refetchOnWindowFocus: false,
        enabled: !isProcessingPayment, // Pause query while uploading
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
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        enabled: !isProcessingPayment, // Pause query while uploading
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
        setIsProcessingPayment(true); // Lock refetches
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
            // Keep isProcessingPayment=true until mutation completes
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
            const record = selectedRecordRef.current || selectedRecord; // Use stable ref
            if (!record) throw new Error("No record selected");

            if (record.status === 'PAYMENT_EXECUTED') {
                throw new Error("This record is already marked as paid.");
            }
            if (!proofFile && !proofUrl) {
                throw new Error("Please upload a proof of payment file.");
            }

            setIsProcessingPayment(true); // Lock all refetches
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
                .eq('id', record.id)
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
            const recordId = selectedRecord?.id;

            // Optimistically update the UI by removing from pending list in cache
            if (recordId) {
                queryClient.setQueryData(['accounts-rental-records', 'pending'], (old: any) => {
                    if (!old) return old;
                    return old.filter((r: any) => r.id !== recordId);
                });
            }

            // Invalidate all related rental queries across dashboards.
            // Using invalidateQueries is sufficient as it triggers a refetch for active queries.
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
            selectedRecordRef.current = null;
            setIsProcessingPayment(false); // Unlock refetches
        },
        onError: (err: any) => {
            console.error("Mutation error:", err);
            toast.error(err.message || 'Failed to mark as paid');
            setIsProcessingPayment(false); // Unlock on error too
        }
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

    const downloadBankBulk = () => {
        if (!records || records.length === 0) {
            toast.error("No pending payments to export");
            return;
        }

        try {
            const batchRef = `RENTAL-${format(new Date(), 'yyyyMMdd-HHmm')}`;
            generateRentalKotakBulkFile(records, batchRef);
            toast.success('Kotak bank bulk file downloaded successfully');
        } catch (error) {
            console.error('Error generating bank bulk file:', error);
            toast.error('Failed to generate bank bulk file');
        }
    };

    const getSplitDetails = (record: any) => {
        if (!record?.rental_properties) return null;
        const partners = record.rental_properties.partner_details || [];
        if (partners.length === 0) return null;

        const totalAmount = record.net_payable_amount;
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">Rental Payments</h2>
                    <p className="text-sm text-muted-foreground">Manage and track rental monthly payouts</p>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'history' && (
                        <>
                            <Input
                                type="month"
                                value={format(monthFilter, 'yyyy-MM')}
                                onChange={(e) => setMonthFilter(new Date(e.target.value))}
                                className="w-[180px] h-9"
                            />
                            <Button variant="outline" size="sm" onClick={downloadCSV}>
                                <Download className="w-4 h-4 mr-2" /> Export
                            </Button>
                        </>
                    )}
                    {activeTab === 'pending' && (
                        <>
                            <Button variant="outline" size="sm" onClick={downloadCSV}>
                                <Download className="w-4 h-4 mr-2" /> Export CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={downloadBankBulk}>
                                <FileSpreadsheet className="w-4 h-4 mr-2" /> Bank Bulk
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-muted/30 p-1 border border-border/50">
                    <TabsTrigger value="pending" className="gap-2">
                        <AlertCircle className="w-4 h-4" /> Pending
                        <Badge variant="secondary" className="ml-1">{pendingRecords?.length || 0}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <History className="w-4 h-4" /> History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6 space-y-4">
                    {isLoading ? (
                        <div className="p-12 text-center text-muted-foreground">Loading...</div>
                    ) : records?.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed rounded-xl bg-muted/30">
                            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500 opacity-50" />
                            <p className="text-muted-foreground">No pending payments.</p>
                        </div>
                    ) : (
                        records?.map((record: any) => {
                            const partners: any[] = record.rental_properties?.partner_details || [];
                            const hasSplit = partners.length > 0;
                            const totalAmount = record.net_payable_amount || 0;
                            const totalPartnerShare = partners.reduce((sum: number, p: any) => sum + (totalAmount * (Number(p.share_percent) || 0)) / 100, 0);
                            const mainOwnerAmount = totalAmount - totalPartnerShare;

                            return (
                                <Card key={record.id} className="border border-border/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    {/* Card Header */}
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                <Building2 className="w-4 h-4 text-blue-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-base font-bold truncate">{record.rental_properties?.title}</h3>
                                                    {hasSplit && (
                                                        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1 text-[10px] font-bold">
                                                            <Users className="w-2.5 h-2.5" /> {partners.length + 1} Transfers
                                                        </Badge>
                                                    )}
                                                    {record.rental_properties?.rental_categories?.name && (
                                                        <Badge variant="outline" className="text-[10px]">{record.rental_properties.rental_categories.name}</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {record.rental_properties?.location}
                                                    {record.month_year && (
                                                        <span className="ml-2 text-blue-500 font-medium">• {format(new Date(record.month_year), 'MMM yyyy')}</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-4">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Net Payable</p>
                                            <p className="text-2xl font-black text-blue-500">₹{totalAmount.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <CardContent className="p-5 space-y-3">
                                        {/* Main Owner Account */}
                                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                                            <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/10 bg-emerald-500/5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-4 rounded-full bg-emerald-500" />
                                                    <div>
                                                        <p className="text-xs font-bold">{record.rental_properties?.holder_name || record.rental_properties?.owner_name}</p>
                                                        <p className="text-[10px] text-muted-foreground">Primary Owner</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-black text-emerald-600">₹{Math.round(mainOwnerAmount).toLocaleString()}</p>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-3 py-2.5">
                                                <div>
                                                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Bank</p>
                                                    <p className="text-xs font-semibold truncate">{record.rental_properties?.bank_name || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Account No.</p>
                                                    <div className="flex items-center gap-1">
                                                        <p className="text-xs font-mono font-bold">{record.rental_properties?.account_number}</p>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(record.rental_properties?.account_number)}>
                                                            <Copy className="w-2.5 h-2.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] uppercase font-bold text-muted-foreground">IFSC</p>
                                                    <div className="flex items-center gap-1">
                                                        <p className="text-xs font-mono font-bold">{record.rental_properties?.ifsc_code}</p>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(record.rental_properties?.ifsc_code)}>
                                                            <Copy className="w-2.5 h-2.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {record.rental_properties?.branch_name && (
                                                    <div>
                                                        <p className="text-[9px] uppercase font-bold text-muted-foreground">Branch</p>
                                                        <p className="text-xs font-semibold truncate">{record.rental_properties.branch_name}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Partner Accounts (Split) */}
                                        {hasSplit && partners.map((p: any, idx: number) => {
                                            const partnerAmount = (totalAmount * (Number(p.share_percent) || 0)) / 100;
                                            return (
                                                <div key={idx} className="rounded-lg border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                                                    <div className="flex items-center justify-between px-3 py-2 border-b border-blue-500/10 bg-blue-500/5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-4 rounded-full bg-blue-500" />
                                                            <div>
                                                                <p className="text-xs font-bold">{p.name}</p>
                                                                <p className="text-[10px] text-muted-foreground">Partner • {p.share_percent}% share</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm font-black text-blue-500">₹{Math.round(partnerAmount).toLocaleString()}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-3 py-2.5">
                                                        <div>
                                                            <p className="text-[9px] uppercase font-bold text-muted-foreground">Bank</p>
                                                            <p className="text-xs font-semibold truncate">{p.bank_name || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] uppercase font-bold text-muted-foreground">Account No.</p>
                                                            <div className="flex items-center gap-1">
                                                                <p className="text-xs font-mono font-bold">{p.account_number}</p>
                                                                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(p.account_number)}>
                                                                    <Copy className="w-2.5 h-2.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] uppercase font-bold text-muted-foreground">IFSC</p>
                                                            <div className="flex items-center gap-1">
                                                                <p className="text-xs font-mono font-bold">{p.ifsc}</p>
                                                                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => copyToClipboard(p.ifsc)}>
                                                                    <Copy className="w-2.5 h-2.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Footer Action */}
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                {hasSplit && (
                                                    <span className="flex items-center gap-1 font-medium text-amber-600">
                                                        <AlertCircle className="w-3 h-3" />
                                                        {partners.length + 1} bank transfers required
                                                    </span>
                                                )}
                                            </div>
                                            {canExecute && (
                                                <Button
                                                    size="sm"
                                                    className="bg-blue-600 hover:bg-blue-700 font-bold px-6"
                                                    onClick={() => { setSelectedRecordStable(record); setIsPaymentDialogOpen(true); }}
                                                >
                                                    Mark as Paid
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-6 space-y-3">
                    {records?.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">No history found.</div>
                    ) : (
                        records?.map((record: any) => (
                            <Card key={record.id} className="opacity-90 hover:opacity-100 transition-opacity">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm">{record.rental_properties?.title}</h4>
                                            <p className="text-[10px] text-muted-foreground">
                                                Paid: {record.payment_date ? format(new Date(record.payment_date), 'dd MMM yyyy') : 'N/A'} • {record.payment_mode}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="text-md font-bold">₹{record.net_payable_amount?.toLocaleString()}</p>
                                        {(record.payment_proof_url || record.payment_proof_link) && (
                                            <a href={record.payment_proof_url || record.payment_proof_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                <Download className="w-3 h-3" /> Proof
                                            </a>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Mark Rental as Paid</DialogTitle>
                        <DialogDescription>
                            Confirm payment execution for {selectedRecord?.rental_properties?.title}.
                        </DialogDescription>
                    </DialogHeader>

                    {splitInfo && (
                        <div className="border rounded-lg p-3 bg-muted/30 space-y-2 mb-4">
                            <p className="text-xs font-bold uppercase text-muted-foreground">Split Breakdown</p>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between p-2 bg-background rounded border">
                                    <span>{splitInfo.mainOwner.name} (Main)</span>
                                    <span className="font-bold text-emerald-600">₹{Math.round(splitInfo.mainOwner.amount).toLocaleString()}</span>
                                </div>
                                {splitInfo.partners.map((p: any, idx: number) => (
                                    <div key={idx} className="flex justify-between p-2 bg-background rounded border">
                                        <span>{p.name} ({p.share_percent}%)</span>
                                        <span className="font-bold text-blue-600">₹{Math.round(p.amount).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Mode</Label>
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
                            <div className="space-y-1.5">
                                <Label className="text-xs">Date</Label>
                                <Input
                                    type="date"
                                    size={32}
                                    value={paymentDetails.paid_date}
                                    onChange={(e) => setPaymentDetails({ ...paymentDetails, paid_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Proof Upload <span className="text-destructive">*</span></Label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={handleProofFileSelect}
                                aria-label="Upload payment proof"
                                title="Upload payment proof"
                            />
                            {proofFile ? (
                                <div className="relative border rounded-lg p-3 bg-muted/20">
                                    {proofPreview ? (
                                        <img src={proofPreview} alt="Proof" className="w-full h-32 object-contain rounded" />
                                    ) : (
                                        <div className="flex items-center gap-2 py-4 justify-center">
                                            <FileText className="w-6 h-6 text-blue-500" />
                                            <span className="text-xs truncate">{proofFile.name}</span>
                                        </div>
                                    )}
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-6 w-6 absolute top-1 right-1 rounded-full"
                                        onClick={resetProof}
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                                >
                                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                                    <p className="text-[10px] text-muted-foreground">Click to upload JPG/PDF</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button variant="outline" size="sm" onClick={() => { setIsPaymentDialogOpen(false); resetProof(); }}>Cancel</Button>
                        <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => markPaidMutation.mutate()}
                            disabled={!proofFile || markPaidMutation.isPending || isUploading}
                        >
                            {(markPaidMutation.isPending || isUploading) ? (
                                <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> {processStatus || 'Processing'}</>
                            ) : (
                                'Confirm Payment'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
