import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPerformance() {
    // First we need a user session to test RLS
    // We can either bypass RLS with service_role key to test raw speed
    // Or test with RLS if we have a user token.
    // For now let's just use the service role key to see if the raw query is slow or if it's RLS.

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        console.log("No service role key found. Bypassing test.");
        return;
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    console.time('Fetch Projects (Raw)');
    const { data, error } = await adminClient
        .from('projects')
        .select(`
      *,
      manager:profiles!projects_assigned_manager_id_fkey(name),
      engineer:profiles!projects_assigned_engineer_id_fkey(name)
    `)
        .order('created_at', { ascending: false });
    console.timeEnd('Fetch Projects (Raw)');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Returned rows:", data.length);
    }

    console.time('Fetch Escalation Stats (Raw)');
    const { data: statsData, error: statsError } = await adminClient
        .from('project_escalation_stats')
        .select('*');
    console.timeEnd('Fetch Escalation Stats (Raw)');

    if (statsError) {
        console.error("Stats Error:", statsError);
    } else {
        console.log("Stats Returned rows:", statsData?.length);
    }
}

testPerformance().catch(console.error);
