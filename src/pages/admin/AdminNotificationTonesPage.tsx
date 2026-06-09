import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Volume2, Upload, Play, Trash2, Check, Loader2, Music, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { playAlert, playSynthesizedTone, generateSystemToneBlob, AlertType } from '@/lib/alertSounds';

interface NotificationSetting {
    id: string;
    category: string;
    audio_url: string | null;
    is_enabled: boolean;
    updated_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    danger: 'Urgent Danger (Red Alarms)',
    escalation: 'Client Escalations',
    announcement: 'Global Announcements',
    task: 'Task Assignments',
    lop: 'Loss of Pay Alerts',
    sla_breach: 'SLA Deadline Breach',
    slot_opening: 'Report Slot Opening',
    payment: 'Payment Updates',
    ceo: 'CEO Approval Alerts (Premium)',
    director: 'Director Verification Alerts',
    gm: 'General Manager (GM) Alerts',
    boi: 'Business Operations (BOI) Alerts',
    chat_message: 'New Chat Messages',
    morning_selfie: 'Morning Selfie Reminder (10:10 AM)',
    lunch_selfie: 'Lunch Selfie Reminder (2:40 PM)',
    evening_selfie: 'Evening Selfie Reminder (5:40 PM)',
};

export default function AdminNotificationTonesPage() {
    const [settings, setSettings] = useState<NotificationSetting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('notification_settings')
                .select('*')
                .order('category');

            if (error) throw error;
            setSettings(data || []);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            const { error } = await (supabase
                .from('notification_settings') as any)
                .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            setSettings(settings.map(s => s.id === id ? { ...s, is_enabled: enabled } : s));
        } catch (error: any) {
            toast({
                title: 'Update Failed',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleFileUpload = async (id: string, category: string, file: File) => {
        if (!file.type.startsWith('audio/')) {
            toast({
                title: 'Invalid File',
                description: 'Please upload an audio file (MP3, WAV, etc.)',
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(category);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${category}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('notification-tones')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('notification-tones')
                .getPublicUrl(filePath);

            console.log('File uploaded, public URL:', urlData.publicUrl);

            const { error: updateError } = await (supabase
                .from('notification_settings') as any)
                .update({
                    audio_url: urlData.publicUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateError) throw updateError;

            toast({
                title: 'Success',
                description: `Custom tone "${file.name}" uploaded for ${category}!`,
            });
            await fetchSettings();
        } catch (error: any) {
            console.error('Upload flow error:', error);
            toast({
                title: 'Upload Failed',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsUploading(null);
        }
    };

    const handleDelete = async (category: string, id: string) => {
        try {
            const { error } = await (supabase
                .from('notification_settings') as any)
                .update({ audio_url: null, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            toast({
                title: 'Reset Successful',
                description: `Sound for ${category} reset to default system beep.`,
            });
            fetchSettings();
        } catch (error: any) {
            toast({
                title: 'Reset Failed',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleDownload = async (url: string, filename: string) => {
        try {
            // Extract the file path from the public URL
            // Expected format: .../notification-tones/<filename>
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const storagePath = decodeURIComponent(pathParts[pathParts.length - 1]);

            console.log('Attempting download from Supabase Storage:', storagePath);

            const { data, error } = await supabase.storage
                .from('notification-tones')
                .download(storagePath);

            if (error) {
                console.error('Supabase download error:', error);
                throw error;
            }

            if (!data) {
                throw new Error('No data received from download');
            }

            const blobUrl = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || storagePath;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            toast({
                title: 'Download Started',
                description: `Downloading ${filename}...`,
            });
        } catch (error: any) {
            console.error('Download logic failed:', error);

            // Fallback: Try direct window open if SDK fails (e.g. if path parsing was wrong)
            console.log('Falling back to direct URL open');
            window.open(url, '_blank');

            toast({
                title: 'Download Method Changed',
                description: 'Direct download failed. Opening file in new tab instead.',
                variant: 'default', // Not destructive as we have a fallback
            });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Notification Sounds</h1>
                <p className="text-muted-foreground">
                    Customize high-priority alert tones for different system categories.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Volume2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Audio Assets Management</CardTitle>
                            <CardDescription>
                                Upload .mp3 or .wav files to override default system synthesized sounds.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Custom Tone</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {settings.map((setting) => (
                                    <TableRow key={setting.id}>
                                        <TableCell className="font-medium">
                                            {CATEGORY_LABELS[setting.category] || setting.category}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={setting.is_enabled}
                                                    onCheckedChange={(val) => handleToggle(setting.id, val)}
                                                />
                                                <Badge variant={setting.is_enabled ? 'default' : 'secondary'}>
                                                    {setting.is_enabled ? 'Enabled' : 'Muted'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {setting.audio_url ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                                                            <Music className="w-3 h-3" />
                                                            Custom Active
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={decodeURIComponent(setting.audio_url.split('/').pop() || '')}>
                                                            {decodeURIComponent(setting.audio_url.split('/').pop() || '').split('-').slice(1).join('-') || 'Custom File'}
                                                        </span>
                                                    </div>
                                                    <audio controls src={setting.audio_url} className="h-8 w-full max-w-[200px]" />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="gap-1">
                                                        System Default
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => playSynthesizedTone(setting.category as AlertType)}
                                                        title="Preview System Tone"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant={setting.audio_url ? "secondary" : "default"}
                                                    size="sm"
                                                    className="relative overflow-hidden"
                                                    disabled={isUploading === setting.category}
                                                >
                                                    {isUploading === setting.category ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Upload className="w-4 h-4 mr-2" />
                                                    )}
                                                    {isUploading === setting.category ? 'Uploading...' : (setting.audio_url ? 'Change' : 'Upload')}
                                                    <input
                                                        type="file"
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        accept="audio/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFileUpload(setting.id, setting.category, file);
                                                        }}
                                                    />
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                        if (setting.audio_url) {
                                                            // Download custom uploaded file
                                                            handleDownload(setting.audio_url, `${setting.category}-tone.mp3`);
                                                        } else {
                                                            // Generate and download system synthesized tone
                                                            try {
                                                                const blob = await generateSystemToneBlob(setting.category as AlertType);
                                                                const blobUrl = window.URL.createObjectURL(blob);
                                                                const link = document.createElement('a');
                                                                link.href = blobUrl;
                                                                link.download = `${setting.category}-system-default.wav`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                window.URL.revokeObjectURL(blobUrl);
                                                                toast({
                                                                    title: 'System Tone Downloaded',
                                                                    description: 'The synthesized system tone has been generated and saved.',
                                                                });
                                                            } catch (err) {
                                                                console.error('Failed to generate tone:', err);
                                                                toast({
                                                                    title: 'Generation Failed',
                                                                    description: 'Could not generate system tone file.',
                                                                    variant: 'destructive',
                                                                });
                                                            }
                                                        }
                                                    }}
                                                    title={setting.audio_url ? "Download Custom Tone" : "Download System Default Tone"}
                                                    className={!setting.audio_url ? 'text-primary border-primary/20' : 'text-primary border-primary/20'}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>

                                                {setting.audio_url && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(setting.category, setting.id)}
                                                        title="Reset to Default"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
