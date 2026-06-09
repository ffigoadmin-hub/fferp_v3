import { useState } from 'react';
import { Link, ExternalLink, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GoogleDriveLinkInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
  placeholder?: string;
}

export function GoogleDriveLinkInput({
  label,
  value,
  onChange,
  required = true,
  placeholder = 'Paste Google Drive link here...'
}: GoogleDriveLinkInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const isValidGoogleDriveLink = (url: string): boolean => {
    if (!url) return false;
    const patterns = [
      /drive\.google\.com/,
      /docs\.google\.com/,
      /sheets\.google\.com/,
      /slides\.google\.com/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const isValid = isValidGoogleDriveLink(value);
  const hasValue = value.trim().length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Link className="w-4 h-4" />
          {label} {required && '*'}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                <strong>Important:</strong> Set sharing to "Anyone with the link can view" for others to preview the document.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="relative">
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            'pr-10',
            hasValue && isValid && 'border-status-live focus:border-status-live',
            hasValue && !isValid && 'border-status-late focus:border-status-late'
          )}
        />
        {hasValue && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle2 className="w-4 h-4 text-status-live" />
            ) : (
              <AlertCircle className="w-4 h-4 text-status-late" />
            )}
          </div>
        )}
      </div>
      {hasValue && !isValid && (
        <p className="text-xs text-status-late flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Please enter a valid Google Drive link
        </p>
      )}
      {hasValue && isValid && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          Open link in new tab
        </a>
      )}
      <p className="text-xs text-muted-foreground leading-relaxed">
        Upload to Google Drive → Right-click → Share → Set to <span className="font-medium text-foreground">"Anyone with the link"</span> → Copy link
      </p>
    </div>
  );
}
