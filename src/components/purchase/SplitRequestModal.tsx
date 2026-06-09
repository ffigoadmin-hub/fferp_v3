import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Split, AlertCircle } from 'lucide-react';
import { MaterialRequest } from '@/hooks/useMaterialRequests';
import { toast } from 'sonner';

interface SplitRequestModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    request: MaterialRequest | null;
    onSplit: (originalRequestId: string, itemsToMove: any[]) => Promise<void>;
    isSplitting?: boolean;
}

export function SplitRequestModal({
    open,
    onOpenChange,
    request,
    onSplit,
    isSplitting = false,
}: SplitRequestModalProps) {
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    if (!request) return null;

    const toggleItem = (itemId: string) => {
        const newSelected = new Set(selectedItemIds);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
        }
        setSelectedItemIds(newSelected);
    };

    const handleSplit = async () => {
        if (selectedItemIds.size === 0) {
            toast.error('Please select at least one item to move');
            return;
        }

        const itemsToMove = request.boq_items.filter((item: any) => selectedItemIds.has(item.id));

        try {
            await onSplit(request.id, itemsToMove);
            setSelectedItemIds(new Set());
            onOpenChange(false);
        } catch (error) {
            // Error handled in hook/parent
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95vw] max-h-[80vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b bg-muted/30">
                    <DialogTitle className="flex items-center gap-2">
                        <Split className="w-5 h-5 text-indigo-400" />
                        Split Materials
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 pb-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-200/80 leading-relaxed">
                            Select items to move to a **new material request**. This allows you to source them from a different vendor or shop.
                        </div>
                    </div>

                    <p className="text-sm font-medium text-muted-foreground mb-3">
                        Select items to move ({selectedItemIds.size} selected)
                    </p>
                </div>

                <ScrollArea className="flex-1 px-6">
                    <div className="space-y-2 pb-6">
                        {request.boq_items.map((item: any) => (
                            <div
                                key={item.id}
                                className="flex items-center space-x-3 p-3 rounded-lg bg-card border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => toggleItem(item.id)}
                            >
                                <Checkbox
                                    checked={selectedItemIds.has(item.id)}
                                    onCheckedChange={() => toggleItem(item.id)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.material_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.quantity} {item.unit}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-4 border-t bg-muted/20">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSplitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSplit}
                        disabled={isSplitting || selectedItemIds.size === 0}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Split className="w-4 h-4" />
                        {isSplitting ? 'Splitting...' : `Move ${selectedItemIds.size} Items`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
