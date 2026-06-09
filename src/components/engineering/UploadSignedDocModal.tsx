import { useState, useEffect } from 'react';
import { Upload, FileCheck, Link } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { toast } from 'sonner';

interface UploadSignedDocModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workOrderId: string;
    woNumber: number;
    initialUrl?: string;
    onSuccess: () => void;
}

export function UploadSignedDocModal({
    open,
    onOpenChange,
    workOrderId,
    woNumber,
    initialUrl = '',
    onSuccess,
}: UploadSignedDocModalProps) {
    const { uploadSignedDocument, sendForApproval } = useWorkOrders();
    const [signedUrl, setSignedUrl] = useState(initialUrl);
    const [isSaving, setIsSaving] = useState(false);

    // Update URL when modal opens or workOrderId changes
    useEffect(() => {
        if (open) {
            setSignedUrl(initialUrl || '');
        }
    }, [open, initialUrl, workOrderId]);

    const handleUpload = async () => {
        const url = (signedUrl || '').trim();
        if (!url) {
            toast.error('Please provide the signed document URL');
            return;
        }

        const driveRegex = /^https?:\/\/(drive|docs)\.google\.com\/[^\s]+$/;
        if (!driveRegex.test(url)) {
            toast.error('Please provide a valid Google Drive link');
            return;
        }

        setIsSaving(true);
        try {
            await uploadSignedDocument(workOrderId, signedUrl.trim());
            toast.success('Signed document uploaded successfully');
            setSignedUrl('');
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to upload signed document');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-blue-400" />
                        Upload Signed WO-{woNumber.toString().padStart(3, '0')}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-start gap-3">
                            <FileCheck className="w-5 h-5 text-blue-400 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-medium text-blue-400">Instructions</p>
                                <ol className="list-decimal list-inside mt-1 space-y-1 text-muted-foreground">
                                    <li>Get the vendor's signature on the downloaded WO PDF</li>
                                    <li>Upload the signed document to Google Drive</li>
                                    <li>Paste the Google Drive link below</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label className="flex items-center gap-1.5">
                            <Link className="w-3.5 h-3.5" />
                            Signed Document URL (Google Drive)
                        </Label>
                        <Input
                            value={signedUrl}
                            onChange={(e) => setSignedUrl(e.target.value)}
                            placeholder="https://drive.google.com/..."
                            className="mt-1.5"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={isSaving || !(signedUrl || '').trim()}>
                        {isSaving ? 'Uploading...' : 'Upload & Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
