"""End-to-end Master Gate and five-room finale in Chromium."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = os.environ.get("NEON_MASTER_SHOTS")

with tempfile.TemporaryDirectory(prefix="neon-master-") as folder, sync_playwright() as pw:
    html = Path(folder) / "neon.html"
    html.write_bytes(subprocess.check_output([
        "vectrune", str(ROOT / "examples/games/neon_circuit/neon_circuit.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(html.as_uri())
    canvas = page.locator("canvas[data-rune-pixel-3d]")
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    page.locator('[data-pixel-action="visit_master_gate"]').click()
    page.wait_for_function('__RunePixel3D.app.state.status === "master_gate"')
    assert page.evaluate("__RunePixel3D.app.state.master_keys") == 0
    page.evaluate("__RunePixel3D.invoke('start_master_run')")
    assert page.evaluate("__RunePixel3D.app.state.status") == "master_gate"
    if SHOTS:
        Path(SHOTS).mkdir(parents=True, exist_ok=True)
        canvas.screenshot(path=str(Path(SHOTS) / "00_locked_gate.png"))

    # Restore five already-recovered cores as an existing save would, then
    # collect the sixth in Omega's actual escape to open the door.
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      for (const code of ['07','08','09','10','11']) s.campaign.defeated[code] = true;
      g.invoke('visit_master_gate');
      if (s.master_keys !== 5) throw Error('Expected five keys');
      g.invoke('start_master_run');
      if (s.status !== 'master_gate') throw Error('Gate opened early');
      g.invoke('load_stage', [11]);
      g.invoke('on_boss_defeated');
      for (let i = 0; i < 149; i++) g.step({});
      s.player.x = s.power_capsule.x + 1.6;
      s.player.y = s.power_capsule.y;
      g.step({aim_up:true});
      if (s.status !== 'boss_victory') throw Error('Expected sixth core pickup');
      g.invoke('finish_boss_victory');
      if (s.status !== 'master_gate' || s.master_keys !== 6) throw Error('Gate did not open');
    }""")
    if SHOTS:
        canvas.screenshot(path=str(Path(SHOTS) / "01_open_gate.png"))
    canvas.press("Enter")
    page.wait_for_function("__RunePixel3D.app.state.master_active", timeout=6000)
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_master_level"
    assert page.evaluate("__RunePixel3D.audioState.tempo") == 150
    page.evaluate("__RunePixel3D.app.state.campaign.weapons.volt = true")
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      for (let i = 0; i < 45 && s.lives === 3; i++) g.step({right:true});
      if (s.lives !== 2 || s.master_room !== 0 || s.player.x !== 3.5) throw Error('Pit must restart the current room');
    }""")

    for room in range(5):
        assert page.evaluate("__RunePixel3D.app.state.master_room") == room
        if room == 4:
            page.evaluate("""() => {
              const g = __RunePixel3D, s = g.app.state;
              for (let i = 0; i < 74; i++) g.step({right:true});
              const before = s.master_dragon_neck.map(joint => joint.pitch);
              const head = s.master_target.z;
              for (let i = 0; i < 38; i++) g.step({});
              if (before.length !== 6 || !before.some((pitch, i) => pitch !== s.master_dragon_neck[i].pitch) ||
                  head === s.master_target.z) throw Error('The dragon neck must articulate');
              g.frame();
            }""")
        if SHOTS:
            canvas.screenshot(path=str(Path(SHOTS) / f"02_room_{room}.png"))
        if room in (2, 3):
            page.evaluate("""() => {
              const g = __RunePixel3D, s = g.app.state;
              g.invoke('equip_weapon', ['buster']);
              const tick = s.master_room_ticks;
              g.step({weapon_wheel:true,turn_right:true});
              if (s.active_weapon !== 'volt' || !s.ui.wheel.active || s.master_room_ticks !== tick) {
                throw Error('Expected the shared wheel to pause the room and select Volt');
              }
              g.frame();
              const floor = s.player.z, eye = s.camera.z;
              g.step({jump:true,fire:true});
              if (s.player.z <= floor || (s.master_first && s.camera.z <= eye) || s.shots[0]?.kind !== 'volt') {
                throw Error('Expected the selected weapon to fire during the jump');
              }
              for (let i = 0; i < 20; i++) g.step({});
              if (s.player.z !== floor) throw Error('Expected Axel to land on the glass');
              g.invoke('equip_weapon', ['buster']);
            }""")
        page.evaluate("""room => {
          const g = __RunePixel3D, s = g.app.state;
          function walk(axis, goal, input) {
            const dir = Math.sign(goal - s.player[axis]);
            for (let i = 0; i < 190 && dir * (goal - s.player[axis]) > 0.05 && !s.master_transition; i++) {
              g.step(input);
            }
            if (dir * (goal - s.player[axis]) > 0.45 && !s.master_transition && s.status === 'playing') {
              throw Error(JSON.stringify({room, axis, goal, actual:s.player, hp:s.master_target_hp, lives:s.lives}));
            }
          }
          if (room < 2) {
            for (const gap of [11, 22]) {
              walk('x', gap - .25, {right:true,fire:true});
              g.step({right:true,jump:true});
              walk('x', gap + 4.4, {right:true,fire:true});
              for (let i = 0; i < 15; i++) g.step({fire:true});
            }
          }
          if (room === 2) {
            walk('y', 12, {duck:true});
            walk('x', 17, {right:true});
            walk('y', 7, {aim_up:true});
            walk('x', 25, {right:true});
            walk('y', 12, {duck:true});
            walk('x', 32, {right:true});
            walk('y', 8.5, {aim_up:true});
          }
          const forward = room === 3 ? {aim_up:true,fire:true} : {right:true,fire:true};
          if (room < 4) walk('x', 33, forward);
          for (let i = 0; i < (room === 4 ? 450 : 95) && s.master_target_hp > 0; i++) g.step({fire:true});
          if (s.master_target_hp !== 0) throw Error('Target survived in room ' + room + ' at ' + JSON.stringify(s.player));
          walk('x', 40, forward);
          if (room < 4) {
            if (!s.master_transition) throw Error('Room did not start a camera shift');
            const previous = s.camera.pitch;
            for (let i = 0; i < 10; i++) {
              g.step({});
              if (i === 4 || i === 9) g.frame();
            }
            if (s.ui.cinema?.fade !== 1 || s.master_room !== room + 1) throw Error('Missing transition');
            if (room > 0 && s.camera.pitch === previous) throw Error('Perspective did not shift');
            for (let i = 0; i < 10; i++) g.step({});
            if (g.audioState.track !== 'nc_master_level') throw Error('Music interrupted the shift');
          }
        }""", room)
    assert page.evaluate('__RunePixel3D.app.state.status === "master_credits"')
    assert page.evaluate("__RunePixel3D.audioState.track") == "nc_credits"
    assert page.evaluate("__RunePixel3D.app.state.ui.cinema.lines.includes('Game by Dave Thomas')")
    assert page.evaluate('__RunePixel3D.app.state.campaign.master_clear === true')
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state, before = s.ui.cinema.offset;
      for (let i = 0; i < 220; i++) g.step({});
      if (s.ui.cinema.offset <= before) throw Error('Expected scrolling credits');
      g.frame();
    }""")
    if SHOTS:
        canvas.screenshot(path=str(Path(SHOTS) / "03_credits.png"))
    canvas.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "won"')
    page.reload()
    page.wait_for_function("window.__RunePixel3D?.app.state.campaign.master_clear === true", timeout=6000)

    code_page = browser.new_page()
    code_page.on("pageerror", lambda error: errors.append(str(error)))
    code_page.goto(html.as_uri())
    code_page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    code_page.get_by_text("Super Code", exact=True).click()
    code = code_page.get_by_role("textbox", name="Enter unlock code")
    code.fill("bad code")
    code_page.get_by_role("button", name="Unlock", exact=True).click()
    code_page.get_by_text("Code not recognized.", exact=True).wait_for()
    assert code_page.evaluate("__RunePixel3D.app.state.campaign.super_code") is False
    code.fill("  supercode  ")
    code.press("Enter")
    code_page.wait_for_function('__RunePixel3D.app.state.status === "master_gate" && __RunePixel3D.app.state.master_keys === 6')
    assert code_page.evaluate("Object.values(__RunePixel3D.app.state.campaign.weapons).every(Boolean)")
    assert code_page.evaluate("__RunePixel3D.app.state.defeated_count") == 0
    assert code_page.evaluate("__RunePixel3D.app.state.campaign.master_clear") is False
    code_page.reload()
    code_page.wait_for_function("window.__RunePixel3D?.app.state.campaign.super_code === true")
    code_page.locator('[data-pixel-action="visit_master_gate"]').click()
    code_page.locator('canvas').press("Enter")
    code_page.wait_for_function("__RunePixel3D.app.state.master_active")
    assert not errors, errors
    browser.close()
    print("Master Gate and all five finale rooms passed.")
