import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Image as ImageIcon, X, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentProofUploadProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paymentId: string;
    paymentNumber: string;
    onUploadComplete: (url: string) => void;
}

export function PaymentProofUpload({
    open,
    onOpenChange,
    paymentId,
    paymentNumber,
    onUploadComplete
}: PaymentProofUploadProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        try {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${paymentId}-${Date.now()}.${fileExt}`;
            const filePath = `payment-proofs/${fileName}`;

            const { data, error } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, selectedFile);

            if (error) throw error;

            const { data: urlData } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(filePath);

            // Update payment request with screenshot URL
            const { error: updateError } = await supabase
                .from('payment_requests')
                .update({ work_proof_url: urlData.publicUrl } as any)
                .eq('id', paymentId);

            if (updateError) throw updateError;

            setUploadedUrl(urlData.publicUrl);
            toast.success('Payment proof uploaded successfully');
            onUploadComplete(urlData.publicUrl);
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload payment proof');
        } finally {
            setIsUploading(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setUploadedUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClose = () => {
        handleReset();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Payment Proof</DialogTitle>
                    <DialogDescription>
                        Upload screenshot of payment confirmation for {paymentNumber}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!uploadedUrl ? (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />

                            {previewUrl ? (
                                <div className="relative">
                                    <img
                                        src={previewUrl}
                                        alt="Payment proof preview"
                                        className="w-full h-64 object-contain rounded-lg border bg-muted"
                                    />
                                    <button
                                        onClick={handleReset}
                                        className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/90 hover:bg-destructive text-white"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                                >
                                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                    <p className="font-medium mb-1">Click to upload screenshot</p>
                                    <p className="text-sm text-muted-foreground">
                                        PNG, JPG up to 5MB
                                    </p>
                                </div>
                            )}

                            {selectedFile && !uploadedUrl && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={handleReset}
                                        className="flex-1"
                                        disabled={isUploading}
                                    >
                                        Change File
                                    </Button>
                                    <Button
                                        onClick={handleUpload}
                                        className="flex-1"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" />
                                                Upload
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-status-live/10 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-status-live" />
                            </div>
                            <p className="font-semibold text-lg mb-2">Upload Successful!</p>
                            <p className="text-sm text-muted-foreground mb-4">
                                Payment proof has been saved
                            </p>
                            <Button onClick={handleClose} className="w-full">
                                Done
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
