import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VendorDatabaseWidget } from './VendorDatabaseWidget';
import { VendorMaster } from '@/hooks/useVendorMaster';

interface VendorSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectVendor: (vendor: VendorMaster) => void;
  filterWorkType?: string;
}

export function VendorSearchModal({ open, onOpenChange, onSelectVendor, filterWorkType }: VendorSearchModalProps) {
  const handleSelect = (vendor: VendorMaster) => {
    onSelectVendor(vendor);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select Vendor from Database</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
          <VendorDatabaseWidget
            onSelectVendor={handleSelect}
            selectionMode={true}
            filterWorkType={filterWorkType}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
