"""Exercise the bundled mobile demo in Chromium and WebKit.

From runtime/rune-mobile: npm run build
Then: python3 tests/browser/rune_mobile.py (from the repository root).
Install Python Playwright and its chromium/webkit browsers first.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def check(base):
    with sync_playwright() as playwright:
        for engine in [playwright.chromium, playwright.webkit]:
            browser = engine.launch()
            for width, height in [(320, 740), (390, 844), (844, 390)]:
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    has_touch=True, device_scale_factor=2,
                )
                page = context.new_page()
                errors, external = [], []
                page.on("pageerror", lambda error: errors.append(str(error)))

                def route_request(route):
                    if route.request.url.startswith(base + "/"):
                        route.continue_()
                    else:
                        external.append(route.request.url)
                        route.abort()

                page.route("**/*", route_request)
                page.goto(base)
                expect(page.locator("#count")).to_have_text("0")
                assert "viewport-fit=cover" in page.locator('meta[name="viewport"]').get_attribute("content")
                context.set_offline(True)
                page.get_by_role("button", name="Increase count").tap()
                page.get_by_role("button", name="Increase count").tap()
                expect(page.locator("#count")).to_have_text("2")
                page.get_by_role("button", name="Decrease count").tap()
                expect(page.locator("#count")).to_have_text("1")
                page.get_by_role("button", name="Save count", exact=True).tap()
                page.get_by_role("button", name="Reset counter").tap()
                page.get_by_role("button", name="Decrease count").tap()
                expect(page.locator("#count")).to_have_text("0")
                page.get_by_role("button", name="Restore count").tap()
                expect(page.locator("#count")).to_have_text("1")
                page.get_by_role("button", name="About", exact=True).tap()
                expect(page.get_by_role("heading", name="Built from Rune")).to_be_visible()
                page.get_by_role("button", name="Counter", exact=True).tap()
                expect(page.locator("#count")).to_have_text("1")
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Horizontal overflow"
                for button in page.get_by_role("button").all():
                    box = button.bounding_box()
                    assert box["width"] >= 48 and box["height"] >= 48, "Small touch target"
                # The HTTP server substitutes for Capacitor's local asset handler during reload.
                context.set_offline(False)
                page.reload()
                page.get_by_role("button", name="Restore count").tap()
                expect(page.locator("#count")).to_have_text("1")
                assert not external, external
                assert not errors, errors
                context.close()
            browser.close()
            print(f"{engine.name}: touch, state, navigation, persistence, offline actions and layouts passed")


if __name__ == "__main__":
    assets = ROOT / "runtime/rune-mobile/www"
    assert (assets / "index.html").exists(), "Build runtime/rune-mobile first"
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(assets)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        check(f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown()
        server.server_close()
