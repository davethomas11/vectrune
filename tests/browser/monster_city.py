"""Exercise exported pixel games, including a reactive Rune-Web shell, without a server."""
from pathlib import Path
import json
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = ROOT / 'target/debug/vectrune'


def export(entry, destination):
    result = subprocess.run([str(BINARY), str(ROOT / 'examples/monster_city' / entry), '-o', 'html'], capture_output=True, text=True, check=True)
    destination.write_text(result.stdout, encoding='utf-8')
    assert result.stdout.startswith('<!'), result.stdout[:100]
    assert 'readyPunch' not in result.stdout


with tempfile.TemporaryDirectory(prefix='rune-pixel-browser-') as folder, sync_playwright() as playwright:
    folder = Path(folder)
    export('monster_city.rune', folder / 'game.html')
    export('custom_shell.rune', folder / 'shell.html')
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={'width': 1365, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((folder / 'game.html').as_uri())
    expect(page.get_by_role('heading', level=1)).to_have_text('Monster City.')
    page.get_by_role('button', name='Start rampage').click()
    page.wait_for_function('__RunePixel.app.state.status === "playing"')
    page.keyboard.down('Space')
    page.wait_for_function('__RunePixel.app.state.destroyed >= 1')
    page.keyboard.up('Space')
    assert page.evaluate('__RunePixel.app.state.score') >= 100
    page.get_by_role('button', name='Pause', exact=True).click()
    page.wait_for_function('__RunePixel.paused')
    frozen = page.evaluate('__RunePixel.app.state.clock')
    page.wait_for_timeout(180)
    assert page.evaluate('__RunePixel.app.state.clock') == frozen
    page.get_by_role('button', name='Resume', exact=True).click()
    page.keyboard.down('ArrowRight')
    page.wait_for_function('__RunePixel.app.state.monster.x > 8')
    page.keyboard.up('ArrowRight')
    # The actual simulation produces a health loss from army fire.
    page.wait_for_function('__RunePixel.app.state.health < 100', timeout=12000)
    page.get_by_role('button', name='Restart', exact=False).click()
    assert page.evaluate('__RunePixel.app.state.health') == 100
    assert page.evaluate('__RunePixel.app.state.destroyed') == 0
    page.screenshot(path='/private/tmp/monster-city-desktop.png', full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
    button = page.get_by_role('button', name='Move right', exact=True)
    # Real mouse input supplies a pointer ID that can be captured.
    button.click()
    button.hover(); page.mouse.down()
    page.wait_for_function('__RunePixel.app.state.monster.x > 8')
    page.mouse.up()
    page.screenshot(path='/private/tmp/monster-city-mobile.png', full_page=True)
    page.goto((folder / 'shell.html').as_uri())
    page.get_by_role('button', name='Start rampage').click()
    page.keyboard.down('ArrowRight'); page.wait_for_function('__RunePixel.app.state.monster.x > 8'); page.keyboard.up('ArrowRight')
    previous = page.evaluate('__RunePixel.app.state.monster.x')
    page.get_by_role('button', name='Toggle instructions').click()
    expect(page.get_by_text('Arrow keys to move. Space to smash. Enter to start. Down/S to block. X for special. P to pause. M to toggle sound.')).to_be_visible()
    page.get_by_role('button', name='Resume', exact=True).click()
    page.locator('canvas').focus()
    page.keyboard.down('ArrowRight'); page.wait_for_function(f'__RunePixel.app.state.monster.x > {previous}'); page.keyboard.up('ArrowRight')
    touch = browser.new_context(is_mobile=True, has_touch=True, viewport={'width':390,'height':844})
    phone = touch.new_page()
    phone.on('pageerror', lambda error: errors.append(str(error)))
    phone.goto((folder / 'game.html').as_uri())
    phone.get_by_role('button', name='Start rampage').tap()
    phone.get_by_role('button', name='Move right', exact=True).tap()
    phone.wait_for_function('__RunePixel.app.state.monster.x > 8')
    phone.get_by_role('button', name='SMASH', exact=True).tap()
    phone.wait_for_function('__RunePixel.app.state.buildings[0].hp < 3')
    touch.close()
    assert not errors, errors
    browser.close()
print('Monster City: export, smash, score, army damage, restart, pause, keyboard/touch, and Rune-Web shell remount pass')
