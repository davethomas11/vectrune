"""Verify Rune-Web browser location through its actual page and runtime."""
from pathlib import Path
import socket
import subprocess
import time
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]


def main():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    process = subprocess.Popen(
        [str(ROOT / "target/debug/vectrune"), str(ROOT / "examples/rune-web/location.rune"), "--port", str(port)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise AssertionError("location demo exited before becoming ready")
            try:
                with urlopen(base, timeout=1):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise AssertionError("location demo did not start")

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            context = browser.new_context(
                geolocation={"latitude": 51.5072, "longitude": -0.1276},
                permissions=["geolocation"],
            )
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base)
            page.get_by_role("button", name="Use my location").click()
            expect(page.get_by_text("Location found.")).to_be_visible()
            expect(page.get_by_text("Latitude: 51.5072, longitude: -0.1276")).to_be_visible()
            assert not errors, errors
            context.close()

            context = browser.new_context(permissions=[])
            page = context.new_page()
            page.goto(base)
            page.get_by_role("button", name="Use my location").click()
            expect(page.get_by_text("Location permission was denied.")).to_be_visible()
            expect(page.get_by_role("button", name="Use my location")).to_be_enabled()
            context.close()
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=10)


if __name__ == "__main__":
    main()
