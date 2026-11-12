"""Verify developer docs, locale routes, copy controls, and the actual downloadable starter."""
import argparse
from io import BytesIO
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.request import urlopen
from zipfile import ZipFile

from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'teaching_website'))
from build_developer_starter import files, archive, DESTINATION

ROUTES = ['developer', 'developer_cli', 'developer_testing', 'developer_quality', 'developer_ci', 'developer_release']
TITLES = {
    '': ['Developer quickstart', 'CLI reference', 'Testing Rune', 'Code quality', 'Continuous integration', 'What’s new in 0.3.2'],
    'es': ['Inicio para desarrolladores', 'Referencia de CLI', 'Pruebas en Rune', 'Calidad del código', 'Integración continua', 'Novedades de 0.3.2'],
    'fr': ['Démarrage développeur', 'Référence CLI', 'Tester en Rune', 'Qualité du code', 'Intégration continue', 'Nouveautés de 0.3.2'],
}


def starter(content):
    assert DESTINATION.read_bytes() == archive(), 'Regenerate the checked-in starter archive'
    with ZipFile(BytesIO(content)) as bundle:
        assert set(bundle.namelist()) == set(files())
        for name, expected in files().items():
            assert bundle.read(name) == expected, name
        with tempfile.TemporaryDirectory(prefix='rune-developer-download-') as folder:
            bundle.extractall(folder)
            binary = str(ROOT / 'target/debug/vectrune')
            for command in [['doctor', '.'], ['fmt', '.', '--check'], ['check', '.', '--deny-warnings'], ['test', '.', '--json']]:
                result = subprocess.run([binary, *command], cwd=folder, capture_output=True, text=True, check=True)
                if command[0] == 'test':
                    report = json.loads(result.stdout)
                    assert report['schema_version'] == 1
                    assert report['success'] and report['passed'] == 5
    print('Downloaded starter matches tested sources: doctor, fmt, check, and all five Rune tests pass', flush=True)


def check(base, screenshots):
    with urlopen(base + '/assets/content/developer/starter.zip') as response:
        starter(response.read())
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(permissions=['clipboard-read', 'clipboard-write'], accept_downloads=True, reduced_motion='reduce', viewport={'width': 1365, 'height': 1000})
        context.add_init_script('window.requestIdleCallback = () => 0')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        for locale, titles in TITLES.items():
            prefix = '/' + locale if locale else ''
            for route, title in zip(ROUTES, titles):
                page.goto(base + prefix + '/' + route + '/')
                expect(page.locator('main h1')).to_have_text(title)
                expect(page).to_have_title(title + ' — Vectrune 0.3.2')
                expect(page.locator('main')).to_have_attribute('data-route', route)
                expect(page.locator('.developer-nav a[aria-current="page"]')).to_have_count(1)
                assert '%i18n.' not in page.locator('main').inner_text()
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
            page.goto(base + prefix + '/developer/')
            code = page.locator('.command-block pre').first.inner_text()
            assert code == 'brew install davethomas11/vectrune/vectrune\nvectrune --version', repr(code)
            assert page.locator('.command-block pre').nth(1).inner_text() == 'vectrune doctor .\nvectrune fmt . --check\nvectrune check . --deny-warnings\nvectrune test .'
            page.locator('.command-copy').first.click()
            page.wait_for_function('navigator.clipboard.readText().then(text => text === ' + json.dumps(code) + ')')
            # Exercise actual lazy navigation before reloading the deep link.
            page.locator('.developer-nav a').nth(2).click()
            expect(page.locator('main h1')).to_have_text(titles[2])
            expect(page.locator('.developer-nav a[aria-current="page"]')).to_have_count(1)
            page.reload()
            expect(page.locator('main h1')).to_have_text(titles[2])
        page.goto(base + '/developer_testing/')
        expect(page.locator('main')).to_contain_text('invoke changeTempo 4')
        expect(page.locator('main')).to_contain_text('mock.downloads[0].filename')
        expect(page.locator('main')).to_contain_text('vectrune test examples/rune_studio --type logic --json')
        for locale, label, lang in [('es', 'Español', 'es'), ('fr', 'Français', 'fr'), ('', 'English', 'en-us')] * 2:
            page.locator('.language-summary').click()
            page.locator('.language-link', has_text=label).click()
            expect(page.locator('html')).to_have_attribute('lang', lang)
            expect(page.locator('main')).to_have_attribute('data-route', 'developer_testing')
            assert '/es/es' not in page.url and '/fr/es' not in page.url
        if screenshots:
            screenshots.mkdir(parents=True, exist_ok=True)
            page.goto(base + '/developer/')
            page.screenshot(path=str(screenshots / 'developer-desktop.png'))
        page.set_viewport_size({'width': 390, 'height': 844})
        for locale, titles in TITLES.items():
            prefix = '/' + locale if locale else ''
            page.goto(base + prefix + '/developer/')
            expect(page.locator('main h1')).to_have_text(titles[0])
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
            page.locator('a[download="vectrune-developer-starter.zip"]').scroll_into_view_if_needed()
            with page.expect_download() as event:
                page.locator('a[download="vectrune-developer-starter.zip"]').click()
            assert event.value.suggested_filename == 'vectrune-developer-starter.zip'
            page.goto(base + prefix + '/developer_ci/')
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
            expect(page.locator('.language-yaml')).to_contain_text('vectrune test . --json')
        if screenshots:
            page.goto(base + '/es/developer/')
            page.screenshot(path=str(screenshots / 'developer-mobile-es.png'))
        assert not errors, errors
        context.close()
        browser.close()
    print('18 localized pages: headings, metadata, lazy navigation, locale switching, copy, mobile layout, and downloads pass', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site-dir', type=Path)
    parser.add_argument('--url')
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    if args.url:
        check(args.url.rstrip('/'), args.screenshots)
    else:
        if not args.site_dir:
            parser.error('--site-dir or --url is required')
        with preview(args.site_dir) as base:
            check(base, args.screenshots)
