"""Exercise Neon Circuit and Marble Run's real phone controls and menus."""
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = ROOT / "target/debug/vectrune"

with tempfile.TemporaryDirectory(prefix="mobile-game-controls-") as directory, sync_playwright() as pw:
    browser = pw.chromium.launch()
    for game in ["neon_circuit", "marble_run"]:
        source = ROOT / f"examples/games/{game}/{game}.rune"
        path = Path(directory) / f"{game}.html"
        path.write_bytes(subprocess.check_output([str(BINARY), str(source), "-o", "html"]))
        for width, height in [(320, 700), (390, 844), (844, 390)]:
            context = browser.new_context(viewport={"width": width, "height": height}, has_touch=True, is_mobile=True)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(path.as_uri())
            page.wait_for_function("window.__RunePixel3D?.app.state")
            title_menu = page.get_by_label("Game menu") if game == "neon_circuit" else page.locator(".title-actions")
            exit_button = title_menu.get_by_role("button", name="Exit fullscreen")
            expect(exit_button).not_to_be_visible()
            page.locator(".toolbar [data-pixel-fullscreen]").tap()
            page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
            expect(exit_button).to_be_visible()
            exit_button.tap()
            page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
            expect(exit_button).not_to_be_visible()
            if game == "neon_circuit":
                assert page.get_by_label("Game menu").evaluate(
                    "(e) => getComputedStyle(e).backgroundColor"
                ) == "rgb(16, 10, 39)"
                menu_box = title_menu.bounding_box()
                canvas_box = page.locator("canvas").bounding_box()
                assert menu_box["height"] <= canvas_box["height"] * 0.51
                assert menu_box["y"] >= canvas_box["y"] + canvas_box["height"] * 0.49
                page.get_by_role("button", name="New game", exact=True).tap()
                expect(page.get_by_label("Stage selection")).to_be_visible()
                expect(page.get_by_role("button", name="01 Volt")).to_have_attribute("aria-pressed", "true")
                if width <= 480:
                    stage_menu = page.get_by_label("Stage selection")
                    assert stage_menu.evaluate("(e) => getComputedStyle(e).position") == "relative"
                    assert stage_menu.locator(".mobile-stage-grid").evaluate(
                        "(e) => getComputedStyle(e).gridTemplateColumns.split(' ').length"
                    ) == 2
                    assert stage_menu.evaluate("(e) => e.scrollHeight <= e.clientHeight + 1")
                    expect(page.get_by_role("button", name="12 Omega")).to_be_visible()
                page.locator(".toolbar [data-pixel-fullscreen]").tap()
                page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
                exit_button = page.get_by_label("Stage selection").get_by_role("button", name="Exit fullscreen")
                expect(exit_button).to_be_visible()
                exit_button.tap()
                page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
                page.get_by_role("button", name="07 Storm").tap()
                expect(page.get_by_label("Stage selection")).to_contain_text("STORM VALKYRIE")
                expect(page.get_by_role("button", name="07 Storm")).to_have_attribute("aria-pressed", "true")
                expect(page.get_by_role("button", name="01 Volt")).to_have_attribute("aria-pressed", "false")
                expect(page.get_by_label("Stage selection")).to_contain_text("TIER 2 MASTER")
                page.get_by_role("button", name="Play selected stage").tap()
                page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
                expect(page.get_by_label("Move left")).to_be_visible()
                expect(page.get_by_label("Move right")).to_be_visible()
                expect(page.get_by_label("Aim or climb up")).to_be_visible()
                expect(page.get_by_label("Duck or climb down")).to_be_visible()
                expect(page.get_by_label("Next weapon")).to_be_visible()
                weapon = page.get_by_label("Next weapon")
                pause = page.get_by_label("Pause game", exact=True)
                weapon_box, pause_box = weapon.bounding_box(), pause.bounding_box()
                assert weapon_box["x"] + weapon_box["width"] <= pause_box["x"]
                assert abs(weapon_box["y"] - pause_box["y"]) <= 1
                assert "radial-gradient" in weapon.evaluate("(e) => getComputedStyle(e).backgroundImage")
                assert page.locator('[data-control-touch="joystick"]').count() == 0
                controls = ["left", "right", "up", "down", "jump", "fire", "next_weapon"]
            else:
                page.get_by_role("button", name="Levels", exact=True).tap()
                expect(page.get_by_label("Level selector")).to_be_visible()
                page.locator(".toolbar [data-pixel-fullscreen]").tap()
                page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
                exit_button = page.get_by_label("Level selector").get_by_role("button", name="Exit fullscreen")
                expect(exit_button).to_be_visible()
                exit_button.tap()
                page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
                page.locator('[data-pixel-args="[6]"]').tap()
                expect(page.get_by_role("button", name="Play selected / Enter")).to_be_disabled()
                if width <= 480:
                    assert page.locator(".course-grid").evaluate(
                        "(e) => getComputedStyle(e).gridTemplateColumns.split(' ').length"
                    ) == 2
                page.locator('[data-pixel-args="[1]"]').first.tap()
                page.get_by_role("button", name="Play selected / Enter").tap()
                page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
                expect(page.get_by_label("Move joystick")).to_be_visible()
                controls = ["joystick", "jump", "charge"]

            for name in controls:
                expect(page.locator(f'[data-control-touch="{name}"]')).to_be_visible()
            boxes = [page.locator(f'[data-control-touch="{name}"]').bounding_box() for name in controls]
            canvas = page.locator("canvas[data-rune-pixel-3d]").bounding_box()
            surface = page.locator(".game-surface").bounding_box()
            for name, box in zip(controls, boxes):
                assert box["width"] >= 44 and box["height"] >= 44, (game, width, name, box)
                assert box["x"] >= canvas["x"] - 1 and box["x"] + box["width"] <= canvas["x"] + canvas["width"] + 1
                if width <= 480:
                    assert box["y"] >= canvas["y"] + canvas["height"] - 1, (game, width, name, box, canvas)
                    assert box["y"] + box["height"] <= surface["y"] + surface["height"] + 1
                else:
                    assert box["y"] >= canvas["y"] - 1 and box["y"] + box["height"] <= canvas["y"] + canvas["height"] + 1
            for index, first in enumerate(boxes):
                for second in boxes[index + 1:]:
                    overlap_x = min(first["x"] + first["width"], second["x"] + second["width"]) - max(first["x"], second["x"])
                    overlap_y = min(first["y"] + first["height"], second["y"] + second["height"]) - max(first["y"], second["y"])
                    assert overlap_x <= 0 or overlap_y <= 0, (game, width, first, second)
            if width <= 480:
                page.locator(".toolbar [data-pixel-fullscreen]").tap()
                page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
                overlay = page.locator(".rune-control-touch").bounding_box()
                full_canvas = page.locator("canvas[data-rune-pixel-3d]").bounding_box()
                assert abs(overlay["y"] - full_canvas["y"]) <= 1
                assert abs(overlay["height"] - full_canvas["height"]) <= 1
            page.get_by_label("Pause game", exact=True).tap()
            page.wait_for_function("__RunePixel3D.paused")
            if game == "neon_circuit":
                expect(page.get_by_label("Pause menu")).to_be_visible()
                exit_button = page.get_by_label("Pause menu").get_by_role("button", name="Exit fullscreen")
                if width > 480:
                    page.locator(".toolbar [data-pixel-fullscreen]").tap()
                page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
                expect(exit_button).to_be_visible()
                exit_button.tap()
                page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
                page.get_by_label("Pause menu").get_by_role("button", name="Resume").tap()
            else:
                exit_button = page.locator(".pause-menu").get_by_role("button", name="Exit fullscreen")
                if width > 480:
                    page.locator(".toolbar [data-pixel-fullscreen]").tap()
                page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
                expect(exit_button).to_be_visible()
                exit_button.tap()
                page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
                page.locator(".pause-menu").get_by_role("button", name="Resume / P").tap()
            page.wait_for_function("!__RunePixel3D.paused")
            if game == "neon_circuit":
                page.evaluate("""() => {
                    __RunePixel3D.app.state.campaign.weapons.volt = true;
                    __RunePixel3D.invoke('refresh_ui');
                }""")
                expect(page.locator('[data-control-touch="dash"]')).to_be_visible()
                weapon_box = page.get_by_label("Next weapon").bounding_box()
                cdp = context.new_cdp_session(page)
                cdp.send("Input.dispatchTouchEvent", {
                    "type": "touchStart", "touchPoints": [{"x": weapon_box["x"] + 2, "y": weapon_box["y"] + 2}]
                })
                page.wait_for_timeout(160)
                cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
                page.wait_for_function('__RunePixel3D.app.state.active_weapon === "volt"')
                assert page.evaluate("""() => {
                    const left = document.querySelector('[data-control-touch="left"]');
                    const fire = document.querySelector('[data-control-touch="fire"]');
                    const send = (target, type, id) => target.dispatchEvent(new PointerEvent(type, {
                        bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch'
                    }));
                    send(left, 'pointerdown', 11);
                    send(fire, 'pointerdown', 12);
                    const held = __RunePixel3D.controls.sample(1 / 30);
                    send(left, 'pointerup', 11);
                    send(fire, 'pointerup', 12);
                    const released = __RunePixel3D.controls.sample(1 / 30);
                    return held.left && held.fire && !released.left && !released.fire;
                }""")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            assert not errors, errors
            context.close()
    browser.close()
print("Phone game menus, movement controls, actions and pause passed in portrait and landscape")
