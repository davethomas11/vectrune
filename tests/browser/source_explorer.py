"""Verify complete, lossless source bundles and explorer controls in the teaching site."""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import tempfile
from threading import Thread

from playwright.sync_api import expect, sync_playwright
from rune_web_guide import ROOT, QuietHandler, build_site

EXAMPLES = [('games', 'space_invaders', 'space_invaders'), ('vectworms', 'vectworms', 'vectworms'), ('studio', 'rune_studio', 'rune_studio')]


def check(base):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for locale in ['', 'es/', 'fr/']:
            context = browser.new_context(permissions=['clipboard-read', 'clipboard-write'], accept_downloads=True)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base + '/' + locale)
            for route, folder, entry in EXAMPLES:
                page.set_viewport_size({'width': 1440, 'height': 1000})
                page.locator(f'.sidebar [data-on-click="navigate(\'{route}\')"]').click()
                files = page.locator('.source-file')
                root = ROOT / 'examples' / folder
                expected = [f'{entry}.rune'] + sorted(str(p.relative_to(root)) for p in (root / 'parts').rglob('*.rune'))
                expect(files).to_have_count(len(expected))
                expect(files.first).to_have_attribute('open', '')
                assert files.locator('summary').all_text_contents() == expected
                for index, path in enumerate(expected):
                    file = files.nth(index)
                    source = (root / path).read_text(encoding='utf-8')
                    assert file.locator('code').text_content() == source, (locale, route, path)
                    if not file.evaluate('(file) => file.open'):
                        file.locator('summary').click()
                    expect(page.locator('.source-file[open]')).to_have_count(1)
                search = page.locator('.source-filter')
                logic = 'parts/logic/state.rune' if route == 'studio' else 'parts/logic.rune'
                search.fill(logic)
                expect(page.locator('.source-file:not([hidden])')).to_have_count(1)
                expect(page.locator('.source-count')).to_have_text(f'1 / {len(expected)}')
                file = page.locator('.source-file:not([hidden])')
                file.locator('.source-copy').click()
                assert page.evaluate('navigator.clipboard.readText()') == (root / logic).read_text(encoding='utf-8')
                with page.expect_download() as download:
                    file.locator('.source-download').click()
                assert download.value.suggested_filename == Path(logic).name
                assert Path(download.value.path()).read_text(encoding='utf-8') == (root / logic).read_text(encoding='utf-8')
                search.fill('no-such-file')
                expect(page.locator('.source-empty')).to_be_visible()
                search.fill('')
                expect(page.locator('.source-empty')).to_be_hidden()
                for width in [320, 390, 768, 1440]:
                    page.set_viewport_size({'width': width, 'height': 1000})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (locale, route, width)
                assert '%i18n.' not in page.locator('.example-source').inner_text()
            # Exercise the same component through the nested Example Lab route.
            page.set_viewport_size({'width': 1440, 'height': 1000})
            page.locator('.sidebar [data-on-click="openExample(\'app\')"]').click()
            for example, folder, entry in [('counter', '', 'counter'), ('tic', 'tic_tac_toe', 'tic_tac_toe'), ('invaders', 'space_invaders', 'space_invaders'), ('worms', 'vectworms', 'vectworms')]:
                page.locator(f'.example-picker [data-on-click="openExample(\'{example}\')"]').click()
                expect(page.locator('.source-file summary').first).to_have_text(f'{entry}.rune')
                root = ROOT / 'examples' / folder
                assert page.locator('.source-file code').first.text_content() == (root / f'{entry}.rune').read_text(encoding='utf-8')
            assert not errors, errors
            print(locale or 'en/', 'source fidelity, recursive files, filter, copy, download, mobile widths and Example Lab passed', flush=True)
            context.close()
        browser.close()


if __name__ == '__main__':
    with tempfile.TemporaryDirectory(prefix='vectrune-source-explorer-') as directory:
        build_site(Path(directory), str(ROOT / 'target/debug/vectrune'))
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=directory))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            check(f'http://127.0.0.1:{server.server_port}')
        finally:
            server.shutdown()
            server.server_close()
