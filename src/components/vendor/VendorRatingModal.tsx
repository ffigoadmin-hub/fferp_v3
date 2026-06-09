import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star, Building2, Package, Truck, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVendorRatings, CreateVendorRatingData } from '@/hooks/useVendorRatings';

interface VendorRatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
  projectId?: string;
  projectName?: string;
  workRequestId?: string;
  materialRequestId?: string;
  onSuccess?: () => void;
}

const RatingStars = ({
  value,
  onChange,
  label,
  icon: Icon
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  icon: React.ElementType;
}) => {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {label}
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-1 rounded-md hover:bg-muted transition-colors"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(0)}
          >
            <Star
              className={cn(
                "w-6 h-6 transition-colors",
                (hoverValue || value) >= star
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/30"
              )}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">
            {value}/5
          </span>
        )}
      </div>
    </div>
  );
};

export function VendorRatingModal({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  projectId,
  projectName,
  workRequestId,
  materialRequestId,
  onSuccess
}: VendorRatingModalProps) {
  const { addRating, isSaving } = useVendorRatings();
  
  const [qualityRating, setQualityRating] = useState(0);
  const [timelinessRating, setTimelinessRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const handleSubmit = async () => {
    if (qualityRating === 0 && timelinessRating === 0 && communicationRating === 0) {
      return;
    }

    const data: CreateVendorRatingData = {
      vendor_id: vendorId,
      project_id: projectId,
      work_request_id: workRequestId,
      material_request_id: materialRequestId,
      quality_rating: qualityRating > 0 ? qualityRating : undefined,
      timeliness_rating: timelinessRating > 0 ? timelinessRating : undefined,
      communication_rating: communicationRating > 0 ? communicationRating : undefined,
      review_text: reviewText || undefined
    };

    const result = await addRating(data);
    if (result) {
      // Reset form
      setQualityRating(0);
      setTimelinessRating(0);
      setCommunicationRating(0);
      setReviewText('');
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const averageRating = [qualityRating, timelinessRating, communicationRating]
    .filter(r => r > 0)
    .reduce((sum, r, _, arr) => sum + r / arr.length, 0);

  const isValid = qualityRating > 0 || timelinessRating > 0 || communicationRating > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Rate Vendor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vendor Info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{vendorName}</p>
              {projectName && (
                <p className="text-sm text-muted-foreground">Project: {projectName}</p>
              )}
            </div>
          </div>

          {/* Rating Categories */}
          <div className="space-y-5">
            <RatingStars
              value={qualityRating}
              onChange={setQualityRating}
              label="Quality of Work/Products"
              icon={Package}
            />
            <RatingStars
              value={timelinessRating}
              onChange={setTimelinessRating}
              label="Timeliness & Delivery"
              icon={Truck}
            />
            <RatingStars
              value={communicationRating}
              onChange={setCommunicationRating}
              label="Communication & Support"
              icon={MessageSquare}
            />
          </div>

          {/* Overall Rating Display */}
          {averageRating > 0 && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
              <span className="font-semibold">
                Overall: {averageRating.toFixed(1)}/5
              </span>
            </div>
          )}

          {/* Review Text */}
          <div className="space-y-2">
            <Label>Additional Comments (Optional)</Label>
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this vendor..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
            {isSaving ? 'Saving...' : 'Submit Rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
