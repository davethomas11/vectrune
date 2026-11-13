"""Exercise the title, shop, generated cities and persistent profiles in the exported game."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='monster-progression-') as folder, sync_playwright() as playwright:
    game = Path(folder) / 'game.html'
    export = subprocess.run([str(ROOT/'target/debug/vectrune'),str(ROOT/'examples/monster_city/monster_city.rune'),'-o','html'],capture_output=True,text=True,check=True)
    game.write_text(export.stdout,encoding='utf-8')
    browser = playwright.chromium.launch()
    context = browser.new_context(viewport={'width':1200,'height':1000})
    page = context.new_page()
    errors = []
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(game.as_uri())
    assert page.evaluate('__RunePixel.app.state.menu.title') == 'MONSTER CITY'
    page.locator('canvas').focus()
    page.keyboard.press('KeyB')
    assert page.evaluate('__RunePixel.app.state.status') == 'store'
    page.keyboard.press('ArrowRight'); page.keyboard.press('Enter')
    assert page.evaluate('__RunePixel.app.state.profile.skin') == 'kaiju'
    assert 'MORE COINS' in page.evaluate('__RunePixel.app.state.menu.note')
    page.evaluate("__RunePixel.start(); const s=__RunePixel.app.state; s.destroyed=5; s.score=1500; __RunePixel.invoke('completeLevel')")
    assert page.evaluate('__RunePixel.app.state.profile.coins') == 210
    assert page.evaluate('__RunePixel.app.state.profile.level') == 2
    page.locator('[data-pixel-action="openStore"]').click()
    # Click the second skin card using the canvas coordinate transform.
    canvas=page.locator('canvas'); box=canvas.bounding_box()
    page.mouse.click(box['x']+190*box['width']/384,box['y']+110*box['height']/216)
    assert page.evaluate('__RunePixel.app.state.profile.skin') == 'ember'
    assert page.evaluate('__RunePixel.app.state.profile.coins') == 90
    page.mouse.click(box['x']+190*box['width']/384,box['y']+110*box['height']/216)
    assert page.evaluate('__RunePixel.app.state.profile.coins') == 90
    page.screenshot(path='/private/tmp/monster-shop.png',full_page=True)
    page.reload()
    assert page.evaluate('__RunePixel.app.state.profile.skin') == 'ember'
    assert page.evaluate('__RunePixel.app.state.profile.coins') == 90
    page.get_by_role('button',name='PLAY CITY 2',exact=True).click()
    expect(page.locator('canvas')).to_be_focused()
    assert page.evaluate('__RunePixel.app.state.monster.sprite').startswith('ember/')
    assert page.evaluate('__RunePixel.app.state.level') == 2
    first=page.evaluate('__RunePixel.app.state.buildings')
    page.get_by_role('button',name='Restart').click()
    assert page.evaluate('__RunePixel.app.state.buildings') == first
    page.evaluate("__RunePixel.app.state.profile.level=5;__RunePixel.start()")
    assert page.evaluate('__RunePixel.app.state.aircraft.map(a=>a.kind)') == ['helicopter','plane']
    page.evaluate("__RunePixel.app.state.clock=74;__RunePixel.step({})")
    assert page.evaluate('__RunePixel.app.state.shots.some(s=>s.vy>0)')
    page.locator('[data-pixel-action="openStore"]').click()
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='/private/tmp/monster-shop-mobile.png',full_page=True)
    # A fresh tab reads the same device profile.
    second=page.context.new_page();second.goto(game.as_uri())
    assert second.evaluate('__RunePixel.app.state.profile.skin') == 'ember'
    second.close()
    phone_context=browser.new_context(is_mobile=True,has_touch=True,viewport={'width':390,'height':844})
    phone=phone_context.new_page();phone.on('pageerror',lambda e:errors.append(str(e)));phone.goto(game.as_uri())
    phone.locator('[data-pixel-action="openStore"]').tap()
    phone.get_by_role('button',name='EMBER:',exact=False).tap()
    assert 'MORE COINS' in phone.evaluate('__RunePixel.app.state.menu.note')
    phone.get_by_role('button',name='BACK TO TITLE',exact=True).tap()
    phone.get_by_role('button',name='PLAY CITY 1',exact=True).tap()
    assert phone.evaluate('__RunePixel.app.state.status') == 'playing'
    phone_context.close()
    page.evaluate("localStorage.setItem('rune-pixel-monster-city-v1','{broken')")
    page.reload()
    assert page.evaluate('__RunePixel.app.state.profile.coins') == 0
    assert page.evaluate('__RunePixel.saveStatus') == 'recovered'
    expect(page.locator('[data-pixel-save]')).to_contain_text('fresh profile')
    assert not errors,errors
    browser.close()
print('Monster progression: title, keyboard/touch shop, purchases, reload persistence, seeded retries, aircraft and corrupt-save recovery pass')
