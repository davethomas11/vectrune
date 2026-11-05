"""Check the compiled Rune-Web teaching guide in Chromium.

Build the CLI and install Python Playwright and Chromium first, then run:
    python3 tests/browser/rune_web_guide.py
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import subprocess
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
    source = ROOT / "teaching_website/teaching.rune"
    with tempfile.NamedTemporaryFile(dir=source.parent, suffix=".rune", delete=False) as file:
        temporary = Path(file.name)
    try:
        for locale, folder in [("en_us", ""), ("es", "es"), ("fr", "fr")]:
            temporary.write_text(source.read_text(encoding="utf-8").replace("locale = en_us", f"locale = {locale}"), encoding="utf-8")
            result = subprocess.run(
                [binary, str(temporary), "-o", "html"],
                capture_output=True, text=True, encoding="utf-8", check=True,
            )
            output = destination / folder
            output.mkdir(parents=True, exist_ok=True)
            (output / "index.html").write_text(result.stdout, encoding="utf-8")
        assets = destination / "assets"
        assets.mkdir()
        for pattern in ["*.js", "*.png", "*.css"]:
            for asset in source.parent.glob(pattern):
                shutil.copy(asset, assets / asset.name)
    finally:
        temporary.unlink(missing_ok=True)


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
                expect(page.locator("main.content-area h2").first).to_have_text(title)
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
                page.locator(".example-source > summary").click()
                expect(page.locator(".example-source > .example-code code")).to_have_text(
                    (ROOT / f"examples/rune_web_guide/{filename}.rune").read_text(encoding="utf-8"),
                )
                page.locator(".source-file > summary").click()
                expect(page.locator(".source-file code")).to_have_text(
                    (ROOT / "examples/rune_web_guide/parts/style.rune").read_text(encoding="utf-8"),
                )
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
