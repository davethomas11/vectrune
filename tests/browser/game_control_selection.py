"""Game controls resist text selection without affecting editable content."""
import argparse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser = argparse.ArgumentParser()
parser.add_argument("--site-dir", required=True)
args = parser.parse_args()

games = [
    "vectraiders", "vectworms", "tic-tac-toe", "monster-city", "vect-breach",
    "rune-crypt", "skybound-2", "starfall", "marble-run", "dog-walker",
    "neon-circuit", "glowtide-aquarium",
]

with preview(Path(args.site_dir)) as base, sync_playwright() as pw:
    browser = pw.webkit.launch()
    context = browser.new_context(**pw.devices["iPhone 13"])
    page = context.new_page()
    for game in games:
        page.goto(f"{base}/assets/games/{game}/index.html")
        page.wait_for_load_state("load")
        button = page.locator("button").first
        assert button.count(), game
        assert button.evaluate("(e) => getComputedStyle(e).webkitUserSelect") == "none", game
        assert button.evaluate("""(e) => !CSS.supports('-webkit-touch-callout', 'none') ||
            getComputedStyle(e).getPropertyValue('-webkit-touch-callout') == 'none'"""), game
    page.goto(f"{base}/neon-circuit/")
    page.wait_for_selector("iframe.example-preview")
    frame = page.locator("iframe.example-preview").element_handle().content_frame()
    frame.wait_for_function("window.__RunePixel3D?.app.state")
    button = frame.get_by_role("button", name="New game", exact=True)
    expect(button).to_be_visible()
    assert button.evaluate("(e) => getComputedStyle(e).webkitUserSelect") == "none"
    input_box = frame.locator("#neon-super-code")
    assert input_box.evaluate("(e) => getComputedStyle(e).webkitUserSelect") == "text"
    frame.locator(".super-code summary").click()
    input_box.fill("TEST123")
    expect(input_box).to_have_value("TEST123")
    page.get_by_role("tab", name="Source").click()
    code = page.locator(".example-source code").first
    assert code.evaluate("(e) => getComputedStyle(e).webkitUserSelect") != "none"
    context.close()
    browser.close()
print("Game controls prevent selection in WebKit; input and source remain usable")
