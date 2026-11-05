"""Verify VectRaiders fits its teaching-site previews and its controls still work.

Build the CLI and install Python Playwright/Chromium, then run this script.
Use --url https://vectrune.com to verify a deployed site instead.
"""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import tempfile
from threading import Thread

from playwright.sync_api import expect, sync_playwright
from rune_web_guide import ROOT, QuietHandler, build_site

SIZES = [(320, 640), (390, 844), (768, 1024), (1440, 900), (1440, 720), (844, 390)]


def check(base, browser_name="chromium"):
    with sync_playwright() as playwright:
        browser = getattr(playwright, browser_name).launch(
            args=["--disable-http2", "--disable-quic"] if browser_name == "chromium" else [],
        )
        for locale in ["", "es/", "fr/"]:
            for placement in ["games", "lab"]:
                for width, height in SIZES:
                    context = browser.new_context(
                        viewport={"width": width, "height": height},
                        has_touch=width < 768,
                    )
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(f"{base}/{locale}?qa=arcade-fit")
                    if width < 1024:
                        page.locator(".navigation-toggle").click()
                    if placement == "games":
                        page.locator('.sidebar [data-on-click="navigate(\'games\')"]').click()
                    else:
                        page.locator('.sidebar [data-on-click="openExample(\'app\')"]').click()
                        page.locator('.example-picker [data-on-click="openExample(\'invaders\')"]').click()
                    frame = page.frame_locator(".example-preview")
                    expect(frame.locator(".start-btn")).to_be_visible()
                    if width < 768:
                        frame.locator(".start-btn").tap()
                    else:
                        frame.locator(".start-btn").click()
                    expect(frame.locator(".overlay")).to_have_count(0)
                    # Pause the real timer for deterministic geometry; actions remain real.
                    frame.locator("body").evaluate("() => runeWebApp.stopTimer()")
                    expect(frame.locator(".alien")).to_have_count(18)
                    geometry = frame.locator("body").evaluate("""() => {
                        const viewport = document.querySelector('.arena-viewport').getBoundingClientRect();
                        const fits = r => r.left >= viewport.left - 1 && r.right <= viewport.right + 1
                            && r.top >= viewport.top - 1 && r.bottom <= viewport.bottom + 1;
                        return {
                            board: fits(document.querySelector('.game-arena').getBoundingClientRect()),
                            entities: [...document.querySelectorAll('.player,.alien')].every(e => fits(e.getBoundingClientRect())),
                            noScroll: document.documentElement.scrollHeight <= innerHeight + 1
                                && document.documentElement.scrollWidth <= innerWidth + 1,
                            controls: [...document.querySelectorAll('.ctrl-btn')].every(e => {
                                const r = e.getBoundingClientRect();
                                return r.top >= 0 && r.bottom <= innerHeight && r.height >= 44;
                            })
                        };
                    }""")
                    assert all(geometry.values()), (locale, placement, width, height, geometry)
                    before = frame.locator(".player").get_attribute("style")
                    if width < 768:
                        frame.locator(".ctrl-btn").last.tap()
                    else:
                        frame.locator(".ctrl-btn").last.click()
                    expect(frame.locator(".player")).not_to_have_attribute("style", before)
                    moved = frame.locator("body").evaluate("() => runeWebApp.state.player.x")
                    if width < 768:
                        frame.locator(".fire-btn").tap()
                    else:
                        frame.locator(".fire-btn").click()
                    expect(frame.locator(".bullet").first).to_be_visible()
                    # The responsive layout must preserve keyboard event delegation too.
                    before = frame.locator(".player").get_attribute("style")
                    frame.locator(".ctrl-btn").last.press("ArrowLeft")
                    expect(frame.locator(".player")).not_to_have_attribute("style", before)
                    assert frame.locator("body").evaluate("() => runeWebApp.state.player.x") < moved
                    assert not errors, errors
                    context.close()
                print(locale or "en/", placement, "six sizes: full board, entities, controls, no iframe scroll and keyboard passed", flush=True)
        browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url")
    parser.add_argument("--browser", choices=["chromium", "webkit"], default="chromium")
    parser.add_argument("--binary", default=str(ROOT / "target/debug/vectrune"))
    args = parser.parse_args()
    if args.url:
        check(args.url.rstrip("/"), args.browser)
    else:
        with tempfile.TemporaryDirectory(prefix="vectraiders-fit-") as directory:
            build_site(Path(directory), str(Path(args.binary).resolve()))
            server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=directory))
            Thread(target=server.serve_forever, daemon=True).start()
            try:
                check(f"http://127.0.0.1:{server.server_port}", args.browser)
            finally:
                server.shutdown()
                server.server_close()
