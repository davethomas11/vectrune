"""Cinematic title rendering, independent animation, and the normal start flow."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='vect-breach-title-') as folder, sync_playwright() as pw:
    html = subprocess.run([str(ROOT / 'target/debug/vectrune'),
        str(ROOT / 'examples/vect_breach/vect_breach.rune'), '-o', 'html'],
        capture_output=True, text=True, check=True).stdout
    game_file = Path(folder) / 'game.html'
    game_file.write_text(html)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width': 1000, 'height': 800})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(game_file.as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    initial = page.evaluate('''() => {
        const g = __RunePixel3D;
        return {state: JSON.stringify(g.app.state), time: g.renderState().presentation_time,
            camera: JSON.stringify(g.renderState().camera)};
    }''')
    page.wait_for_function('(time) => __RunePixel3D.renderState().presentation_time > time + .2', arg=initial['time'])
    assert page.evaluate('JSON.stringify(__RunePixel3D.app.state)') == initial['state']
    assert page.evaluate('JSON.stringify(__RunePixel3D.renderState().camera)') != initial['camera']
    # Freeze at authored shots to make a reviewable visual and check the entire loop.
    page.evaluate('__RunePixel3D.paused = true')
    for seconds in [0, 4.5, 9, 13.5, 18, 22.5, 27, 31.5, 35.99]:
        assert page.evaluate('''seconds => {
            const g = __RunePixel3D;
            g.presentationTicks = seconds * g.config.tickRate;
            const s = g.renderState(), frame = g.frame();
            return g.usesSharedRenderer && s.camera.height > 1 && s.camera.pitch < 0 && !s.weapon &&
                frame.length === 64000 && frame.every(p => (p >>> 24) === 255);
        }''', seconds)
    page.evaluate('__RunePixel3D.presentationTicks = 0; __RunePixel3D.frame()')
    page.locator('canvas').screenshot(path='/private/tmp/vect-breach-title.png')
    page.evaluate('__RunePixel3D.paused = false')
    page.locator('canvas').click()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'story'
    assert page.evaluate('''() => {
        const g = __RunePixel3D, s = g.renderState();
        return !g.usesSharedRenderer && !s.title_scene && s.camera === g.app.state.player &&
            g.raycaster.fov === 66 && !g.raycaster.config.map.sky;
    }''')
    page.keyboard.press('Enter')
    assert page.evaluate('__RunePixel3D.app.state.status') == 'playing'
    assert page.evaluate('__RunePixel3D.app.state.health') == 100
    assert page.evaluate('__RunePixel3D.app.state.ammo') == 24
    assert not errors, errors
    browser.close()
print('Vect Breach cinematic title passed')
