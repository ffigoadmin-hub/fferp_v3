import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, Mic, Loader2, X, StopCircle, CornerUpLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ReplyingTo {
    id: string;
    content: string | null;
    sender_name: string | null;
}

interface EditingMessage {
    id: string;
    content: string;
}

interface ChatInputProps {
    conversationId: string;
    currentUserId: string;
    onSendMessage: (content?: string, type?: string, mediaUrl?: string) => void;
    onTyping: () => void;
    replyingTo?: ReplyingTo | null;
    onCancelReply?: () => void;
    editingMessage?: EditingMessage | null;
    onCancelEdit?: () => void;
    onSubmitEdit?: (id: string, newContent: string) => Promise<void>;
}

// Allowed MIME types for file uploads
const ALLOWED_FILE_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'audio/mpeg',
    'audio/wav'
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const ChatInput = ({
    conversationId,
    currentUserId,
    onSendMessage,
    onTyping,
    replyingTo,
    onCancelReply,
    editingMessage,
    onCancelEdit,
    onSubmitEdit,
}: ChatInputProps) => {
    const [newMessage, setNewMessage] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout>();
    const durationRef = useRef(0);
    const mimeTypeRef = useRef('audio/webm');
    const cancelRecordingRef = useRef(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Pre-fill textarea when entering edit mode
    useEffect(() => {
        if (editingMessage) {
            setNewMessage(editingMessage.content);
            textareaRef.current?.focus();
        } else {
            // Don't clear message when canceling edit — keep what user had
        }
    }, [editingMessage?.id]);

    // Focus textarea when reply starts
    useEffect(() => {
        if (replyingTo) {
            textareaRef.current?.focus();
        }
    }, [replyingTo?.id]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !conversationId) return;

        const messageContent = newMessage.trim();

        // Edit mode
        if (editingMessage) {
            setNewMessage("");
            onCancelEdit?.();
            await onSubmitEdit?.(editingMessage.id, messageContent);
            return;
        }

        setNewMessage(""); // Clear early for better UX

        const { error } = await supabase
            .from('chat_messages')
            .insert({
                conversation_id: conversationId,
                sender_id: currentUserId,
                content: messageContent,
                type: 'text',
                reply_to_id: replyingTo?.id ?? null,
            });

        if (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
            setNewMessage(messageContent); // Restore on error
        } else {
            onSendMessage(messageContent, 'text');
            onCancelReply?.();
        }
    };

    const generateSecureFileName = (extension: string) => {
        // Use crypto for secure random bytes
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        const randomHex = Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return `${randomHex}.${extension}`;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !conversationId) return;

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            toast.error("File size must be less than 10MB");
            return;
        }

        // Validate file type
        if (!ALLOWED_FILE_TYPES.has(file.type)) {
            toast.error(`File type not allowed: ${file.type}`);
            return;
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
            // Ensure extension matches mime type (basic validation)
            if (file.type && !file.type.includes(fileExt)) {
                console.warn('Extension mismatch with mime type, using mime-inferred extension');
            }

            const secureFileName = generateSecureFileName(fileExt);
            const filePath = `${conversationId}/${secureFileName}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file, { contentType: file.type });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            const type = file.type.startsWith('image/') ? 'image' : 'file';

            const { error: dbError } = await supabase
                .from('chat_messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: currentUserId,
                    content: file.name,
                    type: type,
                    media_url: publicUrl,
                    metadata: { size: file.size, mime_type: file.type }
                });

            if (dbError) throw dbError;
            onSendMessage(file.name, type, publicUrl);

        } catch (error) {
            console.error('Error uploading file:', error);
            toast.error('Failed to upload file');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const startRecording = async () => {
        try {
            cancelRecordingRef.current = false; // Reset cancel flag
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Negotiate best supported MIME type
            const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
            const supportedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
            mimeTypeRef.current = supportedMime || 'audio/webm';

            const mediaRecorder = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : undefined);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];
            durationRef.current = 0;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Check if recording was cancelled
                if (cancelRecordingRef.current) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                const blobType = mimeTypeRef.current.split(';')[0] || 'audio/webm';
                const audioBlob = new Blob(chunksRef.current, { type: blobType });
                if (audioBlob.size > 0) {
                    await uploadAudio(audioBlob, durationRef.current, blobType);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(250); // collect data every 250ms for reliability
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                durationRef.current += 1;
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            toast.error('Could not access microphone');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            cancelRecordingRef.current = false;
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            cancelRecordingRef.current = true; // Set flag to skip upload
            mediaRecorderRef.current.stop();
            // Clean up stream tracks immediately
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            setRecordingTime(0);
        }
    };

    const uploadAudio = async (blob: Blob, duration: number, mimeType: string) => {
        setIsUploading(true);
        try {
            // Determine extension from MIME
            const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
            const fileName = `${conversationId}/${Date.now()}_voice.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(fileName, blob, { contentType: mimeType });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(fileName);

            const { error: dbError } = await supabase
                .from('chat_messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: currentUserId,
                    content: 'Voice Message',
                    type: 'audio',
                    media_url: publicUrl,
                    metadata: { duration, mime_type: mimeType }
                });

            if (dbError) throw dbError;
            onSendMessage('Voice Message', 'audio', publicUrl);

        } catch (error) {
            console.error('Error uploading audio:', error);
            toast.error('Failed to send voice message');
        } finally {
            setIsUploading(false);
            setRecordingTime(0);
            durationRef.current = 0;
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={cn(
            "bg-muted/30 border border-border/50 rounded-xl shadow-sm transition-all focus-within:shadow-md focus-within:border-primary/30",
            (replyingTo || editingMessage) ? "overflow-hidden" : "p-3"
        )}>
            {/* Reply preview bar */}
            {replyingTo && !editingMessage && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-primary/5">
                    <CornerUpLeft className="w-3 h-3 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-primary block">{replyingTo.sender_name}</span>
                        <p className="text-xs text-muted-foreground truncate">{replyingTo.content}</p>
                    </div>
                    <button
                        onClick={onCancelReply}
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Edit mode bar */}
            {editingMessage && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-amber-500/5">
                    <Pencil className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-amber-500 flex-1">Editing message</span>
                    <button
                        onClick={() => { onCancelEdit?.(); setNewMessage(""); }}
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className={cn((replyingTo || editingMessage) ? "p-3" : "")}>
                {isRecording ? (
                    <div className="flex items-center gap-4 max-w-4xl mx-auto p-1 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded-full">
                            <StopCircle className="w-4 h-4 animate-pulse" />
                            <span className="text-xs font-bold font-mono tracking-wider">{formatTime(recordingTime)}</span>
                        </div>
                        <div className="flex-1 text-xs font-medium text-muted-foreground">
                            Recording voice message...
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelRecording}
                            className="text-xs font-bold hover:text-destructive transition-colors"
                        >
                            Discard
                        </Button>
                        <Button
                            size="icon"
                            onClick={stopRecording}
                            className="rounded-lg bg-primary hover:bg-primary/90 w-9 h-9 shadow-lg shadow-primary/20"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-5xl mx-auto min-h-[44px]">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileUpload}
                        />

                        <div className="flex items-center pb-0.5">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading || !!editingMessage}
                            >
                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                            </Button>
                        </div>

                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                onTyping();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                                if (e.key === 'Escape') {
                                    if (editingMessage) { onCancelEdit?.(); setNewMessage(""); }
                                    else if (replyingTo) { onCancelReply?.(); }
                                }
                            }}
                            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                            className="flex-1 bg-transparent border-0 focus:ring-0 resize-none py-2.5 text-sm font-medium placeholder:text-muted-foreground/50 max-h-[120px] scrollbar-none outline-none"
                            disabled={isUploading}
                            rows={1}
                        />

                        <div className="flex items-center gap-1 pb-0.5">
                            {!newMessage.trim() && !editingMessage && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                    onClick={startRecording}
                                >
                                    <Mic className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!newMessage.trim() || isUploading}
                                className={cn(
                                    "h-9 w-9 rounded-lg transition-all shadow-md",
                                    newMessage.trim()
                                        ? editingMessage
                                            ? "bg-amber-500 text-white shadow-amber-500/20"
                                            : "bg-primary text-primary-foreground shadow-primary/20"
                                        : "bg-muted text-muted-foreground shadow-none cursor-not-allowed"
                                )}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
