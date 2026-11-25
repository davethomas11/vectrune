"""Exercise Volt Viper's flank, low pulse, and boost rail in Chromium."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = os.environ.get("NEON_VOLT_SHOTS")

with tempfile.TemporaryDirectory(prefix="neon-volt-return-") as folder, sync_playwright() as pw:
    html = Path(folder) / "neon.html"
    html.write_bytes(subprocess.check_output([
        "vectrune", str(ROOT / "examples/games/neon_circuit/neon_circuit.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width":1100, "height":900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(html.as_uri())
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    canvas = page.locator("canvas[data-rune-pixel-3d]")
    canvas.click()
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state, step = g.step.bind(g);
      window.stepVolt = step;
      g.step = () => {};
      window.startVolt = () => {
        g.invoke('load_stage', [0]);
        g.invoke('on_boss_defeated');
        for (let i = 0; i < 120; i++) step({});
        if (!s.escape_active || s.escape_time_limit !== 2250) throw Error('Expected Volt Viper return');
      };
      startVolt();
      const flanker = s.enemies.find(e => e.volt_flank);
      if (!flanker) throw Error('Missing flanking drone');
      let furthest = flanker.x;
      for (let i = 0; i < 132; i++) {
        step({left:true,fire:true});
        furthest = Math.max(furthest, flanker.x);
      }
      if (flanker.volt_flank !== 4 || furthest < 86.2 || flanker.y > 3.6 || flanker.x <= s.player.x) {
        throw Error('Drone did not round the wall to flank Axel: ' + JSON.stringify({flanker, player:s.player}));
      }
    }""")

    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state, step = window.stepVolt;
      window.windupVolt = () => {
        startVolt();
        const turret = s.enemies.find(e => e.volt_lane);
        if (!turret) throw Error('Missing lane turret');
        for (const e of s.enemies) if (e !== turret) e.alive = false;
        s.player.x = turret.x + 7;
        s.player.y = 2.5;
        s.camera.backdrop.x += s.player.x - s.camera.x;
        s.camera.x = s.player.x;
        s.invulnerable = 0;
        step({});
        if (!turret.volt_lane_charge || !s.volt_lane_warning.every(tile => tile.visible)) {
          throw Error('Expected the lane warning ahead of the pulse');
        }
        return turret;
      };
      windupVolt();
    }""")
    if SHOTS:
        Path(SHOTS).mkdir(parents=True, exist_ok=True)
        canvas.screenshot(path=str(Path(SHOTS) / "volt_amber_lane.png"))
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state, step = window.stepVolt;
      for (const jump of [false, true]) {
        const turret = windupVolt();
        for (let i = 0; i < 30 && turret.volt_lane_charge > 0; i++) step({});
        if (!s.enemy_shots.some(shot => shot.model === 'nc/volt_lane_pulse') ||
            s.volt_lane_warning.some(tile => tile.visible)) throw Error('Expected a low pulse after the warning');
        for (let i = 0; i < 20; i++) step({jump: jump && i === 2});
        if (s.health !== (jump ? 8 : 7) || s.player.z !== s.escape_deck_z) {
          throw Error('The pulse should hit a grounded player and miss the jump');
        }
      }
      window.prepareVoltRail = () => {
        startVolt();
        for (const e of s.enemies) e.alive = false;
        s.player.x = 42.4;
        s.player.y = 3.58;
        s.invulnerable = 0;
      };
      prepareVoltRail();
      for (let i = 0; i < 25; i++) step({left:true});
      if (s.health !== 7) throw Error('Expected an unboosted hit at the live coil');
      prepareVoltRail();
    }""")
    if SHOTS:
        page.evaluate("""() => {
          const g = __RunePixel3D, s = g.app.state;
          window.stepVolt({});
          s.camera.backdrop.x += 37.4 - s.camera.x;
          s.camera.x = 37.4;
          g.invalidateFrame();
        }""")
        canvas.screenshot(path=str(Path(SHOTS) / "volt_boost_rail.png"))
    page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state, step = window.stepVolt;
      if (s.campaign.weapons.volt) throw Error('The pilot should work before Volt is unlocked');
      step({left:true,dash:true});
      for (let i = 0; i < 21; i++) step({});
      if (!s.volt_dash_used || s.volt_dash_ticks || s.player.x > 21.5 || s.health !== 8) {
        throw Error('Boost did not traverse the rail: ' + JSON.stringify(s.player));
      }
      startVolt();
      for (let i = 0; i < 500 && s.status === 'playing'; i++) step({left:true,fire:true});
      if (s.status !== 'boss_victory' || s.lives !== 3) throw Error('The regular escape must still be playable');
      g.invoke('load_stage', [1]);
      if (s.volt_return_props.length !== 0) throw Error('Volt encounter props leaked to another sector');
    }""")
    assert not errors, errors
    browser.close()
    print("Volt Viper flank, pulse jump, boost rail, and regular route passed.")
