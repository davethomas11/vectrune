"""Namespaced modules and entity composition on an ordinary Rune-Web page."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))

with tempfile.TemporaryDirectory(prefix="rune-modules-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "modules.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/rune-web/modules/modules.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(preview.as_uri())
    page.get_by_role("button", name="Create Pebble").click()
    expect(page.get_by_text("Pebble: 0s old, hunger 0", exact=True)).to_be_visible()
    page.get_by_role("button", name="Earn 10 pearls").click()
    expect(page.get_by_text("Pearls: 40", exact=True)).to_be_visible()
    page.get_by_role("button", name="Spend 5 pearls").click()
    expect(page.get_by_text("Pearls: 35", exact=True)).to_be_visible()
    assert page.evaluate("runeWebApp.state.wallet.purchases") == 1
    page.get_by_role("button", name="Advance one minute").click()
    expect(page.get_by_text("Pebble: 60s old, hunger 60", exact=True)).to_be_visible()
    page.evaluate("runeWebApp.state.pet = JSON.parse(JSON.stringify(runeWebApp.state.pet))")
    page.get_by_role("button", name="Feed Pebble").click()
    expect(page.get_by_text("Pebble: 60s old, hunger 0", exact=True)).to_be_visible()
    assert page.evaluate("""() => {
        try { runeWebApp.invokeAction('wallet.purchased', []); }
        catch (error) { return error.message.includes('Private'); }
        return false;
    }""")
    assert not errors, errors
    browser.close()
