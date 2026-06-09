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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, Loader2 } from 'lucide-react';
import { PaymentExportService } from '@/services/PaymentExportService';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PaymentExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PaymentExportDialog({ open, onOpenChange }: PaymentExportDialogProps) {
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [paymentType, setPaymentType] = useState<'all' | 'batch' | 'direct' | 'converted'>('all');
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (!startDate || !endDate) {
            toast.error('Please select both start and end dates');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            toast.error('Start date must be before end date');
            return;
        }

        setIsExporting(true);
        try {
            await PaymentExportService.exportPaymentsToCSV(
                new Date(startDate),
                new Date(endDate),
                paymentType
            );
            toast.success('Payment data exported successfully');
            onOpenChange(false);
        } catch (error) {
            console.error('Export error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to export data');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-primary" />
                        Export Payment Data
                    </DialogTitle>
                    <DialogDescription>
                        Download payment details with approval history and screenshots
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Date Range */}
                    <div className="space-y-2">
                        <Label htmlFor="start-date" className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Start Date
                        </Label>
                        <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="end-date" className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            End Date
                        </Label>
                        <Input
                            id="end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>

                    {/* Payment Type Filter */}
                    <div className="space-y-2">
                        <Label htmlFor="payment-type">Payment Type</Label>
                        <Select value={paymentType} onValueChange={(value: any) => setPaymentType(value)}>
                            <SelectTrigger id="payment-type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Payments</SelectItem>
                                <SelectItem value="batch">Batch Payments Only</SelectItem>
                                <SelectItem value="direct">Direct Payments Only</SelectItem>
                                <SelectItem value="converted">Converted Payments Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Export Info */}
                    <div className="bg-muted/30 p-3 rounded-lg border text-sm">
                        <p className="font-semibold mb-1">Export includes:</p>
                        <ul className="text-muted-foreground space-y-0.5">
                            <li>• Payment details and amounts</li>
                            <li>• Approval history and dates</li>
                            <li>• Screenshot URLs</li>
                            <li>• Batch conversion tracking</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
                        Cancel
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting}>
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Export CSV
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
