"""Check the compiled Rune-Web teaching guide in Chromium.

Build the CLI and install Python Playwright and Chromium first, then run:
    python3 tests/browser/rune_web_guide.py
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import tempfile
from threading import Thread

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
LESSONS = [
    ("components", "components"),
    ("forms", "forms"),
    ("actions", "packing"),
    ("views", "navigation"),
    ("styles", "styling"),
]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def build_site(destination, binary):
    # Exercise the same renderer as deployment, with just home HTML for tests
    # that intentionally exercise lazy navigation rather than direct links.
    import sys
    sys.path.insert(0, str(ROOT / "teaching_website"))
    from build_site import build_site as render_site
    render_site(destination, binary, selected_routes=[])


def check(base):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for locale in ["", "es/", "fr/"]:
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base + "/" + locale)
            for lesson, filename in LESSONS:
                # Exercise the actual mobile menu, not just hidden navigation buttons.
                page.set_viewport_size({"width": 320, "height": 1000})
                page.locator(".navigation-toggle").click()
                page.locator(f'.sidebar [data-on-click="navigate(\'web_{lesson}\')"]').click()
                expect(page.locator(".navigation-toggle")).to_have_attribute("aria-expanded", "false")
                title = page.evaluate(
                    "(key) => runeWebApp.state.i18n.RuneWebGuide[key]", lesson + "_title",
                )
                expect(page.locator("main.content-area h1").first).to_have_text(title)
                frame = page.frame_locator(".example-preview")
                expect(frame.locator("h1")).to_be_visible()
                if lesson == "components":
                    expect(frame.locator("article")).to_have_count(2)
                    expect(frame.locator("article").first).to_contain_text("Bring your curiosity.")
                if lesson == "forms":
                    frame.get_by_label("Your name").fill("Sam")
                    frame.get_by_label("Your name").press("Tab")
                    expect(frame.locator("h2")).to_have_text("Welcome, Sam")
                    frame.get_by_label("Session", exact=True).select_option("Studio")
                    expect(frame.locator("section")).to_contain_text("Session: Studio")
                    expect(frame.get_by_label("Session", exact=True)).to_have_value("Studio")
                    frame.get_by_label("Your name").fill("Alex")
                    frame.get_by_label("Your name").press("Tab")
                    expect(frame.locator("h2")).to_have_text("Welcome, Alex")
                    expect(frame.get_by_label("Session", exact=True)).to_have_value("Studio")
                if lesson == "actions":
                    frame.get_by_label("Item to bring").fill("Snacks")
                    frame.get_by_role("button", name="Add item", exact=True).click()
                    expect(frame.locator("article")).to_have_count(3)
                    frame.locator("article").last.get_by_role("button", name="Pack", exact=True).click()
                    expect(frame.locator("article").last).to_contain_text("Packed")
                    frame.locator("article").last.get_by_role("button", name="Unpack", exact=True).click()
                    expect(frame.locator("article").last).to_contain_text("Still to pack")
                    for name in ["Water bottle", "Rain jacket", "Snacks"]:
                        frame.get_by_role("button", name="Remove " + name, exact=True).click()
                    expect(frame.locator("main")).to_contain_text("Your list is empty")
                if lesson == "views":
                    frame.get_by_role("button", name="Schedule").click()
                    expect(frame.locator("h2")).to_have_text("A simple itinerary")
                    expect(frame.get_by_role("button", name="Schedule")).to_have_class("active")
                    frame.get_by_role("button", name="Summary").click()
                    expect(frame.locator("h2")).to_have_text("A weekend by the coast")
                for path in [f"{filename}.rune", "parts/style.rune"]:
                    file = page.locator('.source-file').filter(has=page.get_by_text(path, exact=True))
                    if not file.evaluate('(file) => file.open'):
                        file.locator('summary').click()
                    assert file.locator('code').text_content() == (ROOT / 'examples/rune_web_guide' / path).read_text(encoding='utf-8')
                for width in [320, 390, 768, 1440]:
                    page.set_viewport_size({"width": width, "height": 1000})
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (locale, lesson, width)
                    assert frame.locator("html").evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1"), (locale, lesson, width)
                assert "%i18n." not in page.locator("main.content-area").inner_text()
            page.locator('.sidebar [data-on-click="navigate(\'rune_web\')"]').click()
            frame = page.frame_locator(".example-preview")
            expect(frame.locator("h1")).to_have_text("Count: 0")
            frame.get_by_role("button", name="+ Increase", exact=True).click()
            expect(frame.locator("h1")).to_have_text("Count: 1")
            page.locator('.sidebar [data-on-click="navigate(\'rest_get\')"]').click()
            expect(page.locator("#sandbox-editor")).to_be_visible()
            assert not errors, errors
            print(locale or "en/", "five lessons, source, interactions, mobile menu, four widths and existing pages passed", flush=True)
            page.close()
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default=str(ROOT / "target/debug/vectrune"))
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="vectrune-web-guide-") as directory:
        build_site(Path(directory), str(Path(args.binary).resolve()))
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=directory))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            check(f"http://127.0.0.1:{server.server_port}")
        finally:
            server.shutdown()
            server.server_close()
