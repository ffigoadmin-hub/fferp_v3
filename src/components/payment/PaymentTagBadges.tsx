 import React from 'react';
 import { Badge } from '@/components/ui/badge';
 import { usePaymentTags, TAG_COLORS, PaymentTag } from '@/hooks/usePaymentTags';
 import { cn } from '@/lib/utils';
 import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
 } from '@/components/ui/tooltip';
 
 interface PaymentTagBadgesProps {
   tags: string[];
   size?: 'sm' | 'md';
   maxDisplay?: number;
   className?: string;
 }
 
 export function PaymentTagBadges({ 
   tags, 
   size = 'sm', 
   maxDisplay = 3,
   className 
 }: PaymentTagBadgesProps) {
   const { tags: allTags, isLoading } = usePaymentTags();
 
   if (isLoading || !tags || tags.length === 0) {
     return null;
   }
 
   // Map tag codes to full tag objects
   const tagObjects = tags
     .map(code => allTags.find(t => t.code === code))
     .filter(Boolean) as PaymentTag[];
 
   if (tagObjects.length === 0) {
     return null;
   }
 
   const displayTags = tagObjects.slice(0, maxDisplay);
   const remainingCount = tagObjects.length - maxDisplay;
   const remainingTags = tagObjects.slice(maxDisplay);
 
   const sizeClasses = size === 'sm' 
     ? 'text-[10px] px-1.5 py-0.5 h-5' 
     : 'text-xs px-2 py-0.5 h-6';
 
   return (
     <div className={cn('flex flex-wrap items-center gap-1', className)}>
       {displayTags.map((tag) => {
         const colorStyle = TAG_COLORS[tag.color] || TAG_COLORS.blue;
         return (
           <Badge
             key={tag.code}
             variant="outline"
             className={cn(
               sizeClasses,
               colorStyle.bg,
               colorStyle.text,
               colorStyle.border,
               'font-medium border'
             )}
           >
             {tag.name}
           </Badge>
         );
       })}
       
       {remainingCount > 0 && (
         <TooltipProvider>
           <Tooltip>
             <TooltipTrigger asChild>
               <Badge
                 variant="outline"
                 className={cn(
                   sizeClasses,
                   'bg-muted text-muted-foreground border-border cursor-help'
                 )}
               >
                 +{remainingCount} more
               </Badge>
             </TooltipTrigger>
             <TooltipContent>
               <div className="flex flex-col gap-1">
                 {remainingTags.map(tag => (
                   <span key={tag.code}>{tag.name}</span>
                 ))}
               </div>
             </TooltipContent>
           </Tooltip>
         </TooltipProvider>
       )}
     </div>
   );
 }
