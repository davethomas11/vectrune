"""Verify the reactivity example with two real WebSocket clients."""
from pathlib import Path
import socket
import subprocess
import time
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "examples/rune-web/reactivity-contract-rune-web.rune"


def main():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    process = subprocess.Popen(
        [str(ROOT / "target/debug/vectrune"), str(SOURCE), "--port", str(port)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise AssertionError("reactivity example exited before becoming ready")
            try:
                with urlopen(base, timeout=1):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise AssertionError("reactivity example did not start")

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            first = browser.new_page()
            second = browser.new_page()
            errors = []
            for page in [first, second]:
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(base)
                page.wait_for_function("window.__runeWebSocket?.readyState === WebSocket.OPEN")
                expect(page.locator(".value")).to_have_text("0")
            first.get_by_role("button", name="Increase Score").click()
            expect(first.locator(".value")).to_have_text("1")
            expect(second.locator(".value")).to_have_text("1")
            second.get_by_role("button", name="Increase Score").click()
            expect(first.locator(".value")).to_have_text("2")
            expect(second.locator(".value")).to_have_text("2")
            third = browser.new_page()
            third.goto(base)
            expect(third.locator(".value")).to_have_text("2")
            assert not errors, errors
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=10)


if __name__ == "__main__":
    main()
