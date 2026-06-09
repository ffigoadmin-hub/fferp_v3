import { useState } from 'react';
import { 
    Upload, Lock, Building2, FileText, Check, 
    AlertTriangle, ExternalLink, Copy 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface BankUploadWorkflowProps {
    batch: {
        id: string;
        batch_id: string;
        total_amount: number;
        total_transactions: number;
        status: string;
    };
    onComplete: () => void;
    isOpen: boolean;
    onClose: () => void;
}

export function BankUploadWorkflow({ batch, onComplete, isOpen, onClose }: BankUploadWorkflowProps) {
    const [bankRefNo, setBankRefNo] = useState('');
    const [coverNoteUrl, setCoverNoteUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!bankRefNo.trim()) {
            toast.error('Bank Reference Number is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await (supabase.from('bulk_batches') as any)
                .update({
                    bank_ref_no: bankRefNo.trim(),
                    cover_note_url: coverNoteUrl.trim() || null,
                    cover_note_submitted_at: new Date().toISOString(),
                    status: 'bank_uploaded'
                })
                .eq('id', batch.id);

            if (error) throw error;

            toast.success('Bank upload details recorded successfully');
            onComplete();
            onClose();
            
            // Reset form
            setBankRefNo('');
            setCoverNoteUrl('');
        } catch (error) {
            console.error('Error updating batch:', error);
            toast.error('Failed to record bank upload details');
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyBatchId = () => {
        navigator.clipboard.writeText(batch.batch_id);
        toast.success('Batch ID copied');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary" />
                        Record Bank Upload
                    </DialogTitle>
                    <DialogDescription>
                        After uploading to Kotak Portal and receiving CEO external OTP authorization
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Batch Summary - LOCKED */}
                    <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-bold text-muted-foreground uppercase">Locked Batch Details</span>
                                </div>
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    {batch.status}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Batch ID</p>
                                    <div className="flex items-center gap-2">
                                        <p className="font-mono font-bold">{batch.batch_id}</p>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyBatchId}>
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Transactions</p>
                                    <p className="font-bold">{batch.total_transactions}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs text-muted-foreground">Total Amount</p>
                                    <p className="text-2xl font-bold text-primary">
                                        ₹{Number(batch.total_amount).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* External Bank Protocol Notice */}
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-bold text-blue-800">External Bank OTP Required</p>
                            <p className="text-blue-700">
                                CEO must authorize this transaction on Kotak Portal using external OTP 
                                sent by the bank. This ERP does not collect internal OTPs.
                            </p>
                        </div>
                    </div>

                    {/* Input Fields */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="bankRefNo" className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Bank Reference Number *
                            </Label>
                            <Input
                                id="bankRefNo"
                                value={bankRefNo}
                                onChange={(e) => setBankRefNo(e.target.value)}
                                placeholder="e.g., KOTAKBULK123456789"
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                Reference number provided by Kotak after successful upload
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="coverNoteUrl" className="flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Cover Note URL (Optional)
                            </Label>
                            <Input
                                id="coverNoteUrl"
                                value={coverNoteUrl}
                                onChange={(e) => setCoverNoteUrl(e.target.value)}
                                placeholder="https://storage.example.com/cover-note.pdf"
                            />
                            <p className="text-xs text-muted-foreground">
                                Link to uploaded cover note PDF (if applicable)
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !bankRefNo.trim()}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {isSubmitting ? (
                            'Recording...'
                        ) : (
                            <>
                                <Check className="w-4 h-4 mr-2" />
                                Confirm Bank Upload
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
