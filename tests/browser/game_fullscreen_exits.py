"""Verify touch-accessible fullscreen exits in other Pixel 3D games."""
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
games = {
    "dog_walker": ("examples/games/dog_walker/dog_walker.rune", ".launch", "Start walk"),
    "skybound_2": ("examples/games/skybound_2/skybound_2.rune", ".atlas", "Explore destination / Enter"),
    "rune_crypt": ("examples/games/rune_crypt/rune_crypt.rune", None, None),
}

with tempfile.TemporaryDirectory(prefix="game-fullscreen-") as directory, sync_playwright() as pw:
    browser = pw.chromium.launch()
    for fallback in [False, True]:
        for game, (source, start_container, start_name) in games.items():
            path = Path(directory) / f"{game}.html"
            path.write_bytes(subprocess.check_output([str(ROOT / "target/debug/vectrune"), str(ROOT / source), "-o", "html"]))
            context = browser.new_context(viewport={"width": 844, "height": 390}, has_touch=True, is_mobile=True)
            if fallback:
                context.add_init_script("HTMLElement.prototype.requestFullscreen = undefined; HTMLElement.prototype.webkitRequestFullscreen = undefined")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(path.as_uri())
            page.wait_for_function("window.__RunePixel3D?.app.state")
            page.locator(".toolbar [data-pixel-fullscreen]").tap()
            page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
            title_exit = page.locator(".fullscreen-exit:visible").first
            expect(title_exit).to_be_visible()
            title_exit.tap()
            page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
            if game == "rune_crypt":
                page.locator("canvas").focus()
                page.keyboard.press("Enter")
            else:
                page.locator(start_container).get_by_role("button", name=start_name).tap()
            page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
            page.locator(".toolbar [data-pixel-fullscreen]").tap()
            page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
            if game == "rune_crypt":
                expect(page.locator(".fullscreen-exit-hud")).not_to_be_visible()
            page.locator('[data-control-touch="pause"]').tap()
            page.wait_for_function("__RunePixel3D.paused")
            exit_button = page.locator(".pause-menu").get_by_role("button", name="Exit fullscreen")
            expect(exit_button).to_be_visible()
            exit_button.tap()
            page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
            expect(page.locator(".pause-menu")).to_be_visible()
            assert not errors, (game, errors)
            context.close()
    browser.close()
print("Touch fullscreen exits work at title and paused gameplay in native and fallback modes")
