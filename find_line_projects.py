
filename = r"c:\Users\hp\Desktop\igochain-main\src\integrations\supabase\types.ts"
search_term = "payment_requests: {"

try:
    with open(filename, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            if search_term in line:
                print(f"Line {i}: {line.strip()}")
except FileNotFoundError:
    print("File not found.")
