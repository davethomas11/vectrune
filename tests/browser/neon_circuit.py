"""Neon Circuit: browser end-to-end playthrough, in-engine menus, weapon UI, pixel explosions & boss ceremony."""
from pathlib import Path
import os
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ENTRY = ROOT / "examples/games/neon_circuit/neon_circuit.rune"
SHOTS_DIR = os.environ.get("NEON_CIRCUIT_SHOTS")

with tempfile.TemporaryDirectory(prefix="neon-circuit-") as folder, sync_playwright() as pw:
    html = subprocess.run(
        ["vectrune", str(ENTRY), "-o", "html"],
        capture_output=True, text=True, check=True,
    ).stdout
    game_file = Path(folder) / "neon_circuit.html"
    game_file.write_text(html, encoding="utf-8")

    try:
        browser = pw.chromium.launch()
    except Exception:
        browser = pw.chromium.launch(channel="msedge")
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))

    page.goto(game_file.as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined" && __RunePixel3D.app.state.ticks >= 2')

    # 1. Title screen rendered in-engine with outline active and no DOM overlay buttons
    assert page.evaluate("__RunePixel3D.app.state.status") == "title"
    assert page.evaluate("__RunePixel3D.raycaster.outlineRadius") > 0
    assert page.locator(".selector-overlay, .weapon-bar, .pause-menu, .launch").count() == 0
    canvas = page.locator("canvas[data-rune-pixel-3d]")
    if SHOTS_DIR:
        Path(SHOTS_DIR).mkdir(parents=True, exist_ok=True)
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "01_title.png"))

    # 2. Click canvas to enter in-engine 12-Robot Stage Select
    canvas.click()
    page.wait_for_function('__RunePixel3D.app.state.status === "select"')
    assert page.evaluate("__RunePixel3D.app.state.ui.grid.items.length") == 12

    # Click robot #07 (Storm Valkyrie, index 6 = row 1, col 0) inside the canvas grid!
    box = canvas.bounding_box()
    assert box is not None
    w = page.evaluate("__RunePixel3D.config.width")
    h = page.evaluate("__RunePixel3D.config.height")
    assert w == 576 and h == 360
    # Grid item 6 is col 0, row 1; item 0 is col 0, row 0 near bottom of canvas
    click_x = box["x"] + box["width"] * (55 / w)
    click_y = box["y"] + box["height"] * ((h - 40) / h)
    page.mouse.click(click_x, click_y)
    page.wait_for_function("__RunePixel3D.app.state.selected_stage === 6")
    hint = page.evaluate("__RunePixel3D.app.state.selected_hint")
    assert "VOLT SURGE + MAG CLAW" in hint, hint
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "02_stage_select.png"))

    # Switch back to Stage 01 (col 0, row 0) and click again to launch!
    page.mouse.click(box["x"] + box["width"] * (55 / w), box["y"] + box["height"] * ((h - 66) / h))
    page.wait_for_function("__RunePixel3D.app.state.selected_stage === 0")
    page.mouse.click(box["x"] + box["width"] * (55 / w), box["y"] + box["height"] * ((h - 66) / h))
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')

    # 3. Verify movement, jump, firing, weapon wheel, and hotkey / number select
    assert page.evaluate("__RunePixel3D.app.state.ui.wheel.items.length") == 7
    assert page.evaluate("__RunePixel3D.app.state.ui.slots.length") == 0
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_stage_01"
    # Weapon wheel hold Tab, number select, and release
    page.keyboard.down("Tab")
    page.wait_for_function("__RunePixel3D.app.state.wheel_open === true")
    assert page.evaluate("__RunePixel3D.app.state.ui.wheel.active === true")
    page.keyboard.press("Digit1")
    assert page.evaluate("__RunePixel3D.app.state.active_weapon === 'buster'")
    page.keyboard.up("Tab")
    page.wait_for_function("__RunePixel3D.app.state.wheel_open === false")
    start_x = page.evaluate("__RunePixel3D.app.state.player.x")
    page.keyboard.down("d")
    page.wait_for_function(f"__RunePixel3D.app.state.player.x > {start_x + 1.0}")
    page.keyboard.up("d")
    page.keyboard.press("x")
    page.wait_for_function("__RunePixel3D.app.state.shots.length > 0 || __RunePixel3D.app.state.cooldown > 0")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "03_gameplay.png"))

    # 3b. Climb a Mega Man ladder all the way to the top cap (no bounce!), walk off, then test death/respawn
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.player.x = 22.5;
      s.player.z = 2.0;
      for (let i = 0; i < 10; i++) g.step({ aim_up: true });
    }""")
    assert page.evaluate("__RunePixel3D.app.state.select_boss.visible === false")
    assert page.evaluate("__RunePixel3D.app.state.on_ladder === true")
    assert page.evaluate('__RunePixel3D.app.state.avatar.model.startsWith("nc/hero_climb")')
    assert page.evaluate("__RunePixel3D.app.state.player.z > 2.8")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "03b_ladder_climb.png"))

    # Continue holding aim_up past top of ladder: must disembark cleanly at z=7.0 without bouncing!
    page.evaluate("""() => {
      const g = __RunePixel3D;
      for (let i = 0; i < 28; i++) g.step({ aim_up: true });
    }""")
    assert page.evaluate("__RunePixel3D.app.state.on_ladder === false")
    assert page.evaluate("__RunePixel3D.app.state.grounded === true")
    assert page.evaluate("Math.abs(__RunePixel3D.app.state.player.z - 7.0) < 0.05")
    page.evaluate("""() => {
      const g = __RunePixel3D;
      for (let i = 0; i < 6; i++) g.step({ right: true });
    }""")
    assert page.evaluate("__RunePixel3D.app.state.player.x > 23.2 && Math.abs(__RunePixel3D.app.state.player.z - 7.0) < 0.05")

    # Trigger player death away from spawn -> verify radial death orbs, camera pan, then respawn beam
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.invulnerable = 0;
      g.invoke('hurt_player', [8]);
      for (let i = 0; i < 4; i++) g.step({});
    }""")
    assert page.evaluate('__RunePixel3D.app.state.status === "player_dying"')
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "03c_player_death.png"))
    page.evaluate("""() => {
      const g = __RunePixel3D;
      for (let i = 0; i < 60 && g.app.state.status !== 'player_respawn'; i++) g.step({});
    }""")
    assert page.evaluate('__RunePixel3D.app.state.status === "player_respawn"')
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "03d_respawn_beam.png"))
    page.evaluate("""() => {
      const g = __RunePixel3D;
      for (let i = 0; i < 60 && g.app.state.status !== 'playing'; i++) g.step({});
    }""")
    assert page.evaluate('__RunePixel3D.app.state.status === "playing"')
    assert page.evaluate('__RunePixel3D.app.state.player.x === __RunePixel3D.app.state.checkpoint.x')

    # 4. In-engine Pause Menu via Escape (with 5 options including Quit to Title & Restart)
    page.keyboard.press("Escape")
    page.wait_for_function("__RunePixel3D.paused === true")
    assert page.evaluate("__RunePixel3D.app.state.pause_ui.panel.choices.length") == 5
    # Verify ArrowDown navigates pause menu and Escape unpauses cleanly
    page.keyboard.press("ArrowDown")
    page.wait_for_function("__RunePixel3D.app.state.pause_selected === 1")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "04_pause.png"))
    page.keyboard.press("Escape")
    page.wait_for_function("__RunePixel3D.paused === false")

    # 5. Defeat an enemy -> verify pixel explosion debris + blast effects
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      const e = s.enemies[0];
      s.player.x = e.x - 1.5;
      s.player.z = e.z;
      e.hp = 1;
      s.cooldown = 0;
      g.invoke('fire_weapon', [false]);
      for (let i = 0; i < 6; i++) g.step({});
    }""")
    assert page.evaluate("__RunePixel3D.app.state.enemies[0].alive === false")
    assert page.evaluate("__RunePixel3D.app.state.effects.some(f => f.kind === 'debris')")

    # 6. Walk past Boss Airlock Door (x=96) into enclosed Boss Room, verify shutter locks & boss engages!
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.player.x = 98.0;
      s.player.z = 2.0;
      s.health = 8;
      s.invulnerable = 120;
      for (let i = 0; i < 65; i++) g.step({});
    }""")
    assert page.evaluate("__RunePixel3D.app.state.boss_door_locked === true")
    assert page.evaluate("__RunePixel3D.app.state.boss_active === true")
    assert page.evaluate("__RunePixel3D.app.state.boss_satellites.length") == 3
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "04b_boss_fight.png"))

    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.player.x = s.boss_entity.x - 4;
      s.player.z = s.boss_entity.z;
      s.boss_entity.hp = 1;
      s.boss_active = true;
      g.invoke('on_boss_defeated', []);
    }""")
    assert page.evaluate("__RunePixel3D.app.state.status") == "boss_dying"
    page.evaluate("() => { for (let i = 0; i < 30; i++) __RunePixel3D.step({}); }")
    assert page.evaluate("__RunePixel3D.app.state.boss_entity.dissolve > 0.3")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05_boss_dying.png"))

    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      while (s.status === 'boss_dying') g.step({});
      for (let i = 0; i < 12; i++) g.step({});
      g.frame();
    }""")
    assert page.evaluate("__RunePixel3D.app.state.status") == "escape_flip"
    assert page.evaluate("__RunePixel3D.app.state.escape_floor.length > 0")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05b_escape_flip.png"))

    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      while (s.status === 'escape_flip') { g.step({}); g.frame(); }
    }""")
    assert page.evaluate("__RunePixel3D.app.state.status") == "escape"
    assert page.evaluate("__RunePixel3D.app.state.camera.pitch") == -42
    assert page.evaluate("__RunePixel3D.app.state.camera.angle") == 238
    # Exercise full isometric movement, jump, and all hero_run0..hero_run3 frames through actual renderer
    page.evaluate("""() => {
      const g = __RunePixel3D;
      for (let i = 0; i < 16; i++) {
        g.step({ left: true, aim_up: i < 8, duck: i >= 8, jump: i === 4 });
        g.frame();
      }
    }""")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05c_escape_isometric.png"))

    # Axel navigates back to start container in top-down isometric view and collects power core
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.player.x = 4.5;
      s.player.y = 7.0;
      g.step({});
    }""")
    assert page.evaluate("__RunePixel3D.app.state.status") == "boss_victory"
    assert page.evaluate("__RunePixel3D.app.state.power_capsule.model") == "nc/power_capsule_open"
    assert page.evaluate("__RunePixel3D.app.state.avatar.model") == "nc/hero_victory"
    assert page.evaluate("__RunePixel3D.app.state.avatar.x === __RunePixel3D.app.state.player.x")
    assert "VOLT VIPER DEFEATED" in page.evaluate("__RunePixel3D.app.state.ui.panel.title")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "06_boss_victory.png"))

    # Finish victory -> stage_clear -> open_select -> equip unlocked weapon #2 via key Digit2
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "stage_clear"')
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "select"')
    # Check Cryo Shade (stage 2 = idx 1) boss doorway opens smoothly for walking straight in (no step blocking D)
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      g.invoke('load_stage', [1]);
      s.player.x = 94.5;
      s.player.z = 2.0;
      g.step({});
      for (let i = 0; i < 24; i++) g.step({ right: true });
    }""")
    assert page.evaluate("__RunePixel3D.app.state.player.x >= 97.6")
    assert page.evaluate("__RunePixel3D.app.state.boss_door_locked === true")
    page.evaluate("__RunePixel3D.invoke('open_select')")
    page.wait_for_function('__RunePixel3D.app.state.status === "select"')
    page.evaluate("__RunePixel3D.invoke('pick_stage', [0])")

    # Launch Stage 07 (Storm Valkyrie) and test visible weapon switching between Buster (1) and Volt Surge (2)
    page.keyboard.press("ArrowDown")
    page.wait_for_function("__RunePixel3D.app.state.selected_stage === 6")
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    page.keyboard.press("Digit1")
    page.wait_for_function('__RunePixel3D.app.state.active_weapon === "buster"')
    page.keyboard.press("Digit2")
    page.wait_for_function('__RunePixel3D.app.state.active_weapon === "volt"')
    assert page.evaluate('__RunePixel3D.app.state.avatar.visible === true')
    assert page.evaluate('__RunePixel3D.app.state.notice_text') == "EQUIPPED: VOLT SURGE"
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "07_volt_equipped.png"))

    # Verify persistence survives page reload and Title offers CONTINUE + NEW GAME with erase confirmation
    page.reload()
    page.wait_for_function('typeof __RunePixel3D !== "undefined" && __RunePixel3D.app.state.status === "title"')
    assert page.evaluate('__RunePixel3D.app.state.campaign.weapons.volt === true && __RunePixel3D.app.state.campaign.defeated["01"] === true')
    assert page.evaluate('__RunePixel3D.app.state.has_progress === true')
    assert page.evaluate('__RunePixel3D.app.state.ui.panel.choices.length') == 2
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "08_title_continue.png"))

    # Select NEW GAME -> opens "Are you sure? This will erase last progress" prompt
    canvas.click()
    page.keyboard.press("ArrowDown")
    page.wait_for_function("__RunePixel3D.app.state.title_selected === 1")
    page.keyboard.press("Enter")
    page.wait_for_function("__RunePixel3D.app.state.title_confirm === true")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "09_title_confirm_erase.png"))

    # Escape cancels erase warning safely preserving progress
    page.keyboard.press("Escape")
    page.wait_for_function("__RunePixel3D.app.state.title_confirm === false")
    assert page.evaluate('__RunePixel3D.app.state.campaign.defeated["01"] === true')

    # Continue into Stage Select, verify Escape returns back to Title, then use Pause -> Quit to Title
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "select"')
    page.keyboard.press("Escape")
    page.wait_for_function('__RunePixel3D.app.state.status === "title"')

    # Launch Stage 01 via Continue, pause with Escape, and Quit to Title via Pause Menu (option 4)
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "select"')
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    page.keyboard.press("Escape")
    page.wait_for_function("__RunePixel3D.paused === true")
    for _ in range(4):
        page.keyboard.press("ArrowDown")
    page.wait_for_function("__RunePixel3D.app.state.pause_selected === 4")
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "title" && __RunePixel3D.paused === false')

    # Finally confirm NEW GAME erases progress cleanly
    page.keyboard.press("ArrowDown")
    page.wait_for_function("__RunePixel3D.app.state.title_selected === 1")
    page.keyboard.press("Enter")
    page.wait_for_function("__RunePixel3D.app.state.title_confirm === true")
    page.keyboard.press("ArrowDown")
    page.wait_for_function("__RunePixel3D.app.state.title_selected === 1")
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "select" && __RunePixel3D.app.state.defeated_count === 0')
    assert page.evaluate('__RunePixel3D.app.state.campaign.weapons.volt === false')

    assert not errors, errors
    browser.close()
    print("Neon Circuit browser verification passed cleanly!")
