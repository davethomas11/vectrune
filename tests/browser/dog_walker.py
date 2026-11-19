"""Complete Dog Walker with control inputs and verify its browser presentation."""
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ENTRY = ROOT / 'examples/games/dog_walker/dog_walker.rune'

with tempfile.TemporaryDirectory(prefix='dog-walker-') as folder, sync_playwright() as pw:
    export = subprocess.run(
        [str(ROOT / 'target/debug/vectrune'), str(ENTRY), '-o', 'html'],
        capture_output=True, text=True, check=True,
    )
    game = Path(folder) / 'dog-walker.html'
    game.write_text(export.stdout, encoding='utf-8')
    browser = pw.chromium.launch()
    live = browser.new_page(viewport={'width': 1100, 'height': 850})
    errors = []
    live.on('pageerror', lambda error: errors.append(str(error)))
    live.goto(game.as_uri())
    expect(live.get_by_role('button', name='Start walk')).to_be_visible()
    expect(live.get_by_label('Palette').locator('option:checked')).to_have_text('Blue Pocket')
    assert live.evaluate('__RunePixel3D.raycaster.outlineRadius') > 0
    live.get_by_role('button', name='Start walk').click()
    live.wait_for_function('__RunePixel3D.app.state.ticks >= 2')
    live.locator('canvas[data-rune-pixel-3d]').focus()
    live.keyboard.press('p')
    assert live.evaluate('__RunePixel3D.paused')
    live.keyboard.press('p')
    assert not live.evaluate('__RunePixel3D.paused')
    live.close()

    page = browser.new_page(viewport={'width': 1100, 'height': 850})
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script('window.requestAnimationFrame = () => 0')
    page.goto(game.as_uri())
    page.get_by_role('button', name='Start walk').click()
    result = page.evaluate('''() => {
      const game = __RunePixel3D, s = game.app.state;
      const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
      const check = (ok, label) => {
        if (!ok) throw new Error(label + ': ' + JSON.stringify({
          player:s.player, score:s.score, lives:s.lives, marked:s.marked,
          lawns:s.lawns, phase:s.phase, fetch:s.fetch, catches:s.catches,
        }));
      };
      check(s.spots.filter(spot => spot.kind === 'lawn').length === 8, 'Missing lawn stops');
      check(s.spots.filter(spot => spot.kind === 'lamp').length === 9, 'Missing lamppost stops');
      let sawChase = false, dashed = false, sawLegLift = false;
      // Score at the first hydrant and first lawn. Steer away, then reach the park.
      for (let tick = 0; tick < 1500 && s.phase === 'street' && s.status === 'playing'; tick++) {
        if (s.potty_timer) {
          game.step({});
          sawLegLift ||= s.dog_legs.model === 'walk/dog_pee_positive';
          continue;
        }
        const target = !s.spots[0].used ? 0 : (!s.spots[2].used ? 2 : -1);
        const chasing = s.walkers.some(w => w.visible);
        sawChase ||= chasing;
        const y = target < 0 ? (s.player.x < 55 ? -3.5 : (s.player.x < 81 ? 1.8 : 0)) : s.spots[target].y;
        const ready = target >= 0 && s.ready_spot === target;
        const dash = chasing && !dashed;
        const move_y = target < 0 ? 1 : (s.player.x > s.spots[target].x && !ready ? -.8 : 0);
        game.step({ move_x:clamp((y-s.player.y)/.17,-1,1), move_y, use:ready, dash });
        dashed ||= s.dash_timer > 0;
      }
      check(s.phase === 'park' && s.marked === 1 && s.lawns === 1 && sawChase && dashed && sawLegLift, 'Street route failed');
      const lives = s.lives;
      check(lives === 3 && s.score === 50, 'Lost points on the route');
      for (let ball = 0; ball < 3; ball++) {
        const target = s.targets[s.target_order[ball]].y;
        for (let tick = 0; Math.abs(target-s.player.y) > .1 && tick < 100; tick++) {
          game.step({move_x:clamp((target-s.player.y)/.15,-1,1)});
        }
        game.step({use:true});
        check(s.fetch === 'flight', 'Throw did not start');
        for (let tick = 0; s.catches === ball && tick < 125; tick++) game.step({});
        check(s.catches === ball+1 && s.bullseyes === ball+1, 'Fetch did not return on target');
      }
      check(s.status === 'won' && s.record.best === s.score && s.score === 245, 'Walk result failed');
      return {score:s.score,lives:s.lives,marks:s.marked+s.lawns,fetch:s.catches};
    }''')
    page.reload()
    assert page.evaluate('__RunePixel3D.app.state.record.best') == result['score']
    assert not errors, errors
    browser.close()
    print(f'Dog Walker input-only playthrough: {result}; saved high score survived reload')
