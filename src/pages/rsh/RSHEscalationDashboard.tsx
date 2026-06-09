import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteVisitEscalations } from '@/hooks/useSiteVisitEscalations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Plus, Search, Filter, MapPin, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Activity, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SiteVisitEscalation, SiteVisitEscalationStatus } from '@/types/site-visit-escalations';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function RSHEscalationDashboard() {
    const { user } = useAuth();
    const { escalations, loading, createEscalation } = useSiteVisitEscalations();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Form State
    const [issueDescription, setIssueDescription] = useState('');
    const [proofUrl, setProofUrl] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [errors, setErrors] = useState<{ description?: string; proof?: string }>({});

    const handleFileUpload = async (file: File) => {
        // Validate file
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            toast.error('Invalid file type. Please upload JPG, PNG, or WebP images.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size exceeds 5MB limit');
            return;
        }

        try {
            setIsUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `site-visit/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('escalation-proofs')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('escalation-proofs')
                .getPublicUrl(filePath);

            setProofUrl(publicUrl);
            setUploadedFile(file);
            setErrors(prev => ({ ...prev, proof: undefined }));
            toast.success('Proof uploaded successfully');
        } catch (err: any) {
            console.error('Upload error:', err);
            toast.error('Failed to upload proof: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const validateForm = () => {
        const newErrors: typeof errors = {};

        if (!issueDescription || issueDescription.trim().length < 10) {
            newErrors.description = 'Description must be at least 10 characters';
        }
        if (issueDescription.length > 500) {
            newErrors.description = 'Description must not exceed 500 characters';
        }
        if (!proofUrl) {
            newErrors.proof = 'Proof is required. Please upload an image or provide a URL';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        try {
            setIsSubmitting(true);
            await createEscalation({
                issue_description: issueDescription,
                issue_proof_url: proofUrl,
            });

            // Reset form
            setIsCreateOpen(false);
            setIssueDescription('');
            setProofUrl('');
            setUploadedFile(null);
            setErrors({});
        } catch (err) {
            // Error already handled in hook
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredEscalations = escalations.filter(e => {
        if (filterStatus === 'all') return true;
        return e.status === filterStatus;
    });

    const getStatusColor = (status: SiteVisitEscalationStatus) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'in_progress': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'escalated': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            case 'resolved': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'closed': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
            default: return 'bg-gray-500/10 text-gray-500';
        }
    };

    const getLayerLabel = (layer: string) => {
        switch (layer) {
            case 'layer_1': return 'Layer 1 (Site Team)';
            case 'layer_2': return 'Layer 2 (GM)';
            case 'layer_3': return 'Layer 3 (CEO)';
            case 'boi': return 'BOI Oversight';
            default: return layer;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Site Visit Escalations
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Raise and track issues with Site Visit teams workflow
                    </p>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 transition-all hover:scale-105">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Raise Escalation
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Raise New Escalation</DialogTitle>
                            <CardDescription>
                                Escalate an issue regarding site visits. Please provide proof.
                            </CardDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {/* Issue Description */}
                            <div className="space-y-2">
                                <Label className="flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                        Issue Description <span className="text-destructive">*</span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {issueDescription.length}/500
                                    </span>
                                </Label>
                                <Textarea
                                    placeholder="Describe the issue clearly (minimum 10 characters)..."
                                    className={`min-h-[100px] ${errors.description ? 'border-destructive' : ''}`}
                                    value={issueDescription}
                                    onChange={(e) => {
                                        setIssueDescription(e.target.value);
                                        setErrors(prev => ({ ...prev, description: undefined }));
                                    }}
                                    maxLength={500}
                                />
                                {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
                            </div>

                            {/* File Upload */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    Proof (Screenshot) <span className="text-destructive">*</span>
                                </Label>

                                {uploadedFile || proofUrl ? (
                                    <div className="border border-green-500/20 bg-green-500/10 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                <span className="text-sm font-medium">
                                                    {uploadedFile?.name || 'Proof uploaded'}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setUploadedFile(null);
                                                    setProofUrl('');
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {uploadedFile && (
                                            <img
                                                src={URL.createObjectURL(uploadedFile)}
                                                alt="Preview"
                                                className="w-full h-32 object-cover rounded border"
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div
                                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${errors.proof ? 'border-destructive bg-destructive/5' : 'border-border hover:border-primary hover:bg-primary/5'
                                                }`}
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                        >
                                            {isUploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                    <p className="text-sm text-muted-foreground">Uploading...</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Upload className="h-8 w-8 text-muted-foreground" />
                                                    <p className="text-sm font-medium">Click to upload proof</p>
                                                    <p className="text-xs text-muted-foreground">JPG, PNG, or WebP (max 5MB)</p>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            id="file-upload"
                                            type="file"
                                            className="hidden"
                                            accept="image/jpeg,image/png,image/jpg,image/webp"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleFileUpload(file);
                                            }}
                                            disabled={isUploading}
                                        />
                                        <div className="mt-2 text-center">
                                            <span className="text-xs text-muted-foreground">Or paste URL: </span>
                                            <Input
                                                placeholder="https://..."
                                                value={proofUrl}
                                                onChange={(e) => {
                                                    setProofUrl(e.target.value);
                                                    setErrors(prev => ({ ...prev, proof: undefined }));
                                                }}
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                )}
                                {errors.proof && <p className="text-xs text-destructive">{errors.proof}</p>}
                            </div>

                            {/* Submit Button */}
                            <Button
                                className="w-full bg-destructive text-white hover:bg-destructive/90"
                                onClick={handleSubmit}
                                disabled={isSubmitting || isUploading}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Raising Ticket...
                                    </>
                                ) : 'Submit Escalation'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Raised</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{escalations.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Resolution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">
                            {escalations.filter(e => ['pending', 'in_progress', 'escalated'].includes(e.status)).length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Escalated to GM/CEO</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">
                            {escalations.filter(e => ['layer_2', 'layer_3'].includes(e.current_layer) && e.status !== 'resolved').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">
                            {escalations.filter(e => e.status === 'resolved' || e.status === 'closed').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & List */}
            <Card className="border-none shadow-md">
                <CardHeader className="px-6 py-4 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">My Escalations</h3>
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[600px]">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">Loading escalations...</div>
                        ) : filteredEscalations.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center gap-3 text-muted-foreground">
                                <CheckCircle className="h-12 w-12 text-green-500/20" />
                                <p>No escalations found matching criteria</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {filteredEscalations.map((escalation) => (
                                    <div key={escalation.id} className="p-4 hover:bg-muted/50 transition-colors flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                        <div className="space-y-1 transform transition-all duration-200 hover:translate-x-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-muted-foreground">#{escalation.escalation_number}</span>
                                                <Badge variant="outline" className={getStatusColor(escalation.status)}>
                                                    {escalation.status.replace('_', ' ').toUpperCase()}
                                                </Badge>
                                                <Badge variant="secondary" className="text-xs">
                                                    {getLayerLabel(escalation.current_layer)}
                                                </Badge>
                                            </div>
                                            <p className="font-medium text-sm md:text-base line-clamp-1">{escalation.issue_description}</p>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {escalation.raised_at || escalation.created_at
                                                        ? format(new Date(escalation.raised_at || escalation.created_at), 'dd MMM yyyy, hh:mm a')
                                                        : 'N/A'}
                                                </span>
                                                {escalation.updated_at && (
                                                    <span className="flex items-center gap-1">
                                                        <Activity className="h-3 w-3" />
                                                        Updated {format(new Date(escalation.updated_at), 'dd MMM')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                                            {escalation.assigned_layer_1?.name && (
                                                <div className="text-right hidden md:block">
                                                    <p className="text-xs font-medium">Assigned To</p>
                                                    <p className="text-xs text-muted-foreground">{escalation.assigned_layer_1.name}</p>
                                                </div>
                                            )}
                                            <Button variant="outline" size="sm" onClick={() => window.open(escalation.issue_proof_url, '_blank')}>
                                                <Search className="h-3 w-3 mr-1" /> View Proof
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
