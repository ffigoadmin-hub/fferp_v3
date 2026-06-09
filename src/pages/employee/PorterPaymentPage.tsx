import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, CheckCircle2, IndianRupee, ArrowLeft, Loader2, UploadCloud, Save as SaveIcon, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { GoogleDriveLinkInput } from '@/components/GoogleDriveLinkInput';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export function PorterPaymentPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { createRequest, isSaving: isSubmitting, saveDraft, deleteDraft, requests: allRequests } = usePaymentRequests();

    const [isSubmitted, setIsSubmitted] = useState(false);
    const [requestId, setRequestId] = useState('');

    // Draft state
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [myDrafts, setMyDrafts] = useState<any[]>([]);

    // Form state
    const [purpose, setPurpose] = useState('');
    const [fromLocation, setFromLocation] = useState('');
    const [toLocation, setToLocation] = useState('');
    const [totalKm, setTotalKm] = useState('');
    const [amount, setAmount] = useState('');
    const [vendorName, setVendorName] = useState('');
    const [vendorUpi, setVendorUpi] = useState('');
    const [billFile, setBillFile] = useState<File | null>(null);
    const [billUrl, setBillUrl] = useState('');
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    const [cutoffDate, setCutoffDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [cutoffTime, setCutoffTime] = useState('17:00');

    // Fetch drafts for current user
    useEffect(() => {
        const fetchDrafts = async () => {
            if (!user) return;
            const { data, error } = await supabase
                .from('payment_requests')
                .select('*')
                .eq('requester_id', user.id)
                .eq('status', 'draft')
                .eq('is_porter_payment', true)
                .order('updated_at', { ascending: false });

            if (!error && data) {
                setMyDrafts(data);
            }
        };
        fetchDrafts();
    }, [user, allRequests]);

    const handleLoadDraft = (draft: any) => {
        setCurrentDraftId(draft.id);
        setPurpose(draft.purpose?.replace(/^Porter: (.+?) \(.*/, '$1') || draft.purpose || '');

        if (draft.detailed_description) {
            const lines = draft.detailed_description.split('\n');
            lines.forEach((line: string) => {
                if (line.startsWith('From: ')) setFromLocation(line.substring(6));
                if (line.startsWith('To: ')) setToLocation(line.substring(4));
            });
        }

        setTotalKm(draft.porter_total_km?.toString() || '');
        setAmount(draft.amount?.toString() || '');
        setVendorName(draft.vendor_name || '');
        setVendorUpi(draft.vendor_upi || '');
        setCutoffDate(draft.cutoff_date || format(new Date(), 'yyyy-MM-dd'));
        setCutoffTime(draft.cutoff_time || '17:00');
        setBillUrl(draft.bill_url || '');
        setBillFile(null); // Clear file input when loading
        toast.success('Draft loaded successfully');
    };

    const handleManualSaveDraft = async () => {
        const result = await saveDraft({
            id: currentDraftId || undefined,
            isProjectWork: false,
            purpose: purpose ? `Porter: ${purpose} (${fromLocation} → ${toLocation}, ${totalKm} KM)` : 'Untitled Porter Draft',
            vendorName: vendorName || 'New Payee',
            vendorBankDetails: `UPI: ${vendorUpi}`,
            amount: parseFloat(amount) || 0,
            billUrl: billUrl,
            workProofUrl: '',
            cutoffDate,
            cutoffTime,
            urgency: 'normal',
            isPorterPayment: true,
            porterStartKm: 0,
            porterEndKm: 0,
            porterTotalKm: parseFloat(totalKm) || 0,
            vendorAccountNumber: '',
            vendorIfscCode: '',
            paymentType: 'upi',
            vendorUpi,
            detailedDescription: `Porter Payment Request\nFrom: ${fromLocation}\nTo: ${toLocation}\nTotal KM: ${totalKm}\nPurpose: ${purpose}\nUPI: ${vendorUpi}`
        });

        if (result.success && result.data) {
            setCurrentDraftId(result.data.id);
            toast.success('Draft saved successfully');
        } else {
            toast.error(result.error || 'Failed to save draft');
        }
    };

    const handleSubmit = async () => {
        if (!purpose.trim()) {
            toast.error('Please provide a purpose');
            return;
        }
        if (!fromLocation.trim() || !toLocation.trim()) {
            toast.error('Please provide From and To locations');
            return;
        }
        if (!totalKm || parseFloat(totalKm) <= 0) {
            toast.error('Please provide a valid Total KM');
            return;
        }
        if (!vendorName.trim()) {
            toast.error('Please provide the payee name');
            return;
        }
        if (!vendorUpi.trim()) {
            toast.error('Please provide the UPI ID');
            return;
        }
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Please provide a valid amount');
            return;
        }
        if (!billFile) {
            toast.error('Please provide a proof document');
            return;
        }

        setIsUploadingFiles(true);
        let uploadedBillUrl = '';
        try {
            const fileExt = billFile.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${user?.id}/trip-proofs/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, billFile);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(filePath);

            uploadedBillUrl = data.publicUrl;
        } catch (error: any) {
            toast.error(error.message || 'Failed to upload proof. Please try again.');
            setIsUploadingFiles(false);
            return;
        }
        setIsUploadingFiles(false);

        const result = await createRequest({
            isProjectWork: false,
            purpose: `Porter: ${purpose} (${fromLocation} → ${toLocation}, ${totalKm} KM)`,
            vendorName,
            vendorBankDetails: `UPI: ${vendorUpi}`,
            amount: parseFloat(amount),
            billUrl: uploadedBillUrl,
            workProofUrl: '',
            cutoffDate,
            cutoffTime,
            urgency: 'normal',
            isPorterPayment: true,
            porterStartKm: 0,
            porterEndKm: 0,
            porterTotalKm: parseFloat(totalKm),
            vendorAccountNumber: '',
            vendorIfscCode: '',
            paymentType: 'upi',
            vendorUpi,
            detailedDescription: `Porter Payment Request\nFrom: ${fromLocation}\nTo: ${toLocation}\nTotal KM: ${totalKm}\nPurpose: ${purpose}\nUPI: ${vendorUpi}`
        });

        if (result.success && result.data) {
            setRequestId(result.data.id.slice(0, 8).toUpperCase());
            setIsSubmitted(true);
        }
    };

    if (isSubmitted) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto py-12">
                <div className="authority-card p-8 text-center">
                    <CheckCircle2 className="w-16 h-16 text-status-live mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Porter Payment Submitted</h2>
                    <p className="text-muted-foreground mb-6">Ref ID: PAY-{requestId}</p>
                    <div className="flex gap-4 justify-center">
                        <Button variant="outline" onClick={() => navigate('/my-requests')}>View My Requests</Button>
                        <Button onClick={() => window.location.reload()}>New Request</Button>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto pb-12">
            {/* Header with Back Button */}
            <div className="flex items-center gap-3 mb-8">
                <Button variant="ghost" size="icon" onClick={() => navigate('/payment-request')} className="shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="p-2 rounded-lg bg-primary/10">
                    <Truck className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Porter Payment Request</h1>
                    <p className="text-muted-foreground text-sm">Submit kilometer-based logistics payment</p>
                </div>
            </div>

            <div className="authority-card space-y-6">
                {/* Trip Details - From / To / Total KM */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-4">
                    <Label className="text-sm font-bold flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary" /> Trip Details
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">From *</Label>
                            <Input
                                value={fromLocation}
                                onChange={(e) => setFromLocation(e.target.value)}
                                placeholder="Starting location"
                                className="bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">To *</Label>
                            <Input
                                value={toLocation}
                                onChange={(e) => setToLocation(e.target.value)}
                                placeholder="Destination"
                                className="bg-background"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Total KM *</Label>
                        <Input
                            type="number"
                            value={totalKm}
                            onChange={(e) => setTotalKm(e.target.value)}
                            placeholder="Enter total kilometers"
                            className="bg-background text-lg font-bold"
                        />
                    </div>
                </div>

                {/* Purpose */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">Purpose of Trip *</Label>
                    <Input
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="e.g., Delivery to Site A, Material pickup"
                    />
                </div>

                {/* Payee Details - UPI Only */}
                <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/20">
                    <Label className="text-sm font-bold flex items-center gap-2">
                        💳 Payee Details (UPI)
                    </Label>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs">Payee Name *</Label>
                            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Name of the porter / driver" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">UPI ID *</Label>
                            <Input value={vendorUpi} onChange={(e) => setVendorUpi(e.target.value)} placeholder="e.g., name@upi, 9876543210@paytm" />
                        </div>
                    </div>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">Total Amount (₹) *</Label>
                    <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="pl-9 text-lg font-bold"
                        />
                    </div>
                </div>

                {/* Proof Link - single */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-1 font-semibold text-sm">Trip/Bill Proof *</Label>
                    <div className="relative">
                        <Input
                            type="file"
                            id="trip-proof-upload"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setBillFile(e.target.files[0]);
                                }
                            }}
                        />
                        <Label
                            htmlFor="trip-proof-upload"
                            className="flex flex-col items-center justify-center w-full h-24 px-4 py-2 border-2 border-dashed border-primary/20 rounded-xl cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all text-sm text-muted-foreground gap-2 group"
                        >
                            <UploadCloud className="w-6 h-6 text-primary/50 group-hover:text-primary transition-colors" />
                            {billFile ? (
                                <span className="text-primary font-bold truncate max-w-[200px]">{billFile.name}</span>
                            ) : (
                                <span className="font-medium">Click to upload Trip/Bill Proof document</span>
                            )}
                        </Label>
                        {billUrl && !billFile && <p className="text-[10px] text-primary truncate max-w-full absolute -bottom-5 left-1">Draft/Saved: {billUrl}</p>}
                    </div>
                </div>

                {/* Timing */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground tracking-tighter">Payment Cutoff Date</Label>
                        <Input type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground tracking-tighter">Expected Time</Label>
                        <Input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Button
                        variant="secondary"
                        className="w-full h-14 bg-muted/60 hover:bg-muted text-foreground font-bold gap-2"
                        onClick={handleManualSaveDraft}
                        disabled={isSubmitting || isUploadingFiles}
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5" />}
                        {currentDraftId ? 'Update Draft' : 'Save as Draft'}
                    </Button>
                    <Button
                        className="w-full h-14 bg-primary hover:bg-primary/90 text-lg font-bold gap-2"
                        disabled={isSubmitting || isUploadingFiles}
                        onClick={handleSubmit}
                    >
                        {(isSubmitting || isUploadingFiles) ? "Processing..." : <><Truck className="w-5 h-5" /> Submit Request</>}
                    </Button>
                </div>

                <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => navigate('/payment-request')}
                >
                    <ArrowLeft className="w-4 h-4" /> Back to General Payment
                </Button>

                {/* Drafts Section */}
                {myDrafts.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-border">
                        <Label className="text-sm font-bold flex items-center gap-2 mb-4">
                            <FileText className="w-4 h-4 text-primary" /> Saved Porter Drafts
                        </Label>
                        <div className="space-y-3">
                            {myDrafts.map((draft) => (
                                <div key={draft.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/10">
                                    <div className="flex-1 cursor-pointer" onClick={() => handleLoadDraft(draft)}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-sm line-clamp-1">{draft.purpose || 'Untitled Draft'}</span>
                                            {currentDraftId === draft.id && (
                                                <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">Current</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground">₹{draft.amount || 0}</span>
                                            <span>•</span>
                                            <span>{draft.vendor_name || 'No Payee'}</span>
                                            <span>•</span>
                                            <span>{format(new Date(draft.updated_at), 'MMM d, h:mm a')}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive shrink-0 ml-4 hover:bg-destructive/10"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Delete this draft?')) {
                                                await deleteDraft(draft.id);
                                                if (currentDraftId === draft.id) {
                                                    setCurrentDraftId(null);
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
