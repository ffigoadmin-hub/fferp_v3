
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    console.log('Keys available:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRequests() {
    console.log('Debugging Material Requests...');

    const { data, error } = await supabase
        .from('material_requests')
        .select(`
      id,
      created_at,
      project_id,
      phase_id,
      boq_items,
      status,
      project:projects!material_requests_project_id_fkey(project_name),
      phase:project_phases!material_requests_phase_id_fkey(phase_name)
    `)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    console.log(`Successfully fetched ${data.length} requests.`);
    data.forEach((req: any) => {
        console.log('--- Request ---');
        console.log('ID:', req.id);
        console.log('Phase ID:', req.phase_id);
        console.log('Phase Relation (Raw):', JSON.stringify(req.phase));
        console.log('Project Relation (Raw):', JSON.stringify(req.project));

        // Explicitly check for array
        const phaseName = Array.isArray(req.phase) ? req.phase[0]?.phase_name : req.phase?.phase_name;
        console.log('Resolved Phase Name:', phaseName);

        if (Array.isArray(req.boq_items)) {
            console.log('Items Count:', req.boq_items.length);
            req.boq_items.forEach((item: any, idx: number) => {
                console.log(`  Item ${idx}: name="${item.material_name || item.name}", spec="${item.specification}"`);
            });
        } else {
            console.log('boq_items structure:', JSON.stringify(req.boq_items));
        }
    });
}

debugRequests();
