
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

async function diagnose() {
  try {
    const envFile = readFileSync('.env', 'utf8');
    const lines = envFile.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, ...rest] = line.split('=');
        if (key && rest.length > 0) {
          let val = rest.join('=').trim();
          // Strip quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          env[key.trim()] = val;
        }
      }
    }
    
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing credentials. Check .env content.');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- DIAGNOSING RECENT PAYMENTS ---');
    const { data, error } = await supabase
      .from('payment_requests')
      .select('id, status, department, purpose, amount, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Database Error:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No visible records. RLS is filtering results for the public key.');
      return;
    }

    console.log(`Visible to ANON key (${data.length}):`);
    data.forEach((req, i) => {
      console.log(`${i+1}. [${req.status}] ID: ${req.id.slice(0,8)} | Dept: ${req.department} | Amt: ₹${req.amount} | Created: ${req.created_at}`);
    });
  } catch (err) {
    console.error('Fatal Script Error:', err.message);
  }
}

diagnose();
