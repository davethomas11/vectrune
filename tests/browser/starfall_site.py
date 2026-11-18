"""Published Starfall: localized routes, live play, source tabs and responsive embed."""
import argparse
from contextlib import nullcontext
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser = argparse.ArgumentParser()
source = parser.add_mutually_exclusive_group(required=True)
source.add_argument('--site-dir')
source.add_argument('--url')
args = parser.parse_args()

with (preview(Path(args.site_dir)) if args.site_dir else nullcontext(args.url.rstrip('/'))) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/')
    expect(page.get_by_role('link', name='Play Starfall Protocol', exact=True)).to_be_visible()
    page.locator('.sidebar a[href$="starfall"]').click()
    expect(page.locator('main')).to_have_attribute('data-route', 'starfall')
    expect(page.locator('main h1')).to_have_text('Starfall Protocol')
    expect(page).to_have_title('Starfall Protocol — Vectrune')
    iframe = page.locator('iframe.example-preview')
    expect(iframe).to_have_attribute('src', '/assets/games/starfall/index.html')
    frame = iframe.element_handle().content_frame()
    frame.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert frame.url.startswith(base + '/assets/games/starfall/')
    assert frame.evaluate('__RunePixel3D.app.state.status') == 'title'
    frame.locator('[data-pixel-start]').click()
    frame.wait_for_function('__RunePixel3D.app.state.status === "intro"')
    frame.locator('[data-pixel-pause]').first.click()
    frame.wait_for_function('__RunePixel3D.paused')
    expect(frame.locator('.pause-menu')).to_be_visible()
    frame.locator('.pause-menu [data-pixel-pause]').click()
    frame.locator('[data-pixel-action="advance"]').click()
    frame.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    frame.locator('canvas').focus()
    start = frame.evaluate('__RunePixel3D.app.state.player.x')
    page.keyboard.down('d')
    frame.wait_for_function(f'__RunePixel3D.app.state.player.x > {start} + 0.5')
    page.keyboard.up('d')
    frame.evaluate('__RunePixel3D.paused=true')
    for width in [390, 768, 1440]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.wait_for_function('document.documentElement.scrollWidth <= innerWidth + 1')
        frame.wait_for_function('document.documentElement.scrollHeight <= innerHeight + 1')
        assert frame.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.get_by_role('tab', name='Source code', exact=True).click()
    expect(iframe).to_be_hidden()
    files = page.locator('.source-file summary').all_text_contents()
    for required in ['starfall.rune', 'cinematics.rune', 'rewards.rune', 'assets.rune', 'sound.rune']:
        assert any(name.strip().endswith(required) for name in files), (required, files)
    assert not any('.test.rune' in name for name in files)
    page.get_by_role('tab', name='Game', exact=True).click()
    assert frame.evaluate('__RunePixel3D.paused'), 'Source tab discarded the game state'
    for locale, language, source_label in [('es', 'Español', 'Código fuente'), ('fr', 'Français', 'Code source'), ('', 'English', 'Source code')]:
        page.locator('.language-summary').click()
        page.locator('.language-link', has_text=language).click()
        expect(page.locator('main')).to_have_attribute('data-route', 'starfall')
        assert page.url.rstrip('/') == base + ('/' + locale if locale else '') + '/starfall'
        page.reload()
        expect(page.locator('main h1')).to_have_text('Starfall Protocol')
        page.get_by_role('tab', name=source_label, exact=True).click()
        expect(page.locator('.source-filter')).to_be_visible()
    standalone = browser.new_page()
    standalone.goto(base + '/assets/games/starfall/index.html')
    standalone.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert standalone.evaluate('__RunePixel3D.app.state.intro_lines.includes("Bring the light home.")')
    assert standalone.evaluate('__RunePixel3D.app.state.credits_lines.includes("GAME BY DAVE THOMAS")')
    assert not errors, errors
    browser.close()
print('Starfall site: localized routes, title/intro/play, pause, source tabs, responsive embed and standalone passed')
