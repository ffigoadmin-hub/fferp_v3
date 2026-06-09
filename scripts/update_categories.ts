import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fix path to .env file in the root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCategories() {
    console.log("Updating rental categories to 'Both HR & RSH'...");

    const { data, error } = await supabase
        .from('rental_categories')
        .update({
            owner_department: 'Both HR & RSH',
            owner_role: 'both'
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

    if (error) {
        console.error("Error updating categories:", error);
    } else {
        console.log("Successfully updated all categories to 'both'");
    }
}

updateCategories();
