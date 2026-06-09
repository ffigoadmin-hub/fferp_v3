
import asyncio
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Try to find env vars
load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")

async def diagnose_payments():
    if not url or not key:
        print("Error: Supabase credentials not found in environment.")
        return

    supabase: Client = create_client(url, key)
    
    print("Fetching last 10 payment requests...")
    try:
        # Note: This uses the anon key, so it will be subject to RLS.
        # This is actually GOOD because it will show us what the RLS allows us to see.
        # But to see EVERYTHING for diagnosis, we really need the service role key.
        # Since I don't have that, I'll try to fetch and see what comes back.
        
        response = supabase.table("payment_requests").select("*, profiles(name, department)").order("created_at", desc=True).limit(10).execute()
        
        if response.data:
            print(f"Found {len(response.data)} requests:")
            for req in response.data:
                print(f"- ID: {req['id']} | Status: {req['status']} | Dept: {req['department']} | Purpose: {req['purpose']} | Amount: {req['amount']}")
        else:
            print("No requests found (or blocked by RLS).")
            
    except Exception as e:
        print(f"Error fetching data: {e}")

if __name__ == "__main__":
    asyncio.run(diagnose_payments())
