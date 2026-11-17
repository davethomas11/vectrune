"""Published Vect Breach: locale routes, source, cabinet and real input."""
import argparse
from contextlib import nullcontext
from pathlib import Path
import re
from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser = argparse.ArgumentParser()
source = parser.add_mutually_exclusive_group(required=True)
source.add_argument('--site-dir')
source.add_argument('--url')
parser.add_argument('--headed', action='store_true')
args = parser.parse_args()
with (preview(Path(args.site_dir)) if args.site_dir else nullcontext(args.url.rstrip('/'))) as base, sync_playwright() as pw:
    browser = pw.chromium.launch(headless=not args.headed)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.bring_to_front()
    page.goto(base + '/')
    expect(page.get_by_role('link', name='Play Vect Breach', exact=True)).to_be_visible()
    page.locator('.sidebar a[href$="vect-breach"]').click()
    expect(page.locator('main')).to_have_attribute('data-route', 'vect-breach')
    expect(page.locator('main h1')).to_have_text('Vect Breach')
    expect(page).to_have_title('Vect Breach — Vectrune')
    iframe = page.locator('iframe.example-preview')
    expect(iframe).to_have_attribute('src', '/assets/games/vect-breach/index.html')
    assert 'allow-pointer-lock' in iframe.get_attribute('sandbox')
    frame = iframe.element_handle().content_frame()
    frame.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert frame.url.startswith(base + '/assets/games/vect-breach/')
    canvas = frame.locator('canvas')
    canvas.click()
    assert frame.evaluate('__RunePixel3D.app.state.status') == 'story'
    canvas.click()
    assert frame.evaluate('__RunePixel3D.app.state.status') == 'playing'
    frame.evaluate('__RunePixel3D.muted=true;__RunePixel3D.app.state.enemies=[]')
    # Activate the automated Chromium window with a genuine keyboard event.
    canvas.focus()
    page.keyboard.press('Shift')
    canvas.click()
    frame.wait_for_function('__RunePixel3D.app.state.ammo < 24')
    frame.wait_for_function('document.pointerLockElement === document.querySelector("canvas")',timeout=4000)
    angle = frame.evaluate('__RunePixel3D.app.state.player.angle')
    page.mouse.move(700, 420)
    frame.wait_for_function(f'__RunePixel3D.app.state.player.angle !== {angle}')
    page.keyboard.press('Escape')
    frame.wait_for_function('document.pointerLockElement === null')
    canvas.focus()
    frame.evaluate('__RunePixel3D.paused=false;__RunePixel3D.app.state.player.angle=0')
    start = frame.evaluate('__RunePixel3D.app.state.player.x')
    page.keyboard.down('KeyW')
    frame.wait_for_function(f'__RunePixel3D.app.state.player.x > {start} + 0.1',timeout=2000)
    page.keyboard.up('KeyW')
    for width in [390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
        assert frame.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert frame.get_by_role('button', name='Fullscreen', exact=True).evaluate('(b)=>b.getBoundingClientRect().bottom<=innerHeight')
    page.get_by_role('tab', name='Source code', exact=True).click()
    files = page.locator('.source-file summary').all_text_contents()
    for required in ['site_shell.rune', 'vect_breach.rune', 'logic.rune', 'map.rune', 'sound.rune', 'guards.rune']:
        assert any(name.strip().endswith(required) for name in files), (required, files)
    assert not any('.test.rune' in name for name in files)
    i = next(i for i, name in enumerate(files) if re.search(r'(^|/)map\.rune$', name.strip()))
    page.locator('.source-file summary').nth(i).click()
    code = page.locator('.source-file').nth(i).locator('code').text_content()
    assert '\n' in code and 'spawn = {"x":1.5' in code and '@Map/e1m2' in code
    for locale, language in [('es', 'Español'), ('fr', 'Français'), ('', 'English')]:
        page.locator('.language-summary').click()
        page.locator('.language-link', has_text=language).click()
        expect(page.locator('main')).to_have_attribute('data-route', 'vect-breach')
        assert page.url.rstrip('/') == base + ('/' + locale if locale else '') + '/vect-breach'
        page.reload()
        expect(page.locator('main h1')).to_have_text('Vect Breach')
        page.locator('iframe.example-preview').element_handle().content_frame().wait_for_function('typeof __RunePixel3D !== "undefined"')
    page.screenshot(path='/private/tmp/vect-breach-teaching-site.png', full_page=True)
    standalone = browser.new_page()
    standalone.goto(base + '/assets/games/vect-breach/index.html')
    standalone.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert not errors, errors
    browser.close()
print('Vect Breach site: localized routes, Games/home links, real mouse lock/fire/movement, source, responsive cabinet and standalone play pass')
