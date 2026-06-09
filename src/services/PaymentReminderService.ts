import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from './NotificationService';
import { PaymentStatus } from '@/hooks/usePaymentRequests';

export const PaymentReminderService = {
    /**
     * Sends reminders to all auditor roles for pending payments in their queue.
     */
    async sendStageReminders() {
        try {
            // 1. Fetch all pending payment requests that are in an audit stage
            const auditStages: PaymentStatus[] = [
                'smo_audit',
                'gmo_audit',
                'auditor_audit',
                'boi_audit',
                'director_audit',
                'gm_audit',
                'hr_audit',
                'admin_audit',
                'ceo_audit'
            ];

            const { data: pendingPayments, error } = await supabase
                .from('payment_requests')
                .select('id, status, amount, vendor_name, urgency')
                .in('status', auditStages);

            if (error) throw error;
            if (!pendingPayments || pendingPayments.length === 0) {
                return { success: true, message: 'No pending payments found in audit stages.' };
            }

            // 2. Group by status
            const groupedByStatus: Record<string, any[]> = {};
            pendingPayments.forEach(payment => {
                if (!groupedByStatus[payment.status]) {
                    groupedByStatus[payment.status] = [];
                }
                groupedByStatus[payment.status].push(payment);
            });

            // 3. Map status to Role (Based on paymentWorkflow.ts logic)
            const statusToRoleMap: Record<string, string> = {
                'smo_audit': 'smo',
                'gmo_audit': 'gmo',
                'auditor_audit': 'auditor',
                'boi_audit': 'boi',
                'director_audit': 'director',
                'gm_audit': 'gm',
                'hr_audit': 'hr',
                'admin_audit': 'admin',
                'ceo_audit': 'ceo'
            };

            // 4. Send notifications for each stage
            let totalRemindersSent = 0;
            for (const status of Object.keys(groupedByStatus)) {
                const role = statusToRoleMap[status];
                if (!role) continue;

                const count = groupedByStatus[status].length;
                const totalAmount = groupedByStatus[status].reduce((sum, p) => sum + (p.amount || 0), 0);
                const emergencyCount = groupedByStatus[status].filter(p => p.urgency === 'emergency').length;

                const title = `🚨 Pending Payment Audit Reminder: ${status.replace('_', ' ').toUpperCase()}`;
                let message = `You have ${count} payment requests pending in your queue totaling ₹${totalAmount.toLocaleString('en-IN')}.`;
                
                if (emergencyCount > 0) {
                    message += ` ${emergencyCount} of these are marked as EMERGENCY. Please review them immediately.`;
                } else {
                    message += ` Please review and take action at your earliest convenience.`;
                }

                await NotificationService.notifyRole(
                    role,
                    title,
                    message,
                    undefined, // No specific record ID as it's a summary
                    'payment_reminder'
                );
                totalRemindersSent++;
            }

            return { 
                success: true, 
                message: `Reminders sent to ${totalRemindersSent} auditor roles for ${pendingPayments.length} pending payments.` 
            };

        } catch (error) {
            console.error('Error in PaymentReminderService.sendStageReminders:', error);
            return { success: false, error };
        }
    },

    /**
     * Sends a reminder for a specific payment request to the current auditor.
     */
    async sendIndividualReminder(payment: {
        id: string;
        status: PaymentStatus;
        purpose: string;
        amount: number;
        urgency: string;
        payment_number?: string | number;
    }, note?: string) {
        try {
            const statusToRoleMap: Record<string, string> = {
                'smo_audit': 'smo',
                'gmo_audit': 'gmo',
                'auditor_audit': 'auditor',
                'boi_audit': 'boi',
                'director_audit': 'director',
                'gm_audit': 'gm',
                'hr_audit': 'hr',
                'admin_audit': 'admin',
                'ceo_audit': 'ceo',
                'ceo_hold': 'ceo',
                'gm_hold': 'gm'
            };

            const role = statusToRoleMap[payment.status];
            if (!role) {
                return { success: false, message: `No auditor role mapped for status: ${payment.status}` };
            }

            const paymentRef = payment.payment_number ? `PAY-${String(payment.payment_number).padStart(3, '0')}` : `#${payment.id.slice(0, 8).toUpperCase()}`;
            const title = `🔔 REMINDER: Payment Audit Pending (${paymentRef})`;
            
            let message = `Reminder for payment: "${payment.purpose}" for ₹${payment.amount.toLocaleString('en-IN')}. Current status: ${payment.status.replace('_', ' ').toUpperCase()}.`;
            
            if (payment.urgency === 'emergency') {
                message = `🚨 EMERGENCY REMINDER: ${message} This is marked as EMERGENCY priority.`;
            }

            if (note && note.trim()) {
                message += `\n\nNote from sender: "${note}"`;
            }

            await NotificationService.notifyRole(
                role,
                title,
                message,
                payment.id,
                'payment_reminder_direct'
            );

            // If it's CEO audit, also notify Admin as they often coordinate
            if (role === 'ceo') {
                await NotificationService.notifyRole(
                    'admin',
                    `CEO Audit Reminder: ${paymentRef}`,
                    `A reminder was sent for a payment pending at CEO stage: "${payment.purpose}" (₹${payment.amount.toLocaleString('en-IN')}).`,
                    payment.id,
                    'payment_reminder_direct'
                );
            }

            return { success: true, message: `Reminder sent to ${role.toUpperCase()} successfully.` };

        } catch (error) {
            console.error('Error in PaymentReminderService.sendIndividualReminder:', error);
            return { success: false, error };
        }
    }
};
