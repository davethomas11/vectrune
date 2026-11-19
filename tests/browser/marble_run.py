"""Marble Run: six courses, title/selector, arranged audio, death and saved unlocks."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="marble-run-") as folder, sync_playwright() as pw:
    html = subprocess.run(
        [str(ROOT / "target/debug/vectrune"), str(ROOT / "examples/games/marble_run/marble_run.rune"), "-o", "html"],
        capture_output=True, text=True, check=True,
    ).stdout
    game = Path(folder) / "marble.html"
    game.write_text(html, encoding="utf-8")
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width":1100,"height":1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script('''{
      let id = 0;
      const pending = new Map();
      window.requestAnimationFrame = callback => { pending.set(++id, callback); return id; };
      window.cancelAnimationFrame = id => pending.delete(id);
      window.advanceMarbleDisplay = now => {
        const callbacks = [...pending.values()];
        pending.clear();
        callbacks.forEach(callback => callback(now));
      };
    }''')
    page.goto(game.as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert page.evaluate((ROOT / 'tests/browser/marble_lifecycle.js').read_text())
    page.locator('[data-pixel-start]').click()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'playing'
    assert page.evaluate('__RunePixel3D.audioState.track') == 'marble_theme'
    assert page.evaluate('__RunePixel3D.audioState.totalBars') == 56
    page.keyboard.down('x')
    page.evaluate('''() => {const g=__RunePixel3D;for(let i=0;i<23;i++)g.step(g.controls.sample(1/30));}''')
    assert page.evaluate('__RunePixel3D.app.state.charge') == 23
    page.keyboard.up('x')
    page.evaluate('__RunePixel3D.step(__RunePixel3D.controls.sample(1/30))')
    assert page.evaluate('__RunePixel3D.app.state.blast_ticks') == 18
    assert page.evaluate((ROOT / 'tests/browser/marble_route.js').read_text())
    assert page.evaluate('''() => {
      const g=__RunePixel3D;
      g.controls.event({device:'gamepad',code:'Button2',value:1});const pad=g.controls.sample(1/30);
      g.controls.event({device:'gamepad',code:'Button2',value:0});g.controls.sample(1/30);
      g.controls.event({device:'virtual',code:'touch-charge',input:'charge',value:true});const touch=g.controls.sample(1/30);
      g.controls.event({device:'virtual',code:'touch-charge',input:'charge',value:false});g.controls.sample(1/30);
      return pad.charge===true && touch.charge===true;
    }''')
    # Drive a 120 Hz display clock for one second and count actual canvas draws.
    rates = page.evaluate('''() => {
      const game = __RunePixel3D;
      const picker = document.querySelector('[data-pixel-frame-rate]');
      const context = document.querySelector('canvas[data-rune-pixel-3d]').getContext('2d');
      const paint = context.putImageData;
      let draws = 0;
      context.putImageData = function(...args) { draws++; return paint.apply(this, args); };
      try {
        return ['simulation', '60', 'display'].map(mode => {
          document.querySelector('[data-pixel-start]').click();
          picker.value = mode;
          picker.dispatchEvent(new Event('change'));
          draws = 0;
          for (let i = 0; i <= 120; i++) window.advanceMarbleDisplay(100 + i * 1000 / 120);
          return { draws, ticks: game.ticks, marble: game.app.state.player };
        });
      } finally {
        context.putImageData = paint;
      }
    }''')
    assert [row['ticks'] for row in rates] == [rates[0]['ticks']] * 3, rates
    assert 29 <= rates[0]['ticks'] <= 30, rates
    assert all(row['marble'] == rates[0]['marble'] for row in rates), rates
    assert 30 <= rates[0]['draws'] <= 31 and rates[1]['draws'] == 61 and rates[2]['draws'] == 121, rates
    live = browser.new_page(viewport={"width":1100,"height":1000})
    live.on("pageerror", lambda error: errors.append(str(error)))
    live.goto(game.as_uri())
    live.wait_for_function('typeof __RunePixel3D !== "undefined"')
    expect(live.locator('.title-actions')).to_be_visible()
    live.wait_for_function(r'() => /^CPU · [1-9]\d* FPS$/.test(document.querySelector("[data-pixel-fps]").textContent)')
    guide = live.locator('.guide')
    expect(guide.locator('p').first).to_be_hidden()
    guide.locator('summary').click()
    expect(guide.locator('p').first).to_be_visible()
    guide.locator('summary').click()
    live.locator('.title-actions [data-pixel-action="open_selector"]').click()
    expect(live.locator('.level-picker')).to_be_visible()
    live.locator('[data-pixel-args="[6]"]').click()
    expect(live.locator('[data-pixel-action="play_selected"]')).to_be_disabled()
    assert live.evaluate('__RunePixel3D.app.state.selected_level') == 6
    live.locator('[data-pixel-args="[1]"]').first.click()
    live.locator('[data-pixel-action="play_selected"]').click()
    live.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    canvas = live.locator('canvas[data-rune-pixel-3d]')
    canvas.focus()
    live.keyboard.press('p')
    live.wait_for_function('__RunePixel3D.paused')
    state_snapshot = '''() => {
      const { player, lives, charges_left, level, status } = __RunePixel3D.app.state;
      return { player, lives, charges_left, level, status };
    }'''
    before = live.evaluate(state_snapshot)
    css_size = canvas.bounding_box()
    resolution = live.get_by_label('Resolution')
    resolution.select_option('768x480')
    expect(canvas).to_have_attribute('width', '768')
    expect(canvas).to_have_attribute('height', '480')
    assert canvas.bounding_box() == css_size
    palette = live.get_by_label('Palette')
    palette.select_option(label='Pocket')
    live.wait_for_function('''() => {
      const canvas = document.querySelector('canvas');
      const colors = new Set([0x09120c, 0x39533a, 0x78944f, 0xb9ce77, 0xe7edaf]);
      const pixels = canvas.getContext('2d').getImageData(0, 0, 32, 32).data;
      return pixels.every((value, i) => i % 4 !== 0 ||
        colors.has(value << 16 | pixels[i+1] << 8 | pixels[i+2]));
    }''')
    gpu = live.get_by_role('checkbox', name='GPU')
    gpu.click()
    gpu_surface = live.locator('[data-pixel-gpu-surface]')
    if gpu.is_checked():
        expect(gpu_surface).to_be_visible()
        expect(gpu_surface).to_have_attribute('width', '768')
        expect(live.locator('[data-pixel-fps]')).to_contain_text('GPU')
        assert live.evaluate('''() => {
          const gl = document.querySelector('[data-pixel-gpu-surface]').getContext('webgl2');
          const hud = document.querySelector('canvas[data-rune-pixel-3d]').getContext('2d');
          return gl.getError() === gl.NO_ERROR && hud.getImageData(384, 240, 1, 1).data[3] === 0;
        }''')
        gpu.uncheck()
        expect(gpu_surface).to_be_hidden()
    else:
        expect(gpu).to_be_disabled()
        expect(live.locator('[data-pixel-fps]')).to_contain_text('CPU')
    palette.select_option('original')
    resolution.select_option('384x240')
    expect(canvas).to_have_attribute('width', '384')
    assert live.evaluate(state_snapshot) == before
    canvas.focus()
    live.keyboard.press('p')
    live.wait_for_function('!__RunePixel3D.paused')
    live.evaluate('''() => {const g=__RunePixel3D,s=g.app.state;s.player={x:s.goal.x,y:s.goal.y,z:s.goal.z,vx:0,vy:0,vz:0};g.step({});}''')
    live.wait_for_function('__RunePixel3D.app.state.status === "level_complete"')
    expect(live.locator('.launch button')).to_have_text("Next course")
    live.reload()
    live.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert live.evaluate('__RunePixel3D.app.state.progress.unlocked') == 2
    live.keyboard.press('l')
    expect(live.locator('.level-picker')).to_be_visible()
    live.locator('[data-pixel-args="[2]"]').click()
    live.locator('[data-pixel-action="play_selected"]').click()
    for level in range(2,7):
        live.wait_for_function('__RunePixel3D.app.state.level === '+str(level)+' && __RunePixel3D.app.state.status === "playing"')
        live.evaluate('''() => {const g=__RunePixel3D,s=g.app.state;s.player={x:s.goal.x,y:s.goal.y,z:s.goal.z,vx:0,vy:0,vz:0};g.step({});}''')
        expect(live.locator('.launch')).to_be_visible()
        live.keyboard.press('Enter')
    live.wait_for_function('__RunePixel3D.app.state.level === 1 && __RunePixel3D.app.state.status === "playing"')
    live.keyboard.press('p')
    live.keyboard.press('t')
    live.keyboard.press('l')
    expect(live.locator('.level-picker')).to_be_visible()
    live.locator('[data-pixel-args="[6]"]').click()
    expect(live.locator('[data-pixel-action="play_selected"]')).to_be_enabled()
    live.locator('[data-pixel-action="play_selected"]').click()
    live.wait_for_function('__RunePixel3D.app.state.level === 6 && __RunePixel3D.app.state.status === "playing"')
    live.evaluate('__RunePixel3D.invoke("lose_life")')
    live.keyboard.press('p')
    assert live.evaluate('__RunePixel3D.paused')
    timer = live.evaluate('__RunePixel3D.app.state.death_timer')
    live.wait_for_timeout(100)
    assert live.evaluate('__RunePixel3D.app.state.death_timer') == timer
    live.keyboard.press('p')
    live.wait_for_function('__RunePixel3D.app.state.death_timer === 0')
    assert live.evaluate('__RunePixel3D.app.state.lives') == 2
    assert live.evaluate('__RunePixel3D.app.state.avatar.dissolve') == 0
    unavailable = browser.new_page()
    unavailable.add_init_script('''{
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...options) {
        return type === 'webgl2' ? null : get.call(this, type, ...options);
      };
    }''')
    unavailable.goto(game.as_uri())
    unavailable.get_by_role('checkbox', name='GPU').click()
    expect(unavailable.get_by_role('checkbox', name='GPU')).to_be_disabled()
    expect(unavailable.locator('[data-pixel-fps]')).to_contain_text('CPU')
    assert not errors, errors
    browser.close()
print('Marble Run: six input-only courses, title flyover, locked selector, saved reload, death/respawn, controls and 56-bar audio pass')
