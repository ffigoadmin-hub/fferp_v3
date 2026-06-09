import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTransportMasters } from '@/hooks/useTransportMasters';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { usePayees, Payee } from '@/hooks/usePayees';
import { calculateTransportAmount } from '@/lib/transportHelpers';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import {
    Truck, Plus, Trash2, Upload, Loader2, IndianRupee,
    CheckCircle2, MapPin, Route, X, FileText, Image as ImageIcon, UploadCloud, Save as SaveIcon
} from 'lucide-react';

interface TripEntry {
    id: string;
    tripDate: string;
    categoryCode: string;
    fromLocation: string;
    toLocation: string;
    totalKm: string;
    ratePerKm: string;
    purpose: string;
    vendorName: string;
    driverName: string;
    vehicleNumber: string;
    otherCategoryName?: string;
    
    // Per-trip Payee Details
    payeeType: 'manual' | 'saved';
    payeeId?: string;
    paymentMethod: 'bank_transfer' | 'gpay' | 'phonepe' | 'paytm';
    accountNumber: string;
    ifscCode: string;
    upiId: string;
    beneficiaryName: string;
    saveToMaster: boolean;

    // Per-trip Proofs
    tripProofFiles: File[];
    bankProofFile: File | null;
    tripProofUrls: string[];
    bankProofUrl: string;
}

const createEmptyEntry = (): TripEntry => ({
    id: crypto.randomUUID(),
    tripDate: format(new Date(), 'yyyy-MM-dd'),
    categoryCode: '',
    fromLocation: '',
    toLocation: '',
    totalKm: '0',
    ratePerKm: '0',
    purpose: '',
    vendorName: '',
    driverName: '',
    vehicleNumber: '',
    otherCategoryName: '',
    payeeType: 'manual',
    paymentMethod: 'bank_transfer',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    beneficiaryName: '',
    saveToMaster: false,
    tripProofFiles: [],
    bankProofFile: null,
    tripProofUrls: [],
    bankProofUrl: '',
});

interface Props {
    onSuccess: () => void;
    onCancel: () => void;
    editData?: any;
    isResubmitting?: boolean;
}

export function TransportSubmissionForm({ onSuccess, onCancel, editData, isResubmitting }: Props) {
    const { user } = useAuth();
    const { categories } = useTransportMasters();
    const { createRequest, saveDraft, deleteDraft, isSaving } = usePaymentRequests();
    const { payees, addPayee } = usePayees();

    const [entries, setEntries] = useState<TripEntry[]>([createEmptyEntry()]);
    const [cutoffDate, setCutoffDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [cutoffTime, setCutoffTime] = useState('17:00');

    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [myDrafts, setMyDrafts] = useState<any[]>([]);

    // Fetch Drafts
    useEffect(() => {
        const fetchDrafts = async () => {
            if (!user) return;
            const { data, error } = await (supabase
                .from('payment_requests') as any)
                .select('*')
                .eq('requester_id', user.id)
                .eq('status', 'draft')
                .eq('is_transport_payment', true)
                .order('updated_at', { ascending: false });

            if (!error && data) {
                setMyDrafts(data);
            }
        };
        fetchDrafts();
    }, [user, isSubmitted]);

    // Handle Edit/Resubmit Data Initialization
    useEffect(() => {
        if (editData) {
            const splitsData = editData.splits || [];
            
            if (editData.transport_trips && editData.transport_trips.length > 0) {
                setEntries(editData.transport_trips.map((e: any, index: number) => {
                    const isOtherRaw = e.purpose?.includes('[OTHER_CAT:');
                    let extractedOther = '';
                    let restoredPurpose = e.purpose || '';

                    if (isOtherRaw) {
                        const match = e.purpose.match(/\[OTHER_CAT:\s*(.*?)\]\s*/);
                        if (match) {
                            extractedOther = match[1];
                            restoredPurpose = e.purpose.replace(match[0], '');
                        }
                    }

                    // Map legacy splits to individual trips. If 1 split, apply to all.
                    const splitForTrip = splitsData.length === 1 ? splitsData[0] : (splitsData[index] || {});

                    return {
                        id: e.id || crypto.randomUUID(),
                        tripDate: e.trip_date,
                        categoryCode: e.category_code || '',
                        otherCategoryName: extractedOther,
                        fromLocation: e.from_location,
                        toLocation: e.to_location,
                        totalKm: e.distance_km ? e.distance_km.toString() : '0',
                        ratePerKm: e.rate_per_km ? e.rate_per_km.toString() : '0',
                        purpose: restoredPurpose,
                        vendorName: splitForTrip.payee_name || e.vendor_name || '',
                        driverName: e.driver_name || '',
                        vehicleNumber: e.vehicle_number || '',
                        payeeType: 'manual',
                        paymentMethod: splitForTrip.payment_method || 'bank_transfer',
                        accountNumber: splitForTrip.account_number || '',
                        ifscCode: splitForTrip.ifsc_code || '',
                        upiId: splitForTrip.upi_id || '',
                        beneficiaryName: splitForTrip.beneficiary_name || '',
                        saveToMaster: false,
                        tripProofFiles: [],
                        bankProofFile: null,
                        tripProofUrls: Array.isArray(e.trip_proof_urls) ? e.trip_proof_urls : (e.trip_proof_url ? [e.trip_proof_url] : []),
                        bankProofUrl: e.bank_proof_url || e.bank_proof_url || ''
                    };
                }));
            } else if (editData.amount) {
                 // Fallback if no transport_trips but is resubmitting
                 const splitForTrip = splitsData[0] || {};
                 setEntries([{
                    ...createEmptyEntry(),
                    tripDate: editData.cutoff_date || format(new Date(), 'yyyy-MM-dd'),
                    totalKm: '0',
                    ratePerKm: '0',
                    purpose: editData.purpose || '',
                    vendorName: splitForTrip.payee_name || editData.vendor_name || '',
                    accountNumber: splitForTrip.account_number || '',
                    ifscCode: splitForTrip.ifsc_code || '',
                    beneficiaryName: splitForTrip.beneficiary_name || '',
                    tripProofUrls: editData.work_proof_url ? JSON.parse(editData.work_proof_url) : [],
                    bankProofUrl: editData.bill_url || ''
                 }]);
            }

            setCutoffDate(editData.cutoff_date || format(new Date(), 'yyyy-MM-dd'));
            setCutoffTime(editData.cutoff_time || '17:00');
        }
    }, [editData]);

    const handleLoadDraft = (draft: any) => {
        setCurrentDraftId(draft.id);

        const splitsData = draft.splits || [];

        if (draft.transport_trips && draft.transport_trips.length > 0) {
            setEntries(draft.transport_trips.map((e: any, index: number) => {
                const isOtherRaw = e.purpose?.includes('[OTHER_CAT:');
                let extractedOther = '';
                let restoredPurpose = e.purpose || '';

                if (isOtherRaw) {
                    const match = e.purpose.match(/\[OTHER_CAT:\s*(.*?)\]\s*/);
                    if (match) {
                        extractedOther = match[1];
                        restoredPurpose = e.purpose.replace(match[0], '');
                    }
                }

                const splitForTrip = splitsData.length === 1 ? splitsData[0] : (splitsData[index] || {});

                return {
                    id: e.id || crypto.randomUUID(),
                    tripDate: e.trip_date,
                    categoryCode: e.category_code || '',
                    otherCategoryName: extractedOther,
                    fromLocation: e.from_location,
                    toLocation: e.to_location,
                    totalKm: e.distance_km ? e.distance_km.toString() : (e.total_km ? e.total_km.toString() : '0'),
                    ratePerKm: e.rate_per_km ? e.rate_per_km.toString() : '0',
                    purpose: restoredPurpose,
                    vendorName: splitForTrip.payee_name || e.vendor_name || '',
                    driverName: e.driver_name || '',
                    vehicleNumber: e.vehicle_number || '',
                    payeeType: 'manual',
                    paymentMethod: splitForTrip.payment_method || 'bank_transfer',
                    accountNumber: splitForTrip.account_number || '',
                    ifscCode: splitForTrip.ifsc_code || '',
                    upiId: splitForTrip.upi_id || '',
                    beneficiaryName: splitForTrip.beneficiary_name || '',
                    saveToMaster: false,
                    tripProofFiles: [],
                    bankProofFile: null,
                    tripProofUrls: Array.isArray(e.trip_proof_urls) ? e.trip_proof_urls : [],
                    bankProofUrl: e.bank_proof_url || ''
                };
            }));
        }

        setCutoffDate(draft.cutoff_date || format(new Date(), 'yyyy-MM-dd'));
        setCutoffTime(draft.cutoff_time || '17:00');
        toast.success('Draft loaded successfully');
    };

    const handleManualSaveDraft = async () => {
        setIsUploadingFiles(true);
        const finalEntries = [...entries];

        try {
            for (let i = 0; i < finalEntries.length; i++) {
                const e = finalEntries[i];
                let uploadedTripUrls: string[] = [];
                let uploadedBankUrl = '';

                if (e.tripProofFiles.length > 0) {
                    uploadedTripUrls = await uploadFilesToStorage(e.tripProofFiles, 'trip-proofs');
                }
                
                if (e.bankProofFile) {
                    const bankUrls = await uploadFilesToStorage([e.bankProofFile], 'bank-proofs');
                    uploadedBankUrl = bankUrls[0];
                }

                finalEntries[i] = {
                    ...e,
                    tripProofFiles: [], // Clear files after upload
                    bankProofFile: null,
                    tripProofUrls: [...e.tripProofUrls, ...uploadedTripUrls],
                    bankProofUrl: uploadedBankUrl || e.bankProofUrl
                };
            }
            setEntries(finalEntries);
        } catch (error: any) {
            toast.error(error.message || 'Failed to upload files for draft. Please try again.');
            setIsUploadingFiles(false);
            return;
        }
        setIsUploadingFiles(false);

        const transportTrips = finalEntries.map(e => {
            const isOther = categories.find(c => c.category_code === e.categoryCode)?.category_name.toLowerCase().includes('other');
            const finalPurpose = isOther && e.otherCategoryName ? `[OTHER_CAT: ${e.otherCategoryName}] ${e.purpose || ''}` : (e.purpose || 'Draft transport');

            return {
                trip_date: e.tripDate,
                from_location: e.fromLocation || 'TBD',
                to_location: e.toLocation || 'TBD',
                distance_km: parseFloat(e.totalKm) || 0,
                rate_per_km: parseFloat(e.ratePerKm) || 0,
                amount: (parseFloat(e.totalKm) || 0) * (parseFloat(e.ratePerKm) || 0),
                category_code: e.categoryCode || 'OTHERS',
                purpose: finalPurpose,
                vendor_name: e.payeeType === 'saved' ? e.beneficiaryName : (e.vendorName || null),
                driver_name: e.driverName || null,
                vehicle_number: e.vehicleNumber || null,
                trip_proof_urls: e.tripProofUrls,
                bank_proof_url: e.bankProofUrl
            };
        });

        const splitPayments = finalEntries.map(e => ({
            split_title: `Transport Payment - ${e.payeeType === 'saved' ? e.beneficiaryName : (e.vendorName || 'New Payee')}`,
            payee_name: e.payeeType === 'saved' ? e.beneficiaryName : (e.vendorName || 'New Payee'),
            account_number: e.accountNumber || '',
            ifsc_code: e.ifscCode || '',
            beneficiary_name: e.beneficiaryName || '',
            upi_id: e.upiId || null,
            amount: calculateTransportAmount(parseFloat(e.totalKm) || 0, parseFloat(e.ratePerKm) || 0),
            payment_method: e.paymentMethod || 'bank_transfer'
        }));

        const isMultiVendor = finalEntries.length > 1;
        const draftData = {
            id: currentDraftId || undefined,
            purpose: `Transport Expenses (${finalEntries.length} trips)`,
            vendorName: isMultiVendor ? 'Multiple Vendors' : (finalEntries[0]?.vendorName || 'Draft Payee'),
            vendorBankDetails: isMultiVendor ? 'Split Payments' : (finalEntries[0]?.paymentMethod === 'bank_transfer' ? `${finalEntries[0]?.accountNumber} - ${finalEntries[0]?.ifscCode}` : finalEntries[0]?.upiId),
            amount: totalAmount || 0,
            cutoffDate: cutoffDate,
            cutoffTime: cutoffTime,
            workProofUrl: JSON.stringify(finalEntries[0]?.tripProofUrls || []),
            billUrl: finalEntries[0]?.bankProofUrl || '',
            isProjectWork: false,
            urgency: 'normal' as const,
            department: 'engineering',
            isTransportPayment: true,
            transportTrips: transportTrips,
            splits: splitPayments,
            paymentType: (finalEntries[0]?.paymentMethod === 'bank_transfer' ? 'bank_account' : 'upi') as any
        };

        const result = await saveDraft(draftData);

        if (result.success && result.data?.id) {
            setCurrentDraftId(result.data.id);
            toast.success('Draft saved successfully');
            setIsSubmitted(false);
        }
    };

    const isBatch = entries.length > 1;

    const updateEntry = (index: number, field: keyof TripEntry, value: any) => {
        setEntries(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const addEntry = () => {
        setEntries(prev => [...prev, createEmptyEntry()]);
    };

    const removeEntry = (index: number) => {
        if (entries.length <= 1) return;
        setEntries(prev => prev.filter((_, i) => i !== index));
    };

    const totalAmount = entries.reduce((sum, e) => {
        const km = parseFloat(e.totalKm) || 0;
        const rate = parseFloat(e.ratePerKm) || 0;
        return sum + calculateTransportAmount(km, rate);
    }, 0);

    const validateEntries = (): boolean => {
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (!e.fromLocation.trim()) { toast.error(`Trip ${i + 1}: From location is required`); return false; }
            if (!e.toLocation.trim()) { toast.error(`Trip ${i + 1}: To location is required`); return false; }
            if (!e.totalKm || parseFloat(e.totalKm) <= 0) { toast.error(`Trip ${i + 1}: Valid KM required`); return false; }
            if (!e.ratePerKm || parseFloat(e.ratePerKm) <= 0) { toast.error(`Trip ${i + 1}: Valid rate required`); return false; }
            if (!e.categoryCode) { toast.error(`Trip ${i + 1}: Category is required`); return false; }
            if (!e.purpose.trim()) { toast.error(`Trip ${i + 1}: Purpose is required`); return false; }

            if (e.payeeType === 'manual' && !e.vendorName) { toast.error(`Trip ${i + 1}: Payee name is required`); return false; }
            if (e.payeeType === 'saved' && !e.payeeId) { toast.error(`Trip ${i + 1}: Select a saved payee`); return false; }
            
            if (e.paymentMethod === 'bank_transfer') {
                if (!e.accountNumber) { toast.error(`Trip ${i + 1}: Account number is required`); return false; }
                if (!e.ifscCode) { toast.error(`Trip ${i + 1}: IFSC code is required`); return false; }
            } else {
                if (!e.upiId) { toast.error(`Trip ${i + 1}: UPI ID is required`); return false; }
            }

            if (e.tripProofFiles.length === 0 && e.tripProofUrls.length === 0) { toast.error(`Trip ${i + 1}: Please upload at least one Trip Proof`); return false; }
            if (!e.bankProofFile && !e.bankProofUrl) { toast.error(`Trip ${i + 1}: Please upload a Bank Proof document`); return false; }
        }
        return true;
    };

    const uploadFilesToStorage = async (files: File[], folder: string): Promise<string[]> => {
        const uploadedUrls: string[] = [];
        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `${user?.id}/${folder}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('transport-proofs')
                .upload(filePath, file);

            if (uploadError) {
                console.error(`Error uploading ${file.name}:`, uploadError);
                throw new Error(`Failed to upload ${file.name}`);
            }

            const { data } = supabase.storage
                .from('transport-proofs')
                .getPublicUrl(filePath);

            uploadedUrls.push(data.publicUrl);
        }
        return uploadedUrls;
    };

    const handleSubmit = async () => {
        if (!validateEntries()) return;

        setIsUploadingFiles(true);
        const finalEntries = [...entries];

        try {
            for (let i = 0; i < finalEntries.length; i++) {
                const e = finalEntries[i];
                let uploadedTripUrls: string[] = [];
                let uploadedBankUrl = '';

                if (e.tripProofFiles.length > 0) {
                    uploadedTripUrls = await uploadFilesToStorage(e.tripProofFiles, 'trip-proofs');
                }
                
                if (e.bankProofFile) {
                    const bankUrls = await uploadFilesToStorage([e.bankProofFile], 'bank-proofs');
                    uploadedBankUrl = bankUrls[0];
                }

                finalEntries[i] = {
                    ...e,
                    tripProofUrls: [...e.tripProofUrls, ...uploadedTripUrls],
                    bankProofUrl: uploadedBankUrl || e.bankProofUrl
                };
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to upload files. Please try again.');
            setIsUploadingFiles(false);
            return;
        }

        const transportTrips = finalEntries.map(e => {
            const isOther = categories.find(c => c.category_code === e.categoryCode)?.category_name.toLowerCase().includes('other');
            const finalPurpose = isOther && e.otherCategoryName ? `[OTHER_CAT: ${e.otherCategoryName}] ${e.purpose}` : e.purpose;

            return {
                id: e.id,
                trip_date: e.tripDate,
                from_location: e.fromLocation,
                to_location: e.toLocation,
                distance_km: parseFloat(e.totalKm),
                rate_per_km: parseFloat(e.ratePerKm),
                amount: parseFloat(e.totalKm) * parseFloat(e.ratePerKm),
                category_code: e.categoryCode,
                purpose: finalPurpose,
                vendor_name: e.payeeType === 'saved' ? e.beneficiaryName : (e.vendorName || null),
                driver_name: e.driverName || null,
                vehicle_number: e.vehicleNumber || null,
                trip_proof_urls: e.tripProofUrls,
                bank_proof_url: e.bankProofUrl,
                payee_account: e.accountNumber || null,
                payee_ifsc: e.ifscCode || null,
                payee_upi: e.upiId || null,
                payment_method: e.paymentMethod || 'bank_transfer',
                beneficiary_name: e.beneficiaryName || (e.payeeType === 'saved' ? '' : (e.vendorName || null))
            };
        });

        const splitPayments = finalEntries.map(e => ({
            split_title: `Transport Payment - ${e.payeeType === 'saved' ? e.beneficiaryName : (e.vendorName || 'New Payee')}`,
            payee_name: e.payeeType === 'saved' ? e.beneficiaryName : (e.vendorName || 'New Payee'),
            account_number: e.accountNumber || '',
            ifsc_code: e.ifscCode || '',
            beneficiary_name: e.beneficiaryName || '',
            upi_id: e.upiId || null,
            amount: calculateTransportAmount(parseFloat(e.totalKm) || 0, parseFloat(e.ratePerKm) || 0),
            payment_method: e.paymentMethod || 'bank_transfer'
        }));

        if (currentDraftId) {
            await deleteDraft(currentDraftId);
        }

        // Save new payees to master if requested
        for (const e of finalEntries) {
            if (e.payeeType === 'manual' && e.saveToMaster && e.vendorName && e.accountNumber) {
                const existing = payees.find(p => p.account_number === e.accountNumber);
                if (!existing) {
                    await addPayee({
                        name: e.vendorName,
                        account_number: e.accountNumber,
                        ifsc_code: e.ifscCode.toUpperCase(),
                        bank_name: ''
                    });
                }
            }
        }

        const categoryNames = finalEntries.map(e => {
            const isOther = categories.find(c => c.category_code === e.categoryCode)?.category_name.toLowerCase().includes('other');
            return isOther && e.otherCategoryName ? e.otherCategoryName.toUpperCase() : e.categoryCode;
        });
        const uniqueCategories = [...new Set(categoryNames)].join(', ');
        const dates = finalEntries.map(e => e.tripDate);
        const uniqueDates = [...new Set(dates)].map(d => format(new Date(d), 'dd MMM yy')).join(', ');

        const dynamicTitle = `Transport Payment - ${uniqueDates} - ${uniqueCategories}`;

        const detailedDescLines = finalEntries.map((e, idx) => {
            const catName = categoryNames[idx];
            return `Trip ${idx + 1}: ${catName}
Date: ${format(new Date(e.tripDate), 'dd MMM yyyy')}
Route: ${e.fromLocation} -> ${e.toLocation}
Distance: ${e.totalKm} KM @ ₹${e.ratePerKm}/KM (₹${calculateTransportAmount(parseFloat(e.totalKm) || 0, parseFloat(e.ratePerKm) || 0)})
Vendor/Payee: ${e.payeeType === 'saved' ? e.beneficiaryName : (e.vendorName || 'N/A')}
Bank/UPI: ${e.paymentMethod === 'bank_transfer' ? `${e.accountNumber} [${e.ifscCode}]` : e.upiId}
Driver: ${e.driverName || 'N/A'} | Vehicle: ${e.vehicleNumber || 'N/A'}
Purpose: ${e.purpose || 'N/A'}`;
        });
        const detailedDescription = detailedDescLines.join('\n\n');

        const isMultiVendor = finalEntries.length > 1;

        const requestData = {
            purpose: dynamicTitle.substring(0, 255),
            detailedDescription: detailedDescription,
            vendorName: isMultiVendor ? 'Multiple Vendors' : (finalEntries[0]?.payeeType === 'saved' ? finalEntries[0]?.beneficiaryName : (finalEntries[0]?.vendorName || '')),
            vendorBankDetails: isMultiVendor ? 'Split Payments' : (finalEntries[0]?.paymentMethod === 'bank_transfer' ? `${finalEntries[0]?.accountNumber} - ${finalEntries[0]?.ifscCode}` : finalEntries[0]?.upiId),
            amount: totalAmount,
            cutoffDate: cutoffDate,
            cutoffTime: cutoffTime,
            workProofUrl: JSON.stringify(finalEntries[0]?.tripProofUrls || []),
            billUrl: finalEntries[0]?.bankProofUrl || '',
            isProjectWork: false,
            urgency: 'normal' as const,
            department: 'engineering',
            paymentType: (finalEntries[0]?.paymentMethod === 'bank_transfer' ? 'bank_account' : 'upi') as any,
            vendorUpi: finalEntries[0]?.paymentMethod !== 'bank_transfer' ? (finalEntries[0]?.upiId || null) : null,
            vendorAccountNumber: finalEntries[0]?.paymentMethod === 'bank_transfer' ? (finalEntries[0]?.accountNumber || null) : null,
            vendorIfscCode: finalEntries[0]?.paymentMethod === 'bank_transfer' ? (finalEntries[0]?.ifscCode?.toUpperCase().trim() || null) : null,
            beneficiaryName: finalEntries[0]?.beneficiaryName || (finalEntries[0]?.payeeType === 'saved' ? '' : (finalEntries[0]?.vendorName || null)),
            isTransportPayment: true,
            transportTrips: transportTrips,
            isSplitPayment: isMultiVendor || undefined,
            splits: splitPayments,
            id: editData?.id || undefined
        };

        const result = await createRequest(requestData as any);

        if (result.success) {
            setIsSubmitted(true);
            setTimeout(() => { onSuccess(); }, 2000);
        } else {
             setIsUploadingFiles(false);
        }
    };

    if (isSubmitted) {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">
                    {isBatch ? `${entries.length} Trips Submitted!` : 'Trip Submitted!'}
                </h2>
                <p className="text-muted-foreground">Your transport expense is now pending approval.</p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Truck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">{isResubmitting ? 'Edit & Resubmit Transport' : 'New Transport Expense'}</h2>
                        <p className="text-xs text-muted-foreground">Auto-calculates Amount = KM × Rate</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                    <X className="w-5 h-5" />
                </Button>
            </div>

            {/* Entries */}
            <AnimatePresence>
                {entries.map((entry, index) => (
                    <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="p-5 rounded-xl border border-border bg-card space-y-4"
                    >
                        {/* Trip header */}
                        <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-2">
                            <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                                <Truck className="w-4 h-4" /> Trip {index + 1}
                            </h3>
                            {entries.length > 1 && (
                                <Button variant="ghost" size="sm" onClick={() => removeEntry(index)} className="text-red-400 hover:text-red-300 h-8 px-2 hover:bg-red-400/10">
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                                </Button>
                            )}
                        </div>

                        {/* Date + Category */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Trip Date *</Label>
                                <Input type="date" value={entry.tripDate} onChange={e => updateEntry(index, 'tripDate', e.target.value)} />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-xs">Category *</Label>
                                <Select value={entry.categoryCode} onValueChange={v => updateEntry(index, 'categoryCode', v)}>
                                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => (
                                            <SelectItem key={c.category_code} value={c.category_code}>
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full" style={{ background: c.color_code || '#666' }} />
                                                    {c.category_name.replace(/\bFF\b\s*\(Fresh Farm\)|\bFresh Farm\b|\bFF\b/gi, 'Farmers Factory')}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {categories.find(c => c.category_code === entry.categoryCode)?.category_name.toLowerCase().includes('other') && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                                        <Input
                                            placeholder="e.g. Zepto, Blinkit, Ola, Uber"
                                            value={entry.otherCategoryName || ''}
                                            onChange={e => updateEntry(index, 'otherCategoryName', e.target.value)}
                                            className="bg-muted/50"
                                        />
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {/* From / To */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1">From *</Label>
                                <Input placeholder="Starting point" value={entry.fromLocation} onChange={e => updateEntry(index, 'fromLocation', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs flex items-center gap-1">To *</Label>
                                <Input placeholder="Destination" value={entry.toLocation} onChange={e => updateEntry(index, 'toLocation', e.target.value)} />
                            </div>
                        </div>

                        {/* KM + Rate + Amount */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Total KM *</Label>
                                <Input type="number" placeholder="0" value={entry.totalKm} onChange={e => updateEntry(index, 'totalKm', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Rate / KM (₹) *</Label>
                                <Input type="number" placeholder="0" value={entry.ratePerKm} onChange={e => updateEntry(index, 'ratePerKm', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Amount (₹)</Label>
                                <div className="h-9 flex items-center px-3 rounded-md border bg-muted/30 text-sm font-bold text-emerald-400">
                                    ₹{calculateTransportAmount(parseFloat(entry.totalKm) || 0, parseFloat(entry.ratePerKm) || 0).toLocaleString('en-IN')}
                                </div>
                            </div>
                        </div>

                        {/* Purpose */}
                        <div className="space-y-1.5">
                            <Label className="text-xs">Purpose *</Label>
                            <Textarea placeholder="Describe the purpose of this trip..." value={entry.purpose} onChange={e => updateEntry(index, 'purpose', e.target.value)} rows={2} />
                        </div>

                        {/* Payee / Driver / Vehicle */}
                        <div className="grid grid-cols-3 gap-3 pb-4 border-b border-border/50">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Payee / Vendor Name</Label>
                                <Input placeholder="Name" value={entry.vendorName} onChange={e => updateEntry(index, 'vendorName', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Driver</Label>
                                <Input placeholder="Driver name" value={entry.driverName} onChange={e => updateEntry(index, 'driverName', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Name of Vehicle</Label>
                                <Input placeholder="Vehicle name" value={entry.vehicleNumber} onChange={e => updateEntry(index, 'vehicleNumber', e.target.value)} />
                            </div>
                        </div>

                        {/* Per-Trip Payee Details */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    <IndianRupee className="w-3.5 h-3.5" /> Payment Details
                                </h4>
                                <div className="flex bg-muted rounded-md p-0.5">
                                    <Button
                                        variant={entry.payeeType === 'manual' ? 'default' : 'ghost'}
                                        size="sm"
                                        className="text-[10px] h-6 px-2"
                                        onClick={() => updateEntry(index, 'payeeType', 'manual')}
                                    > Manual </Button>
                                    <Button
                                        variant={entry.payeeType === 'saved' ? 'default' : 'ghost'}
                                        size="sm"
                                        className="text-[10px] h-6 px-2"
                                        onClick={() => updateEntry(index, 'payeeType', 'saved')}
                                    > Saved </Button>
                                </div>
                            </div>

                            {entry.payeeType === 'manual' ? (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in-95">
                                    <div className="col-span-2 space-y-1.5">
                                        <Label className="text-xs">Payment Method *</Label>
                                        <Select value={entry.paymentMethod} onValueChange={v => updateEntry(index, 'paymentMethod', v)}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                                                <SelectItem value="gpay">📱 GPay</SelectItem>
                                                <SelectItem value="phonepe">📱 PhonePe</SelectItem>
                                                <SelectItem value="paytm">📱 Paytm</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {entry.paymentMethod === 'bank_transfer' ? (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Account # *</Label>
                                                <Input className="h-9 text-xs" placeholder="Account number" value={entry.accountNumber} onChange={e => updateEntry(index, 'accountNumber', e.target.value)} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">IFSC Code *</Label>
                                                <Input className="h-9 text-xs" placeholder="e.g., SBIN0001234" value={entry.ifscCode} onChange={e => updateEntry(index, 'ifscCode', e.target.value.toUpperCase())} />
                                            </div>
                                            <div className="col-span-2 space-y-1.5">
                                                <Label className="text-xs">Beneficiary Name</Label>
                                                <Input className="h-9 text-xs" placeholder="Bank record name" value={entry.beneficiaryName} onChange={e => updateEntry(index, 'beneficiaryName', e.target.value)} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2 space-y-1.5">
                                            <Label className="text-xs">UPI ID / Phone *</Label>
                                            <Input className="h-9 text-xs" placeholder="9876543210 or name@upi" value={entry.upiId} onChange={e => updateEntry(index, 'upiId', e.target.value)} />
                                        </div>
                                    )}

                                    <div className="col-span-2 flex items-center gap-2 pt-1">
                                        <Switch checked={entry.saveToMaster} onCheckedChange={checked => updateEntry(index, 'saveToMaster', checked)} />
                                        <Label className="text-[10px] cursor-pointer" onClick={() => updateEntry(index, 'saveToMaster', !entry.saveToMaster)}> Save to Master List </Label>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 animate-in fade-in zoom-in-95">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Select Payee *</Label>
                                        <Select value={entry.payeeId || ''} onValueChange={id => {
                                            const p = payees.find(x => x.id === id);
                                            if (p) {
                                                updateEntry(index, 'payeeId', id);
                                                updateEntry(index, 'vendorName', p.name);
                                                updateEntry(index, 'accountNumber', p.account_number || '');
                                                updateEntry(index, 'ifscCode', p.ifsc_code || '');
                                                updateEntry(index, 'beneficiaryName', p.name || '');
                                                updateEntry(index, 'paymentMethod', 'bank_transfer');
                                            }
                                        }}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Choose from master" /></SelectTrigger>
                                            <SelectContent>
                                                {payees.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {entry.payeeId && (
                                        <div className="p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-[11px] space-y-1">
                                            <p><span className="text-muted-foreground">A/C:</span> {entry.accountNumber}</p>
                                            <p><span className="text-muted-foreground">IFSC:</span> {entry.ifscCode}</p>
                                            <p><span className="text-muted-foreground">Beneficiary:</span> {entry.beneficiaryName}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Per-trip Proofs */}
                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                <UploadCloud className="w-3.5 h-3.5" /> Trip Proofs & Bank Proof
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold">Trip Proofs (Multi-select) *</Label>
                                    <div className="relative">
                                        <Input
                                            type="file"
                                            id={`trip-proof-${entry.id}`}
                                            multiple
                                            accept="image/*,.pdf"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    updateEntry(index, 'tripProofFiles', Array.from(e.target.files));
                                                }
                                            }}
                                        />
                                        <Label
                                            htmlFor={`trip-proof-${entry.id}`}
                                            className="flex flex-col items-center justify-center w-full h-20 px-4 py-2 border-2 border-dashed border-primary/20 rounded-lg cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all text-[10px] text-muted-foreground gap-1 group"
                                        >
                                            <UploadCloud className="w-4 h-4 text-primary/50 group-hover:text-primary transition-colors" />
                                            {entry.tripProofFiles.length > 0 ? (
                                                <span className="text-primary font-bold">{entry.tripProofFiles.length} file(s) selected</span>
                                            ) : (
                                                <span className="font-medium text-center">Click to upload Trip Proofs</span>
                                            )}
                                        </Label>
                                        {entry.tripProofUrls.length > 0 && entry.tripProofFiles.length === 0 && (
                                            <p className="text-[9px] text-primary mt-1">
                                                Saved: {entry.tripProofUrls.length} file(s)
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold">Bank Proof *</Label>
                                    <div className="relative">
                                        <Input
                                            type="file"
                                            id={`bank-proof-${entry.id}`}
                                            accept="image/*,.pdf"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    updateEntry(index, 'bankProofFile', e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <Label
                                            htmlFor={`bank-proof-${entry.id}`}
                                            className="flex flex-col items-center justify-center w-full h-20 px-4 py-2 border-2 border-dashed border-primary/20 rounded-lg cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all text-[10px] text-muted-foreground gap-1 group"
                                        >
                                            <UploadCloud className="w-4 h-4 text-primary/50 group-hover:text-primary transition-colors" />
                                            {entry.bankProofFile ? (
                                                <span className="text-primary font-bold truncate max-w-full px-2">{entry.bankProofFile.name}</span>
                                            ) : (
                                                <span className="font-medium text-center">Click to upload Bank Proof</span>
                                            )}
                                        </Label>
                                        {entry.bankProofUrl && !entry.bankProofFile && (
                                            <p className="text-[9px] text-primary mt-1">
                                                Saved Bank Proof
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Common Section: Timing */}
            <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" /> Common Submission Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Cut-off Date</Label>
                        <Input type="date" value={cutoffDate} onChange={e => setCutoffDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Cut-off Time</Label>
                        <Input type="time" value={cutoffTime} onChange={e => setCutoffTime(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Add Trip Button */}
            <Button variant="outline" onClick={addEntry} className="w-full border-dashed gap-2 h-12">
                <Plus className="w-4 h-4" /> Add Another Trip (Batch Entry)
            </Button>

            {/* Summary Bar */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div>
                    <p className="text-xs text-muted-foreground">{entries.length} trip{entries.length > 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {entries.reduce((s, e) => s + (parseFloat(e.totalKm) || 0), 0).toFixed(1)} KM total
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="text-xl font-bold flex items-center gap-1">
                        <IndianRupee className="w-4 h-4" />
                        {totalAmount.toLocaleString('en-IN')}
                    </p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
                <Button
                    variant="secondary"
                    className="w-full h-14 bg-muted/60 hover:bg-muted text-foreground font-bold gap-2"
                    onClick={handleManualSaveDraft}
                    disabled={isSaving || isUploadingFiles}
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5" />}
                    {currentDraftId ? 'Update Draft' : 'Save as Draft'}
                </Button>
                <Button
                    className="w-full h-14 text-base font-bold gap-2"
                    disabled={isSaving || isUploadingFiles}
                    onClick={handleSubmit}
                >
                    {(isSaving || isUploadingFiles) ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> {isUploadingFiles ? 'Uploading Files...' : 'Processing...'}</>
                    ) : (
                        <><Route className="w-5 h-5" /> Submit {isBatch ? `${entries.length} Trips` : 'Trip'}</>
                    )}
                </Button>
            </div>

            {/* Drafts Section */}
            {myDrafts.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                    <Label className="text-sm font-bold flex items-center gap-2 mb-4">
                        <FileText className="w-4 h-4 text-primary" /> Saved Transport Drafts
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
                                        <span>{draft.transport_trips?.length || 1} Trip(s)</span>
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
                                        if (window.confirm('Delete this transport draft?')) {
                                            await deleteDraft(draft.id);
                                            if (currentDraftId === draft.id) setCurrentDraftId(null);
                                            setMyDrafts(prev => prev.filter(d => d.id !== draft.id));
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
    );
}
