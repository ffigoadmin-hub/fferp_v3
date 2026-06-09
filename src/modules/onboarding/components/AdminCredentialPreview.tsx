/**
 * AdminCredentialPreview Component
 * 
 * Displays generated username and password for admin review before sending
 */

import { Copy, CheckCircle, User, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface AdminCredentialPreviewProps {
  username: string;
  password: string;
  fullName: string;
  onRegenerate?: () => void;
}

export function AdminCredentialPreview({
  username,
  password,
  fullName,
  onRegenerate,
}: AdminCredentialPreviewProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-foreground">Generated Credentials for {fullName}</h4>
        {onRegenerate && (
          <Button variant="ghost" size="sm" onClick={onRegenerate} className="h-8 px-2 text-foreground hover:bg-muted">
            <RefreshCw className="w-4 h-4 mr-1" />
            Regenerate
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {/* Username */}
        <div className="flex items-center gap-3 bg-card rounded-md p-3 border border-border">
          <User className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Username</p>
            <p className="font-mono text-sm truncate text-foreground">{username}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(username, 'username')}
            className="h-8 px-2 text-foreground hover:bg-muted"
          >
            {copiedField === 'username' ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Password */}
        <div className="flex items-center gap-3 bg-card rounded-md p-3 border border-border">
          <Lock className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Temporary Password</p>
            <p className="font-mono text-sm truncate text-foreground">{password}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(password, 'password')}
            className="h-8 px-2 text-foreground hover:bg-muted"
          >
            {copiedField === 'password' ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        These credentials will be sent to {fullName} at their email address.
        They will be required to change their password after first login.
      </p>
    </div>
  );
}
