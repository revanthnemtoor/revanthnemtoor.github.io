from playwright.sync_api import sync_playwright
import time

def verify_3d():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the local server
            page.goto("http://localhost:3000")

            # Wait for the canvas to be present
            page.wait_for_selector("#canvas-container canvas")

            # Give Three.js some time to initialize and render frames
            time.sleep(5)

            # Take a screenshot
            page.screenshot(path="verification/verification.png")
            print("Screenshot taken.")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_3d()
