import { createClient } from '@supabase/supabase-js';

// Hardcode the Supabase credentials (we'll get them from .env.local manually if needed)
// Or use process.env if running with proper env loading
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define expected verticals
const EXPECTED_VERTICALS = {
    DIRECT: [
        { code: 'polyhouse', name: 'Polyhouse', description: 'Protected cultivation structures', icon: 'Warehouse', color: 'green', display_order: 1 },
        { code: 'microgreens', name: 'Microgreens', description: 'Indoor microgreen farming', icon: 'Sprout', color: 'emerald', display_order: 2 },
        { code: 'mushroom', name: 'Mushroom', description: 'Mushroom cultivation', icon: 'Circle', color: 'amber', display_order: 3 },
        { code: 'open_cultivation', name: 'Open Cultivation', description: 'Open field farming', icon: 'Sun', color: 'yellow', display_order: 4 },
        { code: 'goat_farming', name: 'Goat Farming', description: 'Livestock - Goats', icon: 'Milk', color: 'orange', display_order: 5 },
        { code: 'crab_farming', name: 'Crab Farming', description: 'Aquaculture - Crabs', icon: 'Fish', color: 'blue', display_order: 6 },
    ],
    JV: [
        { code: 'new_jv', name: 'New JV', description: 'New joint venture construction', icon: 'Building2', color: 'indigo', display_order: 1 },
        { code: 'revamp_jv', name: 'Revamp JV', description: 'Renovation of existing JV', icon: 'RefreshCw', color: 'violet', display_order: 2 },
        { code: 'repair_services', name: 'Repair & Services', description: 'Maintenance and repair work', icon: 'Wrench', color: 'slate', display_order: 3 },
    ],
};

async function checkAndFixVerticals() {
    console.log('🔍 Checking project verticals in database...\n');

    // Fetch all existing verticals
    const { data: existingVerticals, error } = await supabase
        .from('project_verticals')
        .select('*')
        .order('category, display_order');

    if (error) {
        console.error('❌ Error fetching verticals:', error.message);
        return;
    }

    console.log(`📊 Found ${existingVerticals?.length || 0} verticals in database\n`);

    // Group by category
    const verticalsByCategory = {
        DIRECT: existingVerticals?.filter(v => v.category === 'DIRECT') || [],
        JV: existingVerticals?.filter(v => v.category === 'JV') || [],
    };

    // Report status
    console.log('📋 Current Status:');
    console.log(`   DIRECT: ${verticalsByCategory.DIRECT.length} verticals (expected 6)`);
    verticalsByCategory.DIRECT.forEach(v => {
        console.log(`      ✓ ${v.name} (${v.code}) - ${v.is_active ? 'active' : 'inactive'}`);
    });

    console.log(`\n   JV: ${verticalsByCategory.JV.length} verticals (expected 3)`);
    verticalsByCategory.JV.forEach(v => {
        console.log(`      ✓ ${v.name} (${v.code}) - ${v.is_active ? 'active' : 'inactive'}`);
    });

    // Check for missing verticals
    const missingVerticals: Array<{ category: string } & typeof EXPECTED_VERTICALS.DIRECT[0]> = [];

    for (const [category, expectedList] of Object.entries(EXPECTED_VERTICALS)) {
        const existing = verticalsByCategory[category as keyof typeof verticalsByCategory];
        const existingCodes = existing.map(v => v.code);

        for (const expected of expectedList) {
            if (!existingCodes.includes(expected.code)) {
                missingVerticals.push({ category, ...expected });
            }
        }
    }

    if (missingVerticals.length === 0) {
        console.log('\n✅ All expected verticals are present in the database!');

        // Check if any are inactive
        const inactiveVerticals = existingVerticals?.filter(v => !v.is_active) || [];
        if (inactiveVerticals.length > 0) {
            console.log('\n⚠️  Warning: Some verticals are inactive:');
            inactiveVerticals.forEach(v => {
                console.log(`   - ${v.name} (${v.code}) in ${v.category}`);
            });

            console.log('\n🔧 Activating all verticals...');
            const { error: activateError } = await supabase
                .from('project_verticals')
                .update({ is_active: true })
                .eq('is_active', false);

            if (activateError) {
                console.error('❌ Error activating verticals:', activateError.message);
            } else {
                console.log('✅ All verticals activated successfully!');
            }
        }

        return;
    }

    // Insert missing verticals
    console.log(`\n🔧 Found ${missingVerticals.length} missing verticals. Inserting now...\n`);

    for (const vertical of missingVerticals) {
        const { category, ...verticalData } = vertical;
        console.log(`   Adding: ${verticalData.name} to ${category}...`);

        const { error: insertError } = await supabase
            .from('project_verticals')
            .insert({
                category,
                code: verticalData.code,
                name: verticalData.name,
                description: verticalData.description,
                icon: verticalData.icon,
                color: verticalData.color,
                display_order: verticalData.display_order,
                is_active: true,
            });

        if (insertError) {
            console.error(`      ❌ Error: ${insertError.message}`);
        } else {
            console.log(`      ✓ Added successfully`);
        }
    }

    console.log('\n✅ Database repair complete!');

    // Verify final state
    const { data: finalVerticals } = await supabase
        .from('project_verticals')
        .select('category')
        .eq('is_active', true);

    const finalCounts = {
        DIRECT: finalVerticals?.filter(v => v.category === 'DIRECT').length || 0,
        JV: finalVerticals?.filter(v => v.category === 'JV').length || 0,
    };

    console.log('\n📊 Final Status:');
    console.log(`   DIRECT: ${finalCounts.DIRECT} active verticals`);
    console.log(`   JV: ${finalCounts.JV} active verticals`);
}

checkAndFixVerticals()
    .then(() => {
        console.log('\n✨ Done!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Fatal error:', err);
        process.exit(1);
    });
