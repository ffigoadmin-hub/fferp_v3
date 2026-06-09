
import asyncio
from playwright.async_api import async_playwright
import os

async def run_audit():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "http://localhost:8083"
        print(f"Auditing Registry at {url}...")
        
        try:
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_timeout(5000)
            
            print("Logging in as Admin...")
            await page.get_by_placeholder("Enter your email").fill("vigneshalagesan2004@gmail.com")
            await page.get_by_placeholder("Enter your password").fill("Family1234@")
            await page.get_by_role("button", name="Sign In").click()
            
            await page.wait_for_timeout(8000)
            
            # Go to Admin Payments
            print("Navigating to Admin Registry...")
            await page.goto("http://localhost:8083/admin-payments", wait_until="networkidle")
            await page.wait_for_timeout(3000)
            
            # Click the "Registry" tab (value="all")
            await page.get_by_role("tab", name="Registry").click()
            await page.wait_for_timeout(5000)
            
            screenshot_path = os.path.join(os.getcwd(), "admin_registry_audit.png")
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f"Registry screenshot saved to {screenshot_path}")
            
            # Extract payment list from table/registry
            content = await page.content()
            if "PAY-" in content:
                print("Payments found in Registry.")
            else:
                print("No payments visible in Registry.")
                
        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="audit_error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run_audit())
