import { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentReminderService } from '@/services/PaymentReminderService';
import { toast } from 'sonner';

interface PaymentReminderButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showText?: boolean;
}

export function PaymentReminderButton({ 
  variant = "default", 
  size = "default", 
  className = "", 
  showText = true 
}: PaymentReminderButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSendReminders = async () => {
    setIsLoading(true);
    try {
      const result = await PaymentReminderService.sendStageReminders();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error("Failed to send reminders: " + (result.error as any)?.message || "Unknown error");
      }
    } catch (error) {
      console.error("Error sending reminders:", error);
      toast.error("An unexpected error occurred while sending reminders.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleSendReminders} 
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {showText && (
        <span className="ml-2">
          {isLoading ? "Sending Reminders..." : "Send Audit Reminders"}
        </span>
      )}
    </Button>
  );
}
