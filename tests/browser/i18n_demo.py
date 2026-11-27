"""Verify i18n demo locale links, hydration, and responsive layout."""
from pathlib import Path
import socket
import subprocess
import time
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "examples/rune-web/i18n_demo.rune"
BINARY = ROOT / "target/debug/vectrune"


def main():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    process = subprocess.Popen(
        [str(BINARY), str(SOURCE), "--port", str(port)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise AssertionError("i18n demo exited before becoming ready")
            try:
                with urlopen(base, timeout=1):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise AssertionError("i18n demo did not start")

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for width in [320, 1280]:
                page = browser.new_page(viewport={"width": width, "height": 900})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(base)
                assert page.locator(".card").count() == 3
                assert page.locator(".hero").evaluate(
                    "(element) => getComputedStyle(element).display"
                ) == "grid"
                first = page.locator(".card").nth(0).bounding_box()
                second = page.locator(".card").nth(1).bounding_box()
                assert first and second
                assert (second["y"] > first["y"]) == (width == 320)
                page.get_by_role("link", name="See how it works").click()
                assert page.url.endswith("#how")
                for label, path, title, heading, language in [
                    ("Español", "/es/", "Inicio Rápido Vectrune", "Un poco más cerca, estés donde estés.", "es"),
                    ("Français", "/fr/", "Démarrage Rapide Vectrune", "Un peu plus près, où que vous soyez.", "fr"),
                    ("English", "/", "Vectrune Quick Start", "A little more local, wherever you are.", "en-us"),
                ]:
                    page.get_by_role("link", name=label, exact=True).click()
                    assert page.url == base + path
                    expect(page.locator(".brand")).to_contain_text(title)
                    expect(page.locator("h1")).to_have_text(heading)
                    expect(page.locator("html")).to_have_attribute("lang", language)
                    expect(page.get_by_role("link", name=label, exact=True)).to_have_attribute("aria-current", "page")
                    assert page.locator(".card").count() == 3
                    page.evaluate("runeWebApp.render()")
                    expect(page.locator("h1")).to_have_text(heading)
                    assert "NaN" not in page.locator("#app").inner_text()
                    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                assert not errors, errors
                page.close()

            page = browser.new_page(java_script_enabled=False)
            page.goto(base)
            page.get_by_role("link", name="Español", exact=True).click()
            expect(page.locator("h1")).to_have_text("Un poco más cerca, estés donde estés.")
            page.get_by_role("link", name="Français", exact=True).click()
            expect(page.locator("h1")).to_have_text("Un peu plus près, où que vous soyez.")
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=10)


if __name__ == "__main__":
    main()
