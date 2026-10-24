"""Optional real-browser checks. Run directly, not through unittest discovery."""
import csv
import io
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def main():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    process = subprocess.Popen([sys.executable, "-m", "lab", "--port", str(port)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError("Local server failed to start.")
            try:
                with opener.open(url + "/api/health", timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError("Local server did not become ready.")
        with sync_playwright() as p:
            launch = {"headless":True}
            if os.environ.get("CHROMIUM_PATH"):
                launch["executable_path"] = os.environ["CHROMIUM_PATH"]
            browser = p.chromium.launch(**launch)
            context = browser.new_context(viewport={"width":1440,"height":1080}, accept_downloads=True)
            page = context.new_page()
            errors, external = [], []
            page.on("pageerror", lambda error: errors.append(str(error)))
            context.on("request", lambda req: external.append(req.url) if not req.url.startswith(url + "/") and not req.url.startswith("blob:") else None)
            page.goto(url)
            expect(page.get_by_role("heading", name="No flagged structural clues", exact=True)).to_be_visible()
            # Inputs cannot introduce DOM elements or execute script.
            page.locator("#url-input").fill('https://example.test/<img%20src=x%20onerror=alert(1)>?q=<script>bad</script>')
            page.get_by_role("button", name="Inspect URL").click()
            expect(page.locator("#url-results")).to_contain_text('<img src=x onerror=alert(1)>')
            assert page.locator("#url-results img, #url-results script").count() == 0
            page.get_by_role("button", name="Hidden destination").click()
            expect(page.get_by_role("heading", name="Embedded credentials", exact=True)).to_be_visible()
            expect(page.locator("#url-results")).to_contain_text("signin.example.test")
            page.locator("#url-input").fill("javascript:alert(1)")
            page.get_by_role("button", name="Inspect URL").click()
            expect(page.get_by_role("alert")).to_be_visible()
            expect(page.locator("#url-results")).to_be_empty()
            page.get_by_role("button", name="Simple HTTPS").click()
            expect(page.get_by_role("heading", name="No flagged structural clues", exact=True)).to_be_visible()
            screenshot_dir = os.environ.get("LAB_SCREENSHOT_DIR")
            if screenshot_dir:
                Path(screenshot_dir).mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(Path(screenshot_dir) / "url-desktop.png"), full_page=True)

            page.get_by_role("link", name="Hash playground").click()
            page.get_by_role("button", name="Compare hashes").click()
            expect(page.locator("#digest-a")).to_be_visible()
            assert page.locator("#digest-b .different").count() > 0
            page.locator("#hash-comparison").fill(page.locator("#hash-text").input_value())
            page.get_by_role("button", name="Compare hashes").click()
            expect(page.locator("#hash-results")).to_contain_text("0 of 256 bits changed")
            page.locator("#hash-algorithm").select_option("sha512")
            page.get_by_role("button", name="Compare hashes").click()
            expect(page.locator("#hash-results")).to_contain_text("0 of 512 bits changed")

            page.get_by_role("link", name="Encryption studio").click()
            message = '<script>alert("hello")</script> 🔐'
            page.locator("#plaintext").fill(message)
            page.get_by_role("button", name="Encrypt message").click()
            expect(page.locator("#encryption-key")).not_to_have_value("")
            page.get_by_role("button", name="Decrypt & verify").click()
            expect(page.locator(".plaintext-output")).to_have_text(message)
            assert page.locator("#encryption-results script").count() == 0
            page.get_by_role("button", name="Alter one byte").click()
            page.get_by_role("button", name="Decrypt & verify").click()
            expect(page.get_by_role("alert")).to_contain_text("cannot be authenticated")
            expect(page.locator("#encryption-results")).to_be_empty()
            page.get_by_role("button", name="Encrypt message").click()
            expect(page.get_by_role("alert")).to_be_hidden()

            page.get_by_role("link", name="Traffic simulator").click()
            expect(page.locator("#packet-rows tr")).to_have_count(8)
            page.locator("#traffic-scenario").select_option("burst")
            page.get_by_role("button", name="Generate traffic").click()
            expect(page.locator(".chart-subtitle")).to_contain_text("burst pattern")
            page.locator("#protocol-filter").select_option("DNS")
            expect(page.locator("#packet-rows tr")).to_have_count(8)
            assert all(cell == "DNS" for cell in page.locator("#packet-rows td:nth-child(4)").all_text_contents())
            page.get_by_role("button", name="Next packet page").click()
            expect(page.locator("#page-count")).to_contain_text("2 /")
            with page.expect_download() as download_info:
                page.get_by_role("button", name="Export CSV").click()
            download = download_info.value
            rows = list(csv.DictReader(io.StringIO(Path(download.path()).read_text())))
            assert len(rows) > 8
            assert all(row["protocol"] == "DNS" and row["synthetic"] == "true" for row in rows)
            assert all(row["seed"] == "42" and row["scenario"] == "burst" for row in rows)
            page.locator("#protocol-filter").select_option("all")
            if screenshot_dir:
                page.evaluate("window.scrollTo(0, 0)")
                page.screenshot(path=str(Path(screenshot_dir) / "traffic-desktop.png"), full_page=True)
            page.get_by_role("button", name="Reset workspace").click()
            expect(page.locator("#encryption-key")).to_have_value("")
            expect(page.locator("#traffic-scenario")).to_have_value("baseline")
            expect(page.locator(".chart-subtitle")).to_contain_text("baseline pattern")

            page.get_by_role("link", name="Lab guide", exact=True).click()
            expect(page.get_by_role("heading", name="Four experiments. A stronger foundation.")).to_be_visible()
            assert page.evaluate("localStorage.length + sessionStorage.length") == 0
            assert context.cookies() == []
            # Private Codespaces forwarding authenticates same-origin requests with
            # its own cookie. Simulate that gate; the lab itself sets no cookies.
            context.add_cookies([{"name":"preview-test-auth", "value":"test-session", "url":url, "httpOnly":True, "sameSite":"Lax"}])
            def private_preview_gate(route):
                if "preview-test-auth=test-session" not in route.request.all_headers().get("cookie", ""):
                    route.fulfill(status=403, content_type="application/json", body='{"detail":"Preview authentication required"}')
                else:
                    route.continue_()
            context.route("**/api/**", private_preview_gate)
            page.goto(url + "/#url")
            page.reload()
            expect(page.get_by_role("heading", name="No flagged structural clues", exact=True)).to_be_visible()
            context.unroute("**/api/**", private_preview_gate)
            context.clear_cookies()
            # At mobile sizes, all workspaces remain reachable and fit the viewport.
            page.set_viewport_size({"width":390,"height":844})
            for workspace in ("url", "hash", "encryption", "traffic", "guide"):
                page.goto(url + "/#" + workspace)
                page.reload()
                expect(page.locator("#page-" + workspace)).to_be_visible()
                if workspace == "url":
                    expect(page.get_by_role("heading", name="No flagged structural clues", exact=True)).to_be_visible()
                if workspace == "traffic":
                    expect(page.locator("#packet-rows tr")).to_have_count(8)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), workspace + " overflows"
            page.goto(url + "/#url")
            expect(page.get_by_role("heading", name="No flagged structural clues", exact=True)).to_be_visible()
            if screenshot_dir:
                page.screenshot(path=str(Path(screenshot_dir) / "url-mobile.png"), full_page=True)
            assert not errors, errors
            assert not external, external
            browser.close()
        print("PASS: desktop/mobile flows, URL XSS handling, hash comparison, AES-GCM tampering, traffic filters/pagination/export, reset, no browser storage, and zero external browser requests.")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


if __name__ == "__main__":
    main()
