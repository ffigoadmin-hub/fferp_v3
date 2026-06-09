import { Check, Clock, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ApprovalStep {
  role: string;
  label: string;
  approved_at?: string | null;
  approved_by_name?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'current';
}

interface ApprovalChainDisplayProps {
  steps: ApprovalStep[];
  className?: string;
}

export function ApprovalChainDisplay({ steps, className }: ApprovalChainDisplayProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <div key={step.role} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
                step.status === 'approved' && "bg-green-500/20 text-green-400",
                step.status === 'rejected' && "bg-red-500/20 text-red-400",
                step.status === 'current' && "bg-primary/20 text-primary ring-1 ring-primary",
                step.status === 'pending' && "bg-muted text-muted-foreground"
              )}
            >
              {step.status === 'approved' && <Check className="w-4 h-4" />}
              {step.status === 'rejected' && <X className="w-4 h-4" />}
              {step.status === 'current' && <Clock className="w-4 h-4 animate-pulse" />}
              {step.status === 'pending' && <User className="w-4 h-4" />}

              <div>
                <span className="font-medium">{step.label}</span>
                {step.approved_at && (
                  <span className="text-xs ml-1">
                    ({format(new Date(step.approved_at), 'dd/MM')})
                  </span>
                )}
              </div>
            </div>

            {!isLast && (
              <div className={cn(
                "w-4 h-0.5",
                step.status === 'approved' ? "bg-green-500" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function getMaterialApprovalSteps(request: any): ApprovalStep[] {
  const steps: ApprovalStep[] = [
    {
      role: 'gm',
      label: 'GM Approval',
      approved_at: request.gm_approved_at,
      status: request.gm_approved_at ? 'approved' :
        request.approval_status === 'pending_gm' ? 'current' : 'pending',
    },
    {
      role: 'admin',
      label: 'Admin',
      approved_at: request.admin_approved_at,
      status: request.admin_approved_at ? 'approved' :
        request.approval_status === 'pending_admin' ? 'current' :
          request.gm_approved_at && !request.admin_approved_at ? 'current' : 'pending',
    },
    {
      role: 'ceo',
      label: 'CEO',
      approved_at: request.ceo_approved_at,
      status: request.ceo_approved_at ? 'approved' :
        request.approval_status === 'pending_ceo' ? 'current' :
          request.admin_approved_at && !request.ceo_approved_at ? 'current' : 'pending',
    },
    {
      role: 'payment',
      label: 'Payment',
      approved_at: request.linked_payment_id ? request.ceo_approved_at : null,
      status: request.linked_payment_id ? 'approved' :
        request.ceo_approved_at && !request.linked_payment_id ? 'current' : 'pending',
    },
    {
      role: 'delivery',
      label: 'Delivery',
      approved_at: request.actual_delivery_date,
      status: request.delivery_status === 'delivered' ? 'approved' :
        request.linked_payment_id && request.delivery_status !== 'delivered' ? 'current' : 'pending',
    },
  ];

  return steps;
}

export function getWorkOrderApprovalSteps(request: any): ApprovalStep[] {
  const steps: ApprovalStep[] = [
    {
      role: 'smo',
      label: 'SMO',
      approved_at: request.smo_approved_at,
      status: request.smo_approved_at ? 'approved' :
        request.wo_approval_status === 'pending' ? 'current' : 'pending',
    },
    {
      role: 'gmo',
      label: 'GMO',
      approved_at: request.gmo_approved_at,
      status: request.gmo_approved_at ? 'approved' :
        request.smo_approved_at && !request.gmo_approved_at ? 'current' : 'pending',
    },
    {
      role: 'gm',
      label: 'GM Approval',
      approved_at: request.gm_verified_at,
      status: request.gm_verified_at ? 'approved' :
        request.gmo_approved_at && !request.gm_verified_at ? 'current' : 'pending',
    },
    {
      role: 'admin',
      label: 'Admin',
      approved_at: request.admin_approved_at,
      status: request.admin_approved_at ? 'approved' :
        request.gm_verified_at && !request.admin_approved_at ? 'current' : 'pending',
    },
    {
      role: 'ceo',
      label: 'CEO',
      approved_at: request.ceo_approved_at,
      status: request.ceo_approved_at ? 'approved' :
        request.admin_approved_at && !request.ceo_approved_at ? 'current' : 'pending',
    },
  ];

  return steps;
}
