"""Escape exits native and CSS-fallback fullscreen, including toolbar focus."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="pixel3d-fullscreen-") as folder, sync_playwright() as pw:
    html = subprocess.run(
        [str(ROOT / "target/debug/vectrune"), str(ROOT / "examples/games/skybound_2/skybound_2.rune"), "-o", "html"],
        capture_output=True, text=True, check=True,
    ).stdout
    game = Path(folder) / "game.html"
    game.write_text(html)
    browser = pw.chromium.launch()
    errors = []
    for mode in ["native", "unavailable", "denied"]:
        page = browser.new_page(viewport={"width": 1100, "height": 900})
        page.on("pageerror", lambda error: errors.append(str(error)))
        if mode == "unavailable":
            page.add_init_script("HTMLElement.prototype.requestFullscreen=undefined;HTMLElement.prototype.webkitRequestFullscreen=undefined")
        elif mode == "denied":
            page.add_init_script("HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('Fullscreen denied by embed'))")
        page.goto(game.as_uri())
        page.wait_for_function('typeof __RunePixel3D !== "undefined"')
        original_overflow = page.evaluate("getComputedStyle(document.documentElement).overflow")
        page.locator("[data-pixel-fullscreen]").click()
        if mode == "native":
            page.wait_for_function("document.fullscreenElement !== null")
        else:
            expect(page.locator(".game-surface")).to_have_class("game-surface rune-pixel3d-surface rune-pixel3d-expanded")
            assert page.evaluate("document.activeElement.hasAttribute('data-pixel-fullscreen')")
        page.keyboard.press("Escape")
        page.wait_for_function("!document.fullscreenElement && !document.documentElement.classList.contains('rune-pixel3d-expanded-page')")
        assert page.evaluate("getComputedStyle(document.documentElement).overflow") == original_overflow
        assert page.evaluate("__RunePixel3D.app.state.phase") == "map"
        # The same shortcut also works while playing with the canvas focused.
        page.locator(".atlas [data-pixel-start]").click()
        page.locator("canvas").focus()
        page.keyboard.press("f")
        page.wait_for_function("document.fullscreenElement !== null || document.documentElement.classList.contains('rune-pixel3d-expanded-page')")
        page.keyboard.press("Escape")
        page.wait_for_function("!document.fullscreenElement && !document.documentElement.classList.contains('rune-pixel3d-expanded-page')")
        assert page.evaluate("__RunePixel3D.app.state.phase") == "playing"
        expect(page.locator(".pause-menu")).not_to_be_visible()
        page.close()
    assert not errors, errors
    browser.close()
print("Pixel 3D Escape: native, unavailable and denied fullscreen; toolbar/canvas focus passed")
