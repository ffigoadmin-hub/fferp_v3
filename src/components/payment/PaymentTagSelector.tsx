import React from 'react';
import { Check, Tags } from 'lucide-react';
import { usePaymentTags, TAG_COLORS } from '@/hooks/usePaymentTags';
import { cn } from '@/lib/utils';

interface PaymentTagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  department?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function PaymentTagSelector({
  value,
  onChange,
  department,
  placeholder = 'Select payment category...',
  disabled = false,
}: PaymentTagSelectorProps) {
  const { tags, isLoading } = usePaymentTags({ department });

  const handleSelect = (code: string) => {
    // Single selection only - toggle off if same tag, otherwise replace
    if (value.includes(code)) {
      onChange([]);
    } else {
      onChange([code]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Tags className="w-4 h-4" />
        <span>Loading categories...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Tags className="w-4 h-4" />
        <span>{value.length === 0 ? placeholder : 'Selected category:'}</span>
      </div>
      
      {/* Clickable Tag Chips */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const colorStyle = TAG_COLORS[tag.color] || TAG_COLORS.blue;
          const isSelected = value.includes(tag.code);
          
          return (
            <button
              key={tag.code}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(tag.code)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                'border-2 cursor-pointer',
                'hover:scale-105 hover:shadow-md',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
                isSelected
                  ? cn(colorStyle.bg, colorStyle.text, colorStyle.border, 'ring-2 ring-offset-1 ring-primary/30')
                  : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
              )}
            >
              {isSelected && <Check className="w-3.5 h-3.5" />}
              <span>{tag.name}</span>
            </button>
          );
        })}
      </div>
      
      {tags.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No categories available</p>
      )}
    </div>
  );
}
