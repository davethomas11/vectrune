"""Game/source tabs, responsive iframe sizing and fullscreen in deployed site HTML."""
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


def assert_stable_cabinet(frame):
    samples = frame.evaluate('''() => new Promise(resolve => {
        const samples = [];
        function sample() {
            const cabinet = document.querySelector('.arcade-cabinet').getBoundingClientRect();
            samples.push([innerHeight, cabinet.width, cabinet.height]);
            if (samples.length === 36) resolve(samples.slice(12));
            else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
    })''')
    assert all(sample == samples[0] for sample in samples), samples


with (preview(Path(args.site_dir)) if args.site_dir else nullcontext(args.url.rstrip('/'))) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    for route in ['games', 'vectworms', 'monster-city', 'vect-breach', 'rune-crypt', 'skybound-2']:
        page.goto(f'{base}/{route}/')
        game_tab = page.get_by_role('tab', name='Game', exact=True)
        source_tab = page.get_by_role('tab', name='Source code', exact=True)
        expect(game_tab).to_have_attribute('aria-selected', 'true')
        expect(page.locator('.example-source')).to_be_hidden()
        iframe = page.locator('.example-preview')
        frame = iframe.element_handle().content_frame()
        frame.wait_for_load_state()
        frame.evaluate('window.__tabState = { saved: 42 }')
        sizes = [(1440, 1000), (390, 1000), (768, 1000), (1440, 1000)]
        if route in {'games', 'vectworms'}:
            sizes = [
                (1440, 1000), (390, 844), (768, 1024), (1440, 720),
                (844, 390), (320, 640), (1440, 1000),
            ]
        for width, height in sizes:
            page.set_viewport_size({'width': width, 'height': height})
            frame.wait_for_function('document.documentElement.scrollHeight <= innerHeight + 1')
            assert frame.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (route, width)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (route, width)
            if route in {'games', 'vectworms'}:
                assert_stable_cabinet(frame)
        if route in {'games', 'vectworms'}:
            frame.locator('.start-btn').click()
            assert_stable_cabinet(frame)
        source_tab.click()
        expect(iframe).to_be_hidden()
        expect(page.locator('.source-filter')).to_be_visible()
        expect(page.locator('.source-file code').first).to_be_visible()
        page.locator('.source-filter').fill('no-such-file')
        expect(page.locator('.source-empty')).to_be_visible()
        source_tab.press('ArrowLeft')
        expect(game_tab).to_be_focused()
        expect(iframe).to_be_visible()
        assert frame.evaluate('window.__tabState.saved') == 42
        if route in {'games', 'vectworms'}:
            assert_stable_cabinet(frame)
        game_tab.press('End')
        expect(source_tab).to_be_focused()
        expect(page.locator('.source-filter')).to_have_value('no-such-file')
        source_tab.press('Home')
        expect(game_tab).to_have_attribute('aria-selected', 'true')
        assert game_tab.get_attribute('aria-controls') == page.locator('.example-game-panel').get_attribute('id')
        print(route, 'tabs, state and responsive scroll-free iframe passed', flush=True)

    # Changing the game's own layout must update the iframe, too.
    frame.wait_for_function('typeof __RunePixel3D !== "undefined"')
    frame.locator('.atlas [data-pixel-start]').click()
    frame.wait_for_function('__RunePixel3D.app.state.phase === "playing"')
    frame.wait_for_function('document.documentElement.scrollHeight <= innerHeight + 1')
    for locale, labels in [('fr', ['Jeu', 'Code source']), ('es', ['Juego', 'Código fuente'])]:
        page.goto(f'{base}/{locale}/skybound-2/')
        expect(page.get_by_role('tab', name=labels[0], exact=True)).to_have_attribute('aria-selected', 'true')
        page.get_by_role('tab', name=labels[1], exact=True).click()
        expect(page.locator('.source-filter')).to_be_visible()

    # Tabs also initialize after a lazy route change, without reloading the page.
    page.goto(base + '/')
    page.locator('.sidebar a[href$="vect-breach"]').click()
    expect(page.get_by_role('tab', name='Game', exact=True)).to_have_attribute('aria-selected', 'true')
    iframe = page.locator('.example-preview')
    frame = iframe.element_handle().content_frame()
    frame.wait_for_function('typeof __RunePixel3D !== "undefined"')
    frame.evaluate("parent.postMessage({type:'toggle_fullscreen',is_fullscreen:true},'*')")
    expect(iframe).to_have_class('example-preview iframe-fullscreen')
    assert page.locator('.web-example').evaluate('(e) => getComputedStyle(e).backdropFilter') == 'none'
    frame.evaluate("parent.postMessage({type:'toggle_fullscreen',is_fullscreen:false},'*')")
    expect(iframe).to_have_class('example-preview')
    frame.wait_for_function('document.documentElement.scrollHeight <= innerHeight + 1')
    assert not errors, errors
    browser.close()
print('Game embeds: localized tabs, retained game/source state, responsive sizing, lazy navigation and fullscreen passed')
