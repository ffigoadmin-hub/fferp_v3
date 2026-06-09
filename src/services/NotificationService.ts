import { supabase } from '@/integrations/supabase/client';

export const NotificationService = {
    /**
     * Sends a notification to all users with a specific role.
     * Useful for auditing stages where any user with the role can act.
     */
    async notifyRole(role: string, title: string, message: string, relatedRecordId?: string, type: string = 'payment_status') {
        try {
            // 1. Fetch all users with the specified role from profiles
            const { data: users, error: usersError } = await supabase
                .from('profiles')
                .select('id')
                .ilike('role', role)
                .eq('is_active', true);

            if (usersError) throw usersError;
            if (!users || users.length === 0) return;

            // 2. Prepare notifications for each user
            const notifications = users.map(user => ({
                user_id: user.id,
                type,
                title,
                message,
                role,
                related_record_id: relatedRecordId || null,
                read_status: false,
            }));

            // 3. Batch insert notifications
            console.log(`[NotificationService] Attempting to notify role: ${role} (${notifications.length} users)`);
            const { error: notifyError } = await supabase
                .from('notifications')
                .insert(notifications);

            if (notifyError) {
                console.error(`[NotificationService] Error inserting role notifications:`, notifyError);
                throw notifyError;
            }
            console.log(`[NotificationService] Successfully inserted ${notifications.length} notifications for role: ${role}`);

        } catch (error) {
            console.error(`Error sending role notification (${role}):`, error);
        }
    },

    /**
     * Sends a notification to a specific user.
     * Useful for rejections or direct assignments.
     */
    async notifyUser(userId: string, title: string, message: string, role: string, relatedRecordId?: string, type: string = 'payment_status') {
        try {
            const { error } = await supabase
                .from('notifications')
                .insert({
                    user_id: userId,
                    type,
                    title,
                    message,
                    role,
                    related_record_id: relatedRecordId || null,
                    read_status: false,
                });

            if (error) throw error;
        } catch (error) {
            console.error(`Error sending user notification (${userId}):`, error);
        }
    }
};
