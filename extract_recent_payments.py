import asyncio
from playwright.async_api import async_playwright

async def extract_payments():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "http://localhost:8083"
        try:
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_timeout(5000)
            
            await page.get_by_placeholder("Enter your email").fill("vigneshalagesan2004@gmail.com")
            await page.get_by_placeholder("Enter your password").fill("Family1234@")
            await page.get_by_role("button", name="Sign In").click()
            await page.wait_for_timeout(8000)
            
            await page.goto("http://localhost:8083/admin-payments", wait_until="networkidle")
            await page.wait_for_timeout(3000)
            
            await page.get_by_role("tab", name="Registry").click()
            await page.wait_for_timeout(5000)
            
            print("--- RECENT PAYMENTS IN REGISTRY ---")
            
            # Find all purposes (h3)
            purposes = await page.locator("h3").all()
            # Find all amounts
            amounts = await page.locator(".font-mono.tracking-tight").all()
            
            count = min(len(purposes), 10)
            for i in range(count):
                p_text = await purposes[i].inner_text()
                a_text = await amounts[i].inner_text() if i < len(amounts) else "N/A"
                print(f"{i+1}. {p_text} | {a_text}")
                
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(extract_payments())
