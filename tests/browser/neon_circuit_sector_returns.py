"""Exercise Neon Circuit’s sector-specific return encounters in Chromium."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = os.environ.get("NEON_RETURN_SHOTS")

with tempfile.TemporaryDirectory(prefix="neon-sector-returns-") as folder, sync_playwright() as pw:
    html = Path(folder) / "neon.html"
    html.write_bytes(subprocess.check_output([
        "vectrune", str(ROOT / "examples/games/neon_circuit/neon_circuit.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(html.as_uri())
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    canvas = page.locator("canvas[data-rune-pixel-3d]")
    canvas.click()
    page.evaluate("""() => {
      const game = __RunePixel3D, state = game.app.state, step = game.step.bind(game);
      game.step = () => {};
      window.returnTest = {
        state, step,
        start(stage, isolate = false) {
          game.invoke('load_stage', [stage]);
          state.player.x = state.boss_gate_x >= 0 ? state.boss_gate_x + 2 : state.boss_entity.home_x - 8;
          game.invoke('on_boss_defeated');
          for (let i = 0; i < (stage < 6 ? 120 : 149); i++) step({});
          if (!state.escape_active || state.status !== 'playing' || state.escape_first_person !== (stage >= 6)) {
            throw Error('Wrong escape perspective for sector ' + (stage + 1));
          }
          if (isolate) {
            for (const enemy of state.enemies) {
              enemy.alive = false;
              enemy.visible = false;
            }
          }
        },
        place(x, y) {
          state.camera.backdrop.x += x - state.player.x;
          state.player.x = x;
          state.player.y = y;
          state.camera.x = x;
        },
      };
      const test = returnTest;
      test.start(1, true);
      test.place(72, 2.5);
      step({});
      if (state.cryo_vents.filter(vent => vent.model === 'nc/cryo_vent_warn').length !== 4) {
        throw Error('Expected four vents in the first lane to telegraph the frost');
      }
      for (let i = 0; i < 22; i++) step({});
      step({left:true});
      if (!state.cryo_slipping || Math.abs(state.player.x - 71.8875) > 0.001) {
        throw Error('Ground movement should slow on active frost: ' + state.player.x);
      }
      step({left:true, jump:true});
      if (state.cryo_slipping || Math.abs(state.player.x - 71.6375) > 0.001 || state.player.z <= state.escape_deck_z) {
        throw Error('Jumping should clear the frost');
      }
      game.invalidateFrame();
    }""")
    if SHOTS:
        Path(SHOTS).mkdir(parents=True, exist_ok=True)
        canvas.screenshot(path=str(Path(SHOTS) / "cryo_frost_vents.png"))
    page.evaluate("""() => {
      const {state, step, place, start} = returnTest;
      while (state.cryo_vent_tick < 69) step({});
      if (state.cryo_vents.some(vent => vent.lane === 1 && vent.model !== 'nc/cryo_vent_warn')) {
        throw Error('Frost vents should alternate lanes');
      }
      place(72, 4.25);
      while (state.cryo_vent_tick < 91) step({});
      step({left:true});
      if (!state.cryo_slipping) throw Error('The second row of vents should slow Axel');
      place(63.5, 4.25);
      step({});
      if (!state.cryo_cache.visible) throw Error('Save the cache when both resources are full');
      state.health = 4;
      state.weapon_energy = 12;
      step({});
      if (state.cryo_cache.visible || state.health !== 6 || state.weapon_energy !== 20) {
        throw Error('Coolant cache should refill both resources');
      }
      step({});
      if (state.health !== 6 || state.weapon_energy !== 20) throw Error('Cache can only be collected once');
      start(6, true);
      if (state.sector_return_props.some(prop => prop.model.startsWith('nc/cryo_'))) throw Error('Cryo props leaked into Storm');
      place(68, 2.5);
      step({});
      if (state.storm_beacon.model !== 'nc/storm_beacon_warn' || state.storm_wind.some(streak => streak.visible)) {
        throw Error('Storm should wind up before the gust');
      }
      while (state.storm_fan_tick < 24) step({});
      place(64, 2.5);
      step({});
      if (Math.abs(state.player.y - 2.6) > 0.001 || !state.storm_wind.every(streak => streak.visible)) {
        throw Error('Expected visible crosswind and sideways movement: ' + state.player.y);
      }
      __RunePixel3D.invalidateFrame();
    }""")
    if SHOTS:
        canvas.screenshot(path=str(Path(SHOTS) / "storm_crosswind.png"))
    page.evaluate("""() => {
      const {state, step, place, start} = returnTest;
      place(64, 3);
      step({right:true});
      if (Math.abs(state.player.y - 2.85) > 0.001) throw Error('Strafing should counter the gust');
      start(6, true);
      place(64, 2.5);
      step({fire:true});
      for (let i = 0; i < 12; i++) step({});
      if (!state.storm_relay_off || state.storm_relay.model !== 'nc/storm_relay_off') {
        throw Error('Buster shot should turn off the relay');
      }
      for (let i = 0; i < 50; i++) step({});
      if (state.player.y !== 2.5 || state.storm_wind.some(streak => streak.visible)) {
        throw Error('Relay shutdown should stop the wind');
      }
      state.escape_ticks = state.escape_time_limit - 1;
      step({});
      if (state.status !== 'escape_retry') throw Error('Expected the escape retry screen');
      __RunePixel3D.invoke('retry_escape');
      if (state.storm_relay_off || state.sector_return_props.length !== 10 || state.storm_fan_tick !== 0) {
        throw Error('A new attempt should restore the relay and rebuild one set of props');
      }
      for (const stage of [1, 6]) {
        start(stage);
        const startingLives = state.lives;
        for (let i = 0; i < 650 && state.status === 'playing'; i++) {
          step(stage === 1 ? {left:true, fire:true} : {
            up:true, fire:true, right:state.player.y > 2.58
          });
        }
        if (state.status !== 'boss_victory' || state.lives !== startingLives) {
          throw Error('Capsule route failed in sector ' + (stage + 1) + ': ' + JSON.stringify(state.player));
        }
      }
    }""")
    page.evaluate("""() => {
      const {state: s, step, place, start} = returnTest;
      const game = __RunePixel3D;
      const until = (n, input = {}) => {
        while (s.return_challenge.age < n && s.status === 'playing') step(input);
        if (s.return_challenge.age < n) throw Error('Encounter ended before tick ' + n);
      };
      start(2, true);
      place(72.5, 2.5);
      step({});
      if (Math.abs(s.player.x - 72.35) > 0.001) throw Error('Mag rail should carry Axel west');
      step({jump:true});
      if (Math.abs(s.player.x - 72.35) > 0.001) throw Error('Jump should disengage the rail');
      until(40);
      place(72.5, 2.5);
      step({});
      if (Math.abs(s.player.x - 72.59) > 0.001 || s.return_challenge.pieces[0].model !== 'nc/return_mag_east') {
        throw Error('Mag rail should reverse after its westbound pulse');
      }
      start(3, true);
      place(75, 2.5);
      step({});
      const jets = s.return_challenge.pieces;
      if (!jets.every(jet => jet.model === 'nc/return_purge_warn')) throw Error('Missing purge warning');
      s.invulnerable = 0;
      place(69, 2.5);
      until(42);
      if (s.health !== 7 || jets[0].x >= 69 || jets[0].model !== 'nc/return_purge_fire') {
        throw Error('Thermal purge should sweep west and hit grounded Axel');
      }
      start(4, true);
      place(75, 2.5);
      s.escape_ticks = 300;
      step({left:true});
      for (let i = 0; i < 40; i++) step({fire:true});
      if (s.escape_ticks !== 221 || s.return_challenge.pieces.some(core => core.visible !== false)) {
        throw Error('Firing through the Phase echoes should reveal the time cache exactly once, clock=' + s.escape_ticks);
      }
      start(5, true);
      place(86, 2.5);
      step({});
      const [saw] = s.return_challenge.pieces;
      const y = saw.y;
      s.invulnerable = 0;
      place(saw.x, saw.y);
      step({});
      if (saw.y === y || s.health !== 7) throw Error('Saw should shuttle laterally and damage Axel');
      place(saw.x, saw.y);
      step({jump:true});
      if (s.player.z <= s.escape_deck_z) throw Error('Missing jump over saws');
      until(12);
      s.invulnerable = 0;
      place(saw.x, saw.y);
      step({});
      if (s.health !== 7) throw Error('Saw should pass below airborne Axel');
      start(7, true);
      place(86, 2.5);
      step({});
      const [mark, shard] = s.return_challenge.pieces;
      if (!mark.visible || shard.visible || mark.x !== 82.5) throw Error('Ice fall should mark ahead of Axel');
      place(82.5, 2.5);
      s.invulnerable = 0;
      until(20);
      if (!shard.visible || shard.z <= s.escape_deck_z) throw Error('Shard should fall after warning');
      until(25);
      if (s.health !== 7 || shard.z !== s.escape_deck_z) throw Error('Ice fall should hit at the marked point');
      start(8, true);
      place(79, 2.5);
      for (let i = 0; i < 27; i++) step({});
      if (s.return_challenge.spent || s.enemy_shots.length) throw Error('Ghost listener should ignore a quiet player: ' + JSON.stringify({listener:s.return_challenge, shots:s.enemy_shots}));
      step({fire:true});
      if (s.return_challenge.charge !== 24 || s.return_challenge.pieces[0].model !== 'nc/return_listener_alert') {
        throw Error('Ghost listener should charge after hearing a shot');
      }
      for (let i = 0; i < 24; i++) step({});
      if (!s.return_challenge.spent || s.enemy_shots.length !== 3) throw Error('Ghost listener should fire a single spread');
      start(9, true);
      place(87, 2.5);
      step({});
      const [press] = s.return_challenge.pieces;
      until(34);
      if (press.base.model !== 'nc/return_press_base_warn' || press.z < s.escape_deck_z + 3) throw Error('Press should warn before dropping');
      place(press.x, 2.5);
      s.invulnerable = 0;
      until(54);
      if (s.health !== 7 || press.z !== s.escape_deck_z) throw Error('Press should land and hit');
      until(73);
      if (press.z < s.escape_deck_z + 3) throw Error('Press should reopen');
      start(10, true);
      place(75, 2.5);
      step({});
      const [beam] = s.return_challenge.pieces;
      if (beam.model !== 'nc/return_prism_warn' || !beam.visible) throw Error('Missing Prism preview');
      place(beam.x, 2.5);
      s.invulnerable = 0;
      until(13);
      if (s.health !== 7) throw Error('Low Prism beam should hit grounded Axel');
      place(64, 2.5);
      until(53);
      place(beam.x, 2.5);
      s.invulnerable = 0;
      step({});
      if (s.health !== 7 || beam.z < s.escape_deck_z + 1.8) throw Error('Grounded Axel should pass under the high beam');
      place(beam.x + 4, 2.5);
      step({});
      game.invalidateFrame();
    }""")
    if SHOTS:
        canvas.screenshot(path=str(Path(SHOTS) / "prism_high_beam.png"))
    page.evaluate("""() => {
      const {state: s, step, place, start} = returnTest;
      const game = __RunePixel3D;
      start(11, true);
      const trial = s.return_challenge;
      const [high, low, last] = trial.pieces;
      place(high.x, high.y);
      step({});
      if (!high.visible) throw Error('Omega high ring requires a jump');
      step({jump:true});
      step({});
      step({});
      place(low.x, low.y);
      for (let i = 0; i < 23; i++) step({});
      place(last.x, last.y);
      step({jump:true});
      step({});
      step({});
      if (!trial.shield || trial.rings !== 3) throw Error('Three Omega rings should grant one shield');
      s.invulnerable = 0;
      game.invoke('hurt_player', [1]);
      if (s.health !== 8 || trial.shield) throw Error('Omega shield should absorb the first hit');
      s.invulnerable = 0;
      game.invoke('hurt_player', [1]);
      if (s.health !== 7) throw Error('Omega shield should only absorb one hit');
      game.invoke('load_stage', [0]);
      if (s.return_challenge !== null || s.sector_return_props.length) throw Error('Challenge leaked into the outbound stage');
      for (let stage = 0; stage < 12; stage++) {
        start(stage);
        const startingLives = s.lives;
        for (let i = 0; i < 850 && s.status === 'playing'; i++) {
          const input = stage < 6 ? {left:true, fire:true} : {up:true, fire:stage !== 8 || s.player.x < 71 || s.player.x > 84};
          if (stage === 6 && s.player.y > 2.58) input.right = true;
          step(input);
        }
        if (s.status !== 'boss_victory' || s.lives !== startingLives) {
          throw Error('Full capsule route failed in sector ' + (stage + 1) + ' ' +
            JSON.stringify({player:s.player, status:s.status, health:s.health, lives:s.lives}));
        }
      }
    }""")
    if SHOTS:
        for stage, x, ticks, name in [
            (3, 67, 34, "pyro_thermal_purge"),
            (5, 79, 10, "pulse_saw_shuttles"),
            (9, 88, 26, "hydra_assembly_press"),
            (11, 87, 5, "omega_aegis_rings"),
        ]:
            page.evaluate("""([stage, x, ticks]) => {
              const {step, place, start} = returnTest;
              start(stage, true);
              place(x, 2.5);
              for (let i = 0; i < ticks; i++) step({});
              __RunePixel3D.invalidateFrame();
            }""", [stage, x, ticks])
            canvas.screenshot(path=str(Path(SHOTS) / (name + ".png")))
    assert not errors, errors
    browser.close()
    print("Sector encounter mechanics and all twelve capsule clears passed.")
