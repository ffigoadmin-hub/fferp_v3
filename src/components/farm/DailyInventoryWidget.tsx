import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, Plus, Minus, TrendingDown, AlertTriangle, 
  FolderKanban, Calendar
} from 'lucide-react';
import { useProjectInventory, InventoryItem } from '@/hooks/useProjectInventory';
import { useInventoryUsage } from '@/hooks/useInventoryUsage';
import { useProjects } from '@/hooks/useProjects';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DailyInventoryWidgetProps {
  projectId?: string;
}

export function DailyInventoryWidget({ projectId }: DailyInventoryWidgetProps) {
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const { items, getBalance } = useProjectInventory(selectedProjectId || undefined);
  const { logs, logUsage, isSaving, getTodayUsage } = useInventoryUsage(selectedProjectId || undefined);
  
  const [usageOpen, setUsageOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [usageQuantity, setUsageQuantity] = useState('');
  const [usagePurpose, setUsagePurpose] = useState('');

  // Only show verified inventory items
  const verifiedItems = items.filter(i => i.audit_status === 'verified');

  // Low stock items (less than 20% remaining)
  const lowStockItems = verifiedItems.filter(i => {
    const balance = getBalance(i);
    return balance > 0 && balance / i.quantity_received < 0.2;
  });

  const openUsageModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setUsageQuantity('');
    setUsagePurpose('');
    setUsageOpen(true);
  };

  const handleLogUsage = async () => {
    if (!selectedItem || !usageQuantity) {
      toast.error('Please enter quantity used');
      return;
    }

    const qty = parseFloat(usageQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const balance = getBalance(selectedItem);
    if (qty > balance) {
      toast.error(`Insufficient balance. Available: ${balance} ${selectedItem.unit}`);
      return;
    }

    const result = await logUsage({
      inventory_id: selectedItem.id,
      project_id: selectedItem.project_id,
      quantity_used: qty,
      purpose: usagePurpose || undefined,
    });

    if (result) {
      setUsageOpen(false);
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLogs = logs.filter(l => l.log_date === today);

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5" />
              Daily Inventory
            </CardTitle>
            {lowStockItems.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {lowStockItems.length} Low Stock
              </Badge>
            )}
          </div>
          
          {/* Project Filter */}
          {!projectId && (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full mt-2">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        
        <CardContent>
          {!selectedProjectId ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a project to view inventory</p>
            </div>
          ) : verifiedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No inventory items found</p>
              <p className="text-sm">Items will appear after delivery audit</p>
            </div>
          ) : (
            <>
              {/* Today's Summary */}
              {todayLogs.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Today's Usage</span>
                  </div>
                  <div className="space-y-1">
                    {todayLogs.slice(0, 3).map(log => (
                      <p key={log.id} className="text-xs text-muted-foreground">
                        • {log.inventory?.material_name}: {log.quantity_used} {log.inventory?.unit}
                        {log.purpose && ` - ${log.purpose}`}
                      </p>
                    ))}
                    {todayLogs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{todayLogs.length - 3} more entries
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Inventory Items */}
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {verifiedItems.map((item) => {
                    const balance = getBalance(item);
                    const usagePercent = ((item.quantity_used / item.quantity_received) * 100).toFixed(0);
                    const isLowStock = balance > 0 && balance / item.quantity_received < 0.2;
                    const todayUsed = getTodayUsage(item.id);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "p-4 rounded-lg border transition-colors",
                          isLowStock && "border-amber-500/50 bg-amber-500/5"
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{item.material_name}</p>
                            {item.specification && (
                              <p className="text-xs text-muted-foreground">{item.specification}</p>
                            )}
                          </div>
                          {isLowStock && (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                              Low Stock
                            </Badge>
                          )}
                        </div>

                        {/* Stock Bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Used: {item.quantity_used} {item.unit}</span>
                            <span>Balance: {balance} {item.unit}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all",
                                isLowStock ? "bg-amber-500" : "bg-primary"
                              )}
                              style={{ width: `${100 - parseFloat(usagePercent)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 text-right">
                            {usagePercent}% used
                          </p>
                        </div>

                        {/* Today's usage indicator */}
                        {todayUsed > 0 && (
                          <p className="text-xs text-muted-foreground mb-2">
                            <TrendingDown className="w-3 h-3 inline mr-1" />
                            Used today: {todayUsed} {item.unit}
                          </p>
                        )}

                        {/* Log Usage Button */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full gap-2"
                          onClick={() => openUsageModal(item)}
                          disabled={balance <= 0}
                        >
                          <Minus className="w-4 h-4" />
                          Log Usage
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {/* Usage Modal */}
      <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Material Usage</DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="font-medium">{selectedItem.material_name}</p>
                <p className="text-sm text-muted-foreground">
                  Available: {getBalance(selectedItem)} {selectedItem.unit}
                </p>
              </div>

              <div>
                <Label>Quantity Used *</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    value={usageQuantity}
                    onChange={(e) => setUsageQuantity(e.target.value)}
                    placeholder="0"
                    className="text-center text-lg"
                  />
                  <span className="text-muted-foreground">{selectedItem.unit}</span>
                </div>
              </div>

              <div>
                <Label>Purpose / Work Description</Label>
                <Textarea
                  value={usagePurpose}
                  onChange={(e) => setUsagePurpose(e.target.value)}
                  placeholder="What was this material used for?"
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUsageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogUsage} disabled={isSaving}>
              Log Usage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
