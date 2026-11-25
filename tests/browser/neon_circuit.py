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
    assert page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      const lit = g.frame().slice(), lights = s.title_lights;
      s.title_lights = [];
      try {
        const unlit = g.frame();
        let changed = 0;
        for (let i = 0; i < lit.length; i++) if (lit[i] !== unlit[i]) changed++;
        return changed > 1000;
      } finally {
        s.title_lights = lights;
        g.invalidateFrame();
      }
    }""")
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
    assert page.evaluate("__RunePixel3D.app.state.lights[2].color") == "#20e9ff"

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
    assert page.evaluate("__RunePixel3D.app.state.lights[2].color") == "#ffdb64"
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "02_stage_select.png"))

    # Switch back to Stage 01 (col 0, row 0) and click again to launch!
    page.mouse.click(box["x"] + box["width"] * (55 / w), box["y"] + box["height"] * ((h - 66) / h))
    page.wait_for_function("__RunePixel3D.app.state.selected_stage === 0")
    page.mouse.click(box["x"] + box["width"] * (55 / w), box["y"] + box["height"] * ((h - 66) / h))
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')

    # The entrance lamps must cast both colors onto geometry on the first scene.
    assert page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      const lit = g.frame().slice(), lights = s.lights;
      s.lights = [];
      try {
        const unlit = g.frame();
        let cyan = 0, magenta = 0;
        for (let i = 0; i < lit.length; i++) {
          const red = (lit[i] & 255) - (unlit[i] & 255);
          const green = ((lit[i] >>> 8) & 255) - ((unlit[i] >>> 8) & 255);
          const blue = ((lit[i] >>> 16) & 255) - ((unlit[i] >>> 16) & 255);
          if (green > red + 18 && blue > 26) cyan++;
          if (red > green + 18 && blue > 26) magenta++;
        }
        return cyan > 1200 && magenta > 1200;
      } finally {
        s.lights = lights;
        g.invalidateFrame();
      }
    }""")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "03_spawn_lighting.png"))

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

    # Walk into the first pit and verify player death, camera pan, then respawn.
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.player.x = 26.5;
      s.player.z = 2;
      s.player.vz = 0;
      s.invulnerable = 120;
      for (let i = 0; i < 18 && s.status === 'playing'; i++) g.step({ right: true });
    }""")
    assert page.evaluate('__RunePixel3D.app.state.status === "player_dying"')
    assert page.evaluate('__RunePixel3D.app.state.player.z < 1.5')
    assert not page.evaluate("__RunePixel3D.audioState.isPlaying")
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
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_stage_01"
    assert page.evaluate("__RunePixel3D.audioState.isPlaying")

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
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_boss"
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
      window.bossDeathSpot = [s.boss_entity.x, s.boss_entity.y, s.boss_entity.z];
    }""")
    assert page.evaluate("__RunePixel3D.app.state.status") == "boss_dying"
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_boss_victory"
    assert page.evaluate("__RunePixel3D.audioState.totalBars") == 3
    page.evaluate("() => { for (let i = 0; i < 30; i++) __RunePixel3D.step({}); }")
    assert page.evaluate("__RunePixel3D.app.state.boss_entity.dissolve > 0.3")
    assert page.evaluate("__RunePixel3D.app.state.lights[0].color") == "#ff9430"
    assert page.evaluate("""() => {
      const s = __RunePixel3D.app.state;
      const boss = s.boss_entity;
      return [boss.x, boss.y, boss.z].every((pos, i) => pos === window.bossDeathSpot[i]) &&
        s.escape_floor[4].z > 0 && s.escape_floor[4].pitch === -90;
    }""")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05_boss_dying.png"))

    page.wait_for_function('__RunePixel3D.app.state.status === "escape_flip"')
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      const world = s.world;
      const background = s.scenery.filter(sc => sc.y < 4);
      const poses = background.map(sc => JSON.stringify(sc));
      const backdrop = s.camera.backdrop;
      const backdropX = backdrop.x;
      const terrain = s.camera.terrainPose.world;
      let lastPitch = s.camera.pitch;
      let lastAngle = s.camera.terrainPose.angle;
      let sawPlayerTurn = false;
      for (let i = 0; i < 26 && s.status === 'escape_flip'; i++) {
        g.step({});
        if (s.world !== world || s.ui.cinema?.fade || Math.abs(s.camera.pitch - lastPitch) > 3.5) {
          throw new Error('The glass transition cut to a different view');
        }
        if (s.camera.terrainPose.world !== terrain || s.camera.backdrop !== backdrop || backdrop.x !== backdropX ||
            s.camera.terrainPose.angle > lastAngle || lastAngle - s.camera.terrainPose.angle > 3.1) {
          throw new Error('The hinge or side-on backdrop changed discontinuously');
        }
        lastPitch = s.camera.pitch;
        lastAngle = s.camera.terrainPose.angle;
        sawPlayerTurn ||= s.avatar.pitch > 135 && s.avatar.pitch < 235;
      }
      if (!sawPlayerTurn) throw new Error('Axel did not somersault onto the deck');
      if (background.some((sc, i) => s.scenery.indexOf(sc) < 0 || JSON.stringify(sc) !== poses[i])) {
        throw new Error('A background object moved during the shift');
      }
      window.escapeBackdrop = {world, background, poses};
      g.frame();
    }""")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05b_escape_flip.png"))
    page.wait_for_function('__RunePixel3D.app.state.status === "playing" && __RunePixel3D.app.state.escape_active')
    assert page.evaluate("""() => {
      const s = __RunePixel3D.app.state;
      const {world, background, poses} = window.escapeBackdrop;
      return s.world === world && background.every((sc, i) => s.scenery.includes(sc) && JSON.stringify(sc) === poses[i]);
    }""")
    assert page.evaluate("__RunePixel3D.app.state.camera.pitch") == -85
    assert page.evaluate("__RunePixel3D.app.state.camera.terrainPose.angle") == -90
    assert page.evaluate("__RunePixel3D.app.state.avatar.pitch") == 0
    assert page.evaluate("__RunePixel3D.app.state.avatar.z === __RunePixel3D.app.state.escape_deck_z")
    assert page.evaluate("__RunePixel3D.app.state.camera.angle") == 270
    assert page.evaluate("__RunePixel3D.app.state.escape_floor.length") > 0
    assert page.evaluate("__RunePixel3D.app.state.escape_floor.every(pane => pane.pitch === 0)")
    assert page.evaluate("__RunePixel3D.app.state.enemies.every(e => e.visible && e.z === __RunePixel3D.app.state.escape_deck_z)")
    assert page.evaluate("__RunePixel3D.app.state.campaign.weapons.volt") is False
    assert page.evaluate("__RunePixel3D.app.state.lights[0].x === __RunePixel3D.app.state.power_capsule.x")
    assert page.evaluate("__RunePixel3D.app.state.lights[2].color") == "#ff2845"
    assert page.evaluate("__RunePixel3D.app.state.ui.countdown > 74")
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_escape"
    assert page.evaluate("__RunePixel3D.audioState.tempo") == 132
    assert page.evaluate("__RunePixel3D.audioState.totalBars") == 8

    canvas.focus()
    page.keyboard.down("Tab")
    page.wait_for_function("__RunePixel3D.app.state.wheel_open && __RunePixel3D.app.state.ui.wheel.active")
    clock = page.evaluate("__RunePixel3D.app.state.escape_ticks")
    assert page.evaluate("""clock => {
      __RunePixel3D.step({weapon_wheel:true});
      return __RunePixel3D.app.state.escape_ticks === clock;
    }""", clock)
    page.keyboard.up("Tab")
    page.wait_for_function("!__RunePixel3D.app.state.wheel_open")
    page.keyboard.down("Space")
    page.wait_for_function("__RunePixel3D.app.state.player.z > __RunePixel3D.app.state.escape_deck_z")
    page.keyboard.up("Space")
    page.wait_for_function("__RunePixel3D.app.state.player.z === __RunePixel3D.app.state.escape_deck_z")

    # The overhead leg still accepts real keyboard, mouse and pause input.
    start_x = page.evaluate("__RunePixel3D.app.state.player.x")
    page.keyboard.down("a")
    page.wait_for_function(f"__RunePixel3D.app.state.player.x < {start_x - 0.5}")
    page.keyboard.up("a")
    assert page.evaluate("__RunePixel3D.app.state.lights[1].x === __RunePixel3D.app.state.player.x")
    page.keyboard.down("s")
    page.wait_for_function("__RunePixel3D.app.state.player.y > 3.1")
    page.keyboard.up("s")
    page.keyboard.down("w")
    page.wait_for_function("__RunePixel3D.app.state.player.y < 2.65")
    page.keyboard.up("w")
    page.keyboard.down("d")
    page.wait_for_function("__RunePixel3D.app.state.escape_angle === 0")
    page.keyboard.up("d")
    canvas.click()
    page.wait_for_function("__RunePixel3D.app.state.cooldown > 0")
    page.keyboard.press("Escape")
    page.wait_for_function("__RunePixel3D.paused === true")
    assert page.evaluate("""() => {
      const g = __RunePixel3D, before = g.app.state.escape_ticks;
      g.step({});
      return g.app.state.escape_ticks === before;
    }""")
    page.keyboard.press("Escape")
    page.wait_for_function("__RunePixel3D.paused === false")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05c_escape_glass_deck.png"))

    # The same gap is now covered. Cross it toward the entrance on the glass.
    assert page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.player.x = 31.5;
      s.player.y = 2.5;
      s.camera.backdrop.x += s.player.x - s.camera.x;
      s.camera.x = s.player.x;
      const lives = s.lives;
      for (let i = 0; i < 20; i++) g.step({ left: true });
      return s.player.x < 27 && s.player.z === s.escape_deck_z && s.lives === lives &&
        s.escape_floor.filter(pane =>
          pane.model === 'nc/glass_pit_cover' && pane.x >= 27 && pane.x < 31
        ).length === 4;
    }""")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05c_escape_pit_cover.png"))

    # Force the last tick of the timer and retry from the boss room with Enter.
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.escape_ticks = s.escape_time_limit - 301;
      g.step({});
    }""")
    page.wait_for_function("__RunePixel3D.audioState.tempo >= 174")
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_escape"
    assert page.evaluate("__RunePixel3D.app.state.ui.countdown <= 10")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05d_urgent_countdown.png"))
    lives_before = page.evaluate("__RunePixel3D.app.state.lives")
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      s.escape_ticks = s.escape_time_limit - 1;
      g.step({});
    }""")
    assert page.evaluate("__RunePixel3D.app.state.ui.panel.choices[0]") == "TRY AGAIN"
    assert page.evaluate("__RunePixel3D.app.state.lives") == lives_before - 1
    assert not page.evaluate("__RunePixel3D.audioState.isPlaying")
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "05d_escape_timeout.png"))
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "playing" && __RunePixel3D.app.state.escape_active')
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_escape"
    assert page.evaluate("__RunePixel3D.audioState.tempo") == 132
    assert page.evaluate("__RunePixel3D.app.state.lives") == lives_before - 1
    assert page.evaluate("""() => {
      const s = __RunePixel3D.app.state;
      return s.player.x === s.escape_entry_x && s.camera.pitch === -85 &&
        !s.boss_entity.alive && s.escape_ticks < 30 && s.escape_time_limit === 2250;
    }""")

    # Play the whole return route, including combat and core collection.
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      for (let i = 0; i < 700 && s.status === 'playing'; i++) g.step({left: true, fire: true});
      g.frame();
    }""")
    assert page.evaluate("__RunePixel3D.app.state.enemies.some(e => !e.alive)")
    assert page.evaluate("__RunePixel3D.app.state.status") == "boss_victory"
    assert page.evaluate("__RunePixel3D.app.state.campaign.weapons.volt") is True
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

    # A timeout on the last life must go to Game Over, where Retry Sector starts a fresh run.
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      g.invoke('load_stage', [0]);
      g.invoke('on_boss_defeated');
      for (let i = 0; i < 120; i++) g.step({});
      s.lives = 1;
      s.escape_ticks = s.escape_time_limit - 1;
      g.step({});
    }""")
    assert page.evaluate("__RunePixel3D.app.state.status") == "gameover"
    assert page.evaluate("__RunePixel3D.app.state.ui.heading") == "GAME OVER"
    assert page.evaluate("__RunePixel3D.app.state.lives") == 0
    if SHOTS_DIR:
        canvas.screenshot(path=str(Path(SHOTS_DIR) / "10_game_over.png"))
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "playing" && !__RunePixel3D.app.state.escape_active')
    assert page.evaluate("__RunePixel3D.app.state.lives") == 3

    # Compare the rendered capsule against its silhouette with the rotated
    # walls removed. The path through the bay must still reach the pickup.
    for stage_index in range(12):
        page.evaluate("""index => {
          const g = __RunePixel3D, s = g.app.state;
          g.invoke('load_stage', [index]);
          s.player.x = s.boss_gate_x >= 0 ? s.boss_gate_x + 2 : s.boss_entity.home_x - 8;
          g.invoke('step_boss');
          const audio = g.audioState;
          if (!s.boss_active || audio.track !== (index >= 6 ? 'nc_master_boss' : 'nc_boss') ||
              (index >= 6 && (audio.timeSignature !== '3/4' || audio.tempo !== 144 || audio.totalBars !== 12))) {
            throw Error('Wrong boss music in sector ' + (index + 1));
          }
          g.invoke('on_boss_defeated');
          for (let i = 0; i < 120; i++) g.step({});
          if (index >= 6) {
            if (s.status !== 'escape_zoom' || s.camera.pitch !== -85) throw Error('Missing overhead landing');
            for (let i = 0; i < 20; i++) g.step({});
            if (s.ui.cinema.fade !== 1 || s.avatar.visible) throw Error('First-person cut needs a full fade');
            g.frame();
            for (let i = 0; i < 9; i++) g.step({});
          }
          if (s.escape_first_person !== (index >= 6) || s.status !== 'playing') {
            throw Error('Wrong return perspective in sector ' + (index + 1));
          }
        }""", stage_index)
        if stage_index == 6:
            if SHOTS_DIR:
                canvas.screenshot(path=str(Path(SHOTS_DIR) / "11_master_return.png"))
            start = page.evaluate("__RunePixel3D.app.state.player.x")
            page.keyboard.down("w")
            page.wait_for_function(f"__RunePixel3D.app.state.player.x < {start - 0.75}")
            page.keyboard.up("w")
            page.keyboard.down("ArrowRight")
            page.wait_for_function("__RunePixel3D.app.state.camera.angle > 180")
            page.keyboard.up("ArrowRight")
        page.evaluate("""index => {
          const g = __RunePixel3D, s = g.app.state;
          const capsule = s.power_capsule, pose = s.camera.terrainPose;
          s.camera.x = capsule.x + (s.escape_first_person ? 5 : 1.8);
          if (s.escape_first_person) {
            s.camera.y = 2.5;
            s.camera.angle = 180;
            s.escape_angle = 180;
          }
          const { width, height, depth, materials } = pose.world;
          const unoccluded = {...pose, world: {width, height, depth, materials,
            cells: Array(width * height * depth).fill(0)}};
          function silhouette(terrain) {
            s.camera.terrainPose = terrain;
            capsule.visible = false;
            g.frame();
            const hidden = g.raycaster.pixelDepth.slice();
            capsule.visible = true;
            g.frame();
            return hidden.map((value, i) => Number(value !== g.raycaster.pixelDepth[i]));
          }
          for (const angle of [0, 45, 90]) {
            capsule.angle = angle;
            const actual = silhouette(pose), expected = silhouette(unoccluded);
            const pixels = actual.reduce((sum, value) => sum + value, 0);
            if (pixels < 300 || actual.some((value, i) => value !== expected[i])) {
              throw Error('Capsule clipped in sector ' + (index + 1) + ' at ' + angle + ' degrees');
            }
          }
          s.camera.terrainPose = pose;
          s.player.x = capsule.x + 1.8;
          s.player.y = 2.5;
          const walk = s.escape_first_person ? {aim_up: true} : {left: true};
          for (let i = 0; i < 5 && s.status === 'playing'; i++) g.step(walk);
          if (s.status !== 'boss_victory') throw Error('Capsule unreachable in sector ' + (index + 1));
        }""", stage_index)

    assert not errors, errors
    browser.close()
    print("Neon Circuit browser verification passed cleanly!")
