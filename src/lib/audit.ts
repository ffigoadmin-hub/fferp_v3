import { supabase } from '@/integrations/supabase/client';

export type EventEntityType = 'sales_order' | 'purchase_order' | 'inventory' | 'customer' | 'qc' | 'profile';
export type EventAction = 'created' | 'updated' | 'deleted' | 'status_changed';

export async function logEvent({
  entity_type,
  entity_id,
  action,
  description,
  payload = {},
  source = 'web_app'
}: {
  entity_type: EventEntityType;
  entity_id: string;
  action: EventAction;
  description: string;
  payload?: any;
  source?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('system_events').insert({
      entity_type, entity_id, action, description, payload, source, actor_id: user?.id
    });
  } catch {
    // non-critical
  }
}
