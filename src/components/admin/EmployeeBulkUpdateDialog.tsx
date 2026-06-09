import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { useEmployeeBulkOps, EmployeeImportRow } from '@/hooks/useEmployeeBulkOps';
import { Download, Upload, AlertTriangle, FileSpreadsheet, CheckCircle, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface EmployeeBulkUpdateDialogProps {
    onSuccess?: () => void;
}

export function EmployeeBulkUpdateDialog({ onSuccess }: EmployeeBulkUpdateDialogProps) {
    const [open, setOpen] = useState(false);
    const [previewData, setPreviewData] = useState<EmployeeImportRow[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        isProcessing,
        progress,
        exportEmployeesTemplate,
        processImportedFile,
        bulkUpdateEmployees
    } = useEmployeeBulkOps();

    const handleDownloadTemplate = () => {
        exportEmployeesTemplate();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
            toast.error('Please upload a .csv or .xlsx file');
            return;
        }

        const data = await processImportedFile(file);
        if (data) {
            setPreviewData(data);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleConfirmUpdate = async () => {
        if (!previewData) return;

        const result = await bulkUpdateEmployees(previewData);
        if (result && result.success) {
            setOpen(false);
            setPreviewData(null);
            if (onSuccess) onSuccess();
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Bulk Update
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Bulk Update Employees</DialogTitle>
                    <DialogDescription>
                        Download the current employee list, make changes in Excel, and upload to update multiple records at once.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4 flex-1 overflow-hidden flex flex-col">
                    {/* Step 1: Download Template */}
                    <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-3">
                        <h3 className="font-medium flex items-center gap-2">
                            <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Download Template
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Get the latest employee data formatted for update. Include system IDs required for matching records.
                        </p>
                        <Button variant="secondary" size="sm" onClick={handleDownloadTemplate} disabled={isProcessing}>
                            <Download className="w-4 h-4 mr-2" />
                            Download Current Employee List
                        </Button>
                    </div>

                    {/* Step 2: Upload Modified File */}
                    <div className="bg-muted/30 p-4 rounded-lg border border-border space-y-3 flex-1 flex flex-col min-h-0">
                        <h3 className="font-medium flex items-center gap-2">
                            <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Upload Modified File
                        </h3>

                        {!previewData ? (
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-10 h-10 text-muted-foreground mb-4" />
                                <p className="font-medium">Click to upload .xlsx or .csv</p>
                                <p className="text-sm text-muted-foreground mt-1">Make sure to keep the 'System ID' column unchanged</p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                    onChange={handleFileChange}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col flex-1 min-h-0">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-sm font-medium">
                                        Preview: {previewData.length} records found
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)} className="text-destructive">
                                        Remove File
                                    </Button>
                                </div>

                                <div className="rounded-md border flex-1 overflow-hidden">
                                    <ScrollArea className="h-[300px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Employee ID</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {previewData.slice(0, 50).map((row, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell className="font-medium">{row.name}</TableCell>
                                                        <TableCell className="text-muted-foreground text-xs">{row.email}</TableCell>
                                                        <TableCell>{row.office_number}</TableCell>
                                                        <TableCell>{row.role}</TableCell>
                                                        <TableCell>
                                                            {row.is_active ?
                                                                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Active</Badge> :
                                                                <Badge variant="secondary">Inactive</Badge>
                                                            }
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {previewData.length > 50 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                                                            ... and {previewData.length - 50} more records
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>

                                <div className="mt-2 text-xs text-muted-foreground flex items-start gap-2 bg-yellow-50 p-2 rounded text-yellow-800 border border-yellow-200">
                                    <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                                    <p>
                                        <strong>Warning:</strong> Updates are irreversible. The system will update records matching the
                                        'System ID'. If IDs are missing, those rows will be skipped.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="sm:justify-between">
                    <div className="text-sm text-muted-foreground flex items-center">
                        {isProcessing && (
                            <span className="flex items-center gap-2">
                                Updating... {progress}%
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmUpdate} disabled={!previewData || isProcessing}>
                            {isProcessing ? 'Processing...' : 'Confirm Update'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
