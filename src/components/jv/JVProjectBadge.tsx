import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Handshake } from 'lucide-react';

interface JVProjectBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

/**
 * Premium JV (Joint Venture) badge with amber gradient styling.
 * Used on projects and payments that belong to the JV Engineering department.
 */
export function JVProjectBadge({ className, size = 'sm', showIcon = true }: JVProjectBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <Badge
      className={cn(
        'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30',
        'hover:from-amber-500/30 hover:to-yellow-500/30',
        'shadow-sm shadow-amber-500/10 font-bold uppercase tracking-wider',
        'transition-all duration-300',
        sizeClasses[size],
        className
      )}
      variant="outline"
    >
      {showIcon && <Handshake className={cn(
        size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4'
      )} />}
      JV
    </Badge>
  );
}

/**
 * Inline JV Payment indicator for audit lists.
 * Shows a yellow-highlighted "JV PAYMENT" tag.
 */
export function JVPaymentTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'bg-amber-500/15 text-amber-400 border border-amber-500/25',
        'text-[10px] font-bold uppercase tracking-widest',
        'animate-in fade-in duration-500',
        className
      )}
    >
      <Handshake className="w-3 h-3" />
      JV Payment
    </span>
  );
}
