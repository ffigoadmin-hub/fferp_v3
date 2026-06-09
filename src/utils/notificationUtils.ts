import { supabase } from '@/integrations/supabase/client';

/**
 * Sends a notification to all users with specific roles
 */
export const notifyRoles = async (options: {
    roles: string[];
    title: string;
    message: string;
    relatedId?: string;
    type?: string;
}) => {
    try {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id')
            .in('role', options.roles);

        if (profiles && profiles.length > 0) {
            const notifications = profiles.map(p => ({
                user_id: p.id,
                type: options.type || 'payment_status',
                title: options.title,
                message: options.message,
                role: options.roles[0],
                related_record_id: options.relatedId
            }));

            const { error } = await supabase.from('notifications').insert(notifications);
            if (error) throw error;
        }
    } catch (err) {
        console.error('Failed to send group notifications:', err);
    }
};

/**
 * Sends a notification to a specific user
 */
export const notifyUser = async (options: {
    userId: string;
    title: string;
    message: string;
    relatedId?: string;
    type?: string;
    role?: string;
}) => {
    try {
        const { error } = await supabase.from('notifications').insert({
            user_id: options.userId,
            type: options.type || 'payment_status',
            title: options.title,
            message: options.message,
            role: options.role || 'employee',
            related_record_id: options.relatedId
        });
        if (error) throw error;
    } catch (err) {
        console.error('Failed to send user notification:', err);
    }
};
