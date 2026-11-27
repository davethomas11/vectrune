"""Verify mobile game controls in the actual localized website iframes."""
import argparse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser = argparse.ArgumentParser()
parser.add_argument("--site-dir", required=True)
args = parser.parse_args()

with preview(Path(args.site_dir)) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    for locale in ["", "es/", "fr/"]:
        context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"{base}/{locale}neon-circuit/")
        page.locator(".example-preview").element_handle().content_frame().wait_for_function("window.__RunePixel3D?.app.state")
        frame = page.frame_locator(".example-preview")
        frame.locator(".toolbar [data-pixel-fullscreen]").tap()
        exit_button = frame.get_by_label("Game menu").get_by_role("button", name="Exit fullscreen")
        expect(exit_button).to_be_visible()
        exit_button.tap()
        expect(exit_button).not_to_be_visible()
        frame.get_by_role("button", name="New game", exact=True).tap()
        frame.get_by_role("button", name="02 Cryo").tap()
        expect(frame.get_by_label("Stage selection")).to_contain_text("CRYO SHADE")
        expect(frame.get_by_role("button", name="02 Cryo")).to_have_attribute("aria-pressed", "true")
        expect(frame.get_by_role("button", name="12 Omega")).to_be_visible()
        assert frame.get_by_label("Stage selection").evaluate("(e) => e.scrollHeight <= e.clientHeight + 1")
        frame.get_by_role("button", name="Play selected stage").tap()
        expect(frame.get_by_label("Move left")).to_be_visible()
        expect(frame.get_by_label("Next weapon")).to_be_visible()
        positions = frame.locator(".game-surface").evaluate("""(surface) => {
            const canvas = surface.querySelector('canvas').getBoundingClientRect();
            return [...surface.querySelectorAll('.rune-control-touch button:not([hidden])')]
                .map(button => ({id: button.dataset.controlTouch, y: button.getBoundingClientRect().top, bottom: canvas.bottom}));
        }""")
        assert positions and all(item["y"] >= item["bottom"] - 1 for item in positions), positions
        page.goto(f"{base}/{locale}marble-run/")
        page.locator(".example-preview").element_handle().content_frame().wait_for_function("window.__RunePixel3D?.app.state")
        frame = page.frame_locator(".example-preview")
        frame.locator(".toolbar [data-pixel-fullscreen]").tap()
        exit_button = frame.locator(".title-actions").get_by_role("button", name="Exit fullscreen")
        expect(exit_button).to_be_visible()
        exit_button.tap()
        expect(exit_button).not_to_be_visible()
        frame.get_by_role("button", name="Start", exact=True).tap()
        expect(frame.get_by_label("Move joystick")).to_be_visible()
        positions = frame.locator(".game-surface").evaluate("""(surface) => {
            const canvas = surface.querySelector('canvas').getBoundingClientRect();
            return [...surface.querySelectorAll('.rune-control-touch button:not([hidden])')]
                .map(button => ({id: button.dataset.controlTouch, y: button.getBoundingClientRect().top, bottom: canvas.bottom}));
        }""")
        assert positions and all(item["y"] >= item["bottom"] - 1 for item in positions), positions
        frame.get_by_label("Pause game", exact=True).tap()
        expect(frame.locator(".pause-menu")).to_be_visible()
        frame.locator(".pause-menu").get_by_role("button", name="Resume / P").tap()
        assert not errors, errors
        context.close()
    context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    context.add_init_script(
        "HTMLElement.prototype.requestFullscreen = undefined; HTMLElement.prototype.webkitRequestFullscreen = undefined"
    )
    page = context.new_page()
    for game in ["neon-circuit", "marble-run"]:
        page.goto(f"{base}/{game}/")
        page.locator(".example-preview").element_handle().content_frame().wait_for_function("window.__RunePixel3D?.app.state")
        frame = page.frame_locator(".example-preview")
        frame.locator(".toolbar [data-pixel-fullscreen]").tap()
        expect(page.locator("iframe.example-preview")).to_have_class("example-preview iframe-fullscreen")
        title_menu = frame.get_by_label("Game menu") if game == "neon-circuit" else frame.locator(".title-actions")
        exit_button = title_menu.get_by_role("button", name="Exit fullscreen")
        expect(exit_button).to_be_visible()
        exit_button.tap()
        expect(page.locator("iframe.example-preview")).not_to_have_class("example-preview iframe-fullscreen")
        expect(exit_button).not_to_be_visible()
    context.close()
    browser.close()
print("Localized site iframes: mobile stage selection, gameplay and pause passed")
