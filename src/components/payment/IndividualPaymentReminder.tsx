import { useState } from 'react';
import { Bell, Loader2, Send, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentReminderService } from '@/services/PaymentReminderService';
import { toast } from 'sonner';
import { PaymentStatus } from '@/hooks/usePaymentRequests';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface IndividualPaymentReminderProps {
  payment: {
    id: string;
    status: string;
    purpose: string;
    amount: number;
    urgency: string;
    payment_number?: string | number;
  };
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showText?: boolean;
}

export function IndividualPaymentReminder({ 
  payment,
  variant = "ghost", 
  size = "sm", 
  className = "", 
  showText = true 
}: IndividualPaymentReminderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [note, setNote] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Define which statuses can be reminded
  const remindableStatuses = [
    'smo_audit',
    'gmo_audit',
    'auditor_audit',
    'boi_audit',
    'director_audit',
    'gm_audit',
    'hr_audit',
    'admin_audit',
    'ceo_audit',
    'ceo_hold',
    'gm_hold'
  ];

  const canRemind = remindableStatuses.includes(payment.status.toLowerCase());

  if (!canRemind) return null;

  const handleSendReminder = async () => {
    setIsLoading(true);
    try {
      const result = await PaymentReminderService.sendIndividualReminder(
        payment as any,
        note
      );
      if (result.success) {
        toast.success(result.message);
        setIsOpen(false);
        setNote('');
      } else {
        toast.error(result.message || "Failed to send reminder.");
      }
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          className={className}
          title="Send Reminder to current auditor"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          {showText && (
            <span className="ml-1.5 font-medium">
              {isLoading ? "Sending..." : "Remind Auditor"}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Add a note to your reminder
            </h4>
            <p className="text-[11px] text-muted-foreground leading-snug">
              This will be sent directly to the current auditor of this payment.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminder-note" className="text-xs">Your Note (Optional)</Label>
            <Textarea 
              id="reminder-note"
              placeholder="e.g., This is urgent for project delivery. Please review."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[80px] text-xs resize-none"
            />
          </div>
          <Button 
            className="w-full h-9 bg-primary hover:bg-primary/90 transition-all text-xs" 
            onClick={handleSendReminder}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-2" />
            )}
            Send Reminder Notification
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
