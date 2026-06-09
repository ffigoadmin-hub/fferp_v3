import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBuckets() {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }
    
    console.log('Available buckets:');
    data.forEach(bucket => {
      console.log(`- ${bucket.name} (public: ${bucket.public})`);
    });
    
    const profileBucket = data.find(b => b.name === 'employee-profile-pictures');
    if (profileBucket) {
      console.log('\n✓ employee-profile-pictures bucket exists!');
    } else {
      console.log('\n✗ employee-profile-pictures bucket does NOT exist');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkBuckets();
