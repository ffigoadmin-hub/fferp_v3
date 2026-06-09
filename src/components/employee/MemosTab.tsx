import { useState } from 'react';
import { FileText, Plus, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { issueMemo, acknowledgeMemo } from '@/services/employeeMemosService';
import type { MemoSeverity, MemoType, RecognitionType, ViolationType } from '@/services/employeeMemosService';

interface MemosTabProps {
  memos: any[];
  userId: string;
  isAdmin: boolean;
}

export function MemosTab({ memos, userId, isAdmin }: MemosTabProps) {
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [memoForm, setMemoForm] = useState({
    memo_type: 'appreciation',
    memo_title: '',
    memo_description: '',
    severity: 'low',
    violation_type: '',
    recognition_type: '',
    action_taken: '',
    attachment_urls: [] as string[],
  });

  const handleIssueMemo = async () => {
    try {
      await issueMemo({
        employee_id: userId,
        ...memoForm,
        memo_type: memoForm.memo_type as MemoType,
        severity: memoForm.severity as MemoSeverity,
        violation_type: (memoForm.violation_type || null) as ViolationType | null,
        recognition_type: (memoForm.recognition_type || null) as RecognitionType | null,
        action_taken: memoForm.action_taken || null,
        memo_date: new Date().toISOString().split('T')[0],
        issued_by: userId,
      });
      setShowMemoModal(false);
      toast.success('Memo issued successfully');
      // Reset form
      setMemoForm({
        memo_type: 'appreciation',
        memo_title: '',
        memo_description: '',
        severity: 'low',
        violation_type: '',
        recognition_type: '',
        action_taken: '',
        attachment_urls: [],
      });
    } catch (error) {
      console.error('Error issuing memo:', error);
      toast.error('Failed to issue memo');
    }
  };

  const handleAcknowledgeMemo = async (memoId: string) => {
    try {
      await acknowledgeMemo(memoId);
      toast.success('Memo acknowledged');
    } catch (error) {
      console.error('Error acknowledging memo:', error);
      toast.error('Failed to acknowledge memo');
    }
  };

  const getMemoIcon = (type: string, severity?: string) => {
    if (type === 'warning') {
      switch (severity) {
        case 'critical':
          return <X className="w-4 h-4 text-red-600" />;
        case 'high':
          return <AlertTriangle className="w-4 h-4 text-orange-600" />;
        case 'medium':
          return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
        default:
          return <AlertTriangle className="w-4 h-4 text-blue-600" />;
      }
    }
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  const getMemoBadgeVariant = (type: string, severity?: string) => {
    if (type === 'warning') {
      switch (severity) {
        case 'critical':
          return 'destructive';
        case 'high':
          return 'destructive';
        case 'medium':
          return 'secondary';
        default:
          return 'outline';
      }
    }
    return 'default';
  };

  return (
    <div className="space-y-6">
      {/* Memos List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Memos
          </CardTitle>
          <CardDescription>Warnings, appreciations, and other communications</CardDescription>
        </CardHeader>
        <CardContent>
          {memos.length > 0 ? (
            <div className="space-y-4">
              {memos.map((memo: any) => (
                <div key={memo.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getMemoIcon(memo.memo_type, memo.severity)}
                        <Badge variant={getMemoBadgeVariant(memo.memo_type, memo.severity)}>
                          {memo.memo_type}
                        </Badge>
                        {memo.memo_type === 'warning' && (
                          <Badge variant="outline">{memo.severity}</Badge>
                        )}
                        {memo.acknowledged_at ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Acknowledged
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending Acknowledgment
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium">{memo.memo_title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {memo.memo_description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{new Date(memo.memo_date).toLocaleDateString()}</span>
                        {memo.memo_type === 'warning' && memo.violation_type && (
                          <span>Violation: {memo.violation_type}</span>
                        )}
                        {memo.memo_type === 'appreciation' && memo.recognition_type && (
                          <span>Recognition: {memo.recognition_type}</span>
                        )}
                      </div>
                      {memo.attachment_urls && memo.attachment_urls.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Attachments:</p>
                          <div className="flex flex-wrap gap-1">
                            {memo.attachment_urls.map((url: string, index: number) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Attachment {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {!memo.acknowledged_at && !isAdmin && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            onClick={() => handleAcknowledgeMemo(memo.id)}
                            className="text-xs"
                          >
                            Acknowledge Memo
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No memos available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}