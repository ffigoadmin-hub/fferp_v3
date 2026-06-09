import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, Banknote } from 'lucide-react';
import { PaymentConversionService } from '@/services/PaymentConversionService';
import { toast } from 'sonner';

interface BatchToDirectConversionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payment: any;
    batchId: string;
    batchReference: string;
    onSuccess: () => void;
}

export function BatchToDirectConversionDialog({
    open,
    onOpenChange,
    payment,
    batchId,
    batchReference,
    onSuccess
}: BatchToDirectConversionDialogProps) {
    const [isConverting, setIsConverting] = useState(false);
    const [confirmStep, setConfirmStep] = useState(1);

    const handleConvert = async () => {
        if (confirmStep === 1) {
            setConfirmStep(2);
            return;
        }

        setIsConverting(true);
        try {
            const result = await PaymentConversionService.convertBatchToDirectPayment(
                payment.id,
                batchId
            );

            if (result.success) {
                toast.success('Payment converted to direct payment successfully');
                onSuccess();
                onOpenChange(false);
                setConfirmStep(1);
            } else {
                toast.error(result.error || 'Failed to convert payment');
            }
        } catch (error) {
            console.error('Conversion error:', error);
            toast.error('Failed to convert payment');
        } finally {
            setIsConverting(false);
        }
    };

    const handleCancel = () => {
        setConfirmStep(1);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-primary" />
                        Convert to Direct Payment
                    </DialogTitle>
                    <DialogDescription>
                        {confirmStep === 1
                            ? 'This will remove the payment from the batch and move it to direct payment flow.'
                            : 'Are you absolutely sure? This action cannot be undone.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Payment Details */}
                    <div className="bg-muted/30 p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm text-muted-foreground">Payment Number</p>
                                <p className="font-mono font-bold">
                                    PAY-{String(payment.payment_number || 0).padStart(6, '0')}
                                </p>
                            </div>
                            <Badge className="bg-primary/20 text-primary border-primary/30">
                                ₹{Number(payment.amount).toLocaleString()}
                            </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p className="text-muted-foreground">Vendor</p>
                                <p className="font-medium">{payment.vendor_name}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Purpose</p>
                                <p className="font-medium truncate">{payment.purpose}</p>
                            </div>
                        </div>
                    </div>

                    {/* Batch Info */}
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <p className="font-semibold text-amber-900 dark:text-amber-100">
                                Current Batch
                            </p>
                        </div>
                        <p className="text-sm text-amber-700 dark:text-amber-300 font-mono">
                            {batchReference}
                        </p>
                    </div>

                    {/* Conversion Flow */}
                    <div className="flex items-center justify-center gap-4 py-2">
                        <div className="text-center">
                            <Badge variant="outline" className="mb-2">Batch Payment</Badge>
                            <p className="text-xs text-muted-foreground">Current Status</p>
                        </div>
                        <ArrowRight className="w-6 h-6 text-primary animate-pulse" />
                        <div className="text-center">
                            <Badge variant="outline" className="mb-2 bg-primary/10 border-primary">
                                Direct Payment
                            </Badge>
                            <p className="text-xs text-muted-foreground">After Conversion</p>
                        </div>
                    </div>

                    {/* Warning */}
                    {confirmStep === 2 && (
                        <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/30">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                                <div>
                                    <p className="font-semibold text-destructive">Final Confirmation</p>
                                    <p className="text-sm text-destructive/80 mt-1">
                                        The payment will be removed from batch {batchReference} and will require separate CEO approval as a direct payment.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Next Steps */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            What happens next?
                        </p>
                        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                            <li>• Payment will be moved to Direct Payment tab</li>
                            <li>• CEO will see "Converted from Batch" indicator</li>
                            <li>• Requires separate CEO approval</li>
                            <li>• Screenshot upload after CEO approval</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel} disabled={isConverting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConvert}
                        disabled={isConverting}
                        className={confirmStep === 2 ? 'bg-destructive hover:bg-destructive/90' : ''}
                    >
                        {isConverting
                            ? 'Converting...'
                            : confirmStep === 1
                                ? 'Continue'
                                : 'Confirm Conversion'
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
