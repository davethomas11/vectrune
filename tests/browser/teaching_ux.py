"""Check teaching-site UX against the same static routes used by deployment.

Build the CLI first. Run with --site-dir to reuse a generated site.
"""
import argparse
from contextlib import contextmanager
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen

from playwright.sync_api import expect, sync_playwright
from rune_web_guide import ROOT

sys.path.insert(0, str(ROOT / 'teaching_website'))
from build_site import build_site


def check_starter(directory):
    source = (directory / 'assets/first-api.rune').read_text()
    assert source == (ROOT / 'teaching_website/content/quickstart/app.rune').read_text()
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix='vectrune-first-api-') as folder:
        # Exercise the documented port-change option without occupying port 3000.
        Path(folder, 'app.rune').write_text(source.replace('port = 3000', f'port = {port}'))
        process = subprocess.Popen([str(ROOT / 'target/debug/vectrune'), 'app.rune'], cwd=folder, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                if process.poll() is not None:
                    raise AssertionError(process.stdout.read().decode())
                try:
                    with urlopen(f'http://127.0.0.1:{port}/health', timeout=1) as response:
                        assert response.status == 200 and response.read() == b'OK'
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                raise AssertionError('Starter API did not start')
        finally:
            process.terminate()
            process.communicate(timeout=10)
    print('Downloaded starter runs from an otherwise empty folder and returns OK', flush=True)


@contextmanager
def preview(directory, prefix='/'):
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    code = 'import sys; sys.path.insert(0, sys.argv[1]); from build_site import serve_site; serve_site(sys.argv[2], int(sys.argv[3]), sys.argv[4])'
    process = subprocess.Popen([sys.executable, '-c', code, str(ROOT / 'teaching_website'), str(directory), str(port), prefix], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}' + prefix.rstrip('/')
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise AssertionError('Preview server exited before becoming ready')
            try:
                with urlopen(Request(base + '/', method='HEAD'), timeout=1):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise AssertionError('Preview server did not start')
        yield base
    finally:
        process.terminate()
        process.communicate(timeout=10)


def check(base, directory, screenshots):
    manifest = json.loads((directory / 'routes.json').read_text())
    for locale in manifest['locales']:
        for route in manifest['routes']:
            path = '/'.join(part for part in [locale, '' if route == 'home' else route] if part)
            address = f'{base}/{path}/' if path else base + '/'
            with urlopen(Request(address, method='HEAD')) as response:
                assert response.status == 200, (locale, route)
    print('All', len(manifest['routes']) * len(manifest['locales']), 'public route/locale combinations return 200', flush=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(permissions=['clipboard-read', 'clipboard-write'], accept_downloads=True, reduced_motion='reduce', viewport={'width': 1440, 'height': 1000})
        # Exercise real lazy loads instead of letting idle prefetch hide them.
        context.add_init_script('window.requestIdleCallback = () => 0')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        # Repeated switching must replace the locale, never append it to the
        # current route or mistake the locale root for a page called 'es'.
        for route in ['', 'studio', 'web_forms']:
            page.goto(f'{base}/{route}/' if route else base + '/')
            for folder, language, lang in [('es', 'Español', 'es'), ('fr', 'Français', 'fr'), ('', 'English', 'en-us')] * 2:
                page.locator('.language-summary').click()
                link = page.locator('.language-link', has_text=language)
                target = '/' + '/'.join(part for part in [folder, route] if part)
                if not route: target = target.rstrip('/') + '/'
                expect(link).to_have_attribute('href', target)
                link.click()
                expect(page.locator('html')).to_have_attribute('lang', lang)
                expect(page.locator('main')).to_have_attribute('data-route', route or 'home')
                assert page.url.rstrip('/') == (base + target).rstrip('/')
                expect(page.locator('.not-found')).to_have_count(0)
                page.reload()
                expect(page.locator('main')).to_have_attribute('data-route', route or 'home')
        print('Repeated English/Spanish/French switching and refresh preserve home, Studio and lessons', flush=True)
        for locale in ['', 'es/', 'fr/']:
            page.goto(f'{base}/{locale}')
            expect(page.locator('main h1')).to_have_count(1)
            headline = page.locator('main h1').inner_text()
            assert '/fr/fr' not in page.url and '/es/es' not in page.url
            page.keyboard.press('Tab')
            expect(page.locator('.skip-link')).to_be_focused()
            page.keyboard.press('Enter')
            expect(page.locator('#content')).to_be_focused()
            expect(page.locator('.sidebar a.nav-link')).to_have_count(28)
            expect(page.locator('.sidebar [aria-current="page"]')).to_have_count(1)
            for width in [320, 390, 768, 1440]:
                page.set_viewport_size({'width': width, 'height': 844})
                page.evaluate('scrollTo(0, 0)')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (locale, width)
                if width == 390:
                    box = page.locator('.hero-actions .cta').bounding_box()
                    assert box['y'] >= 0 and box['y'] + box['height'] <= 844, (locale, box)
                    assert page.locator('.built-with-tag').evaluate('(e) => getComputedStyle(e).position') == 'static'
                    if screenshots:
                        page.screenshot(path=str(screenshots / ((locale[:2] or 'en') + '-mobile.png')))
                    page.locator('.navigation-toggle').click()
                    expect(page.locator('.navigation-toggle')).to_have_attribute('aria-expanded', 'true')
                    expect(page.locator('.navigation-toggle')).to_be_focused()
                    page.keyboard.press('Escape')
                    expect(page.locator('.navigation-toggle')).to_have_attribute('aria-expanded', 'false')
                    expect(page.locator('.navigation-toggle')).to_be_focused()
            page.set_viewport_size({'width': 1440, 'height': 1000})
            page.evaluate('scrollTo(0, 450)')
            page.wait_for_timeout(100)
            page.locator('.sidebar [data-on-click="navigate(\'rest_get\')"]').click()
            expect(page.locator('main h1')).to_be_focused()
            top = page.locator('main h1').bounding_box()['y']
            assert 70 <= top <= 180, (locale, top)
            expect(page.locator('#show-ast-button')).to_be_hidden()
            page.locator('.sandbox-advanced > summary').click()
            expect(page.locator('#show-ast-button')).to_be_visible()
            page.go_back()
            expect(page.locator('main h1')).to_have_text(headline)
            page.wait_for_function('Math.abs(scrollY - 450) < 3')
            # Explicit anchors still land on the requested section.
            page.locator('.site-nav a[href$="#quickstart"]').click()
            page.wait_for_function('document.activeElement.id === "quickstart"')
            page.locator('.sidebar [data-on-click="navigate(\'web_forms\')"]').click()
            expect(page.locator('main h1')).to_be_focused()
            expect(page.locator('.example-preview')).to_be_visible()
            # The same lesson must work on refresh, with server content.
            url = page.url
            page.reload()
            expect(page.locator('main h1')).to_be_visible()
            assert page.url.rstrip('/') == url.rstrip('/')
            if screenshots and not locale:
                page.screenshot(path=str(screenshots / 'lesson-desktop.png'))
            page.locator('.sidebar [data-on-click="navigate(\'home\')"]').click()
            expect(page.locator('main h1')).to_have_text(headline)
            command = page.locator('.command-block').first
            command.locator('.command-copy').click()
            assert page.evaluate('navigator.clipboard.readText()') == command.locator('code').text_content()
            with page.expect_download() as event:
                page.locator('a[download="app.rune"]').click()
            assert Path(event.value.path()).read_text() == (ROOT / 'teaching_website/content/quickstart/app.rune').read_text()
            page.locator('.hero-actions .cta').click()
            expect(page.locator('#sandbox')).to_be_focused()
            assert 70 <= page.locator('#sandbox').bounding_box()['y'] <= 180
            editor = page.locator('#sandbox-editor')
            original = editor.input_value()
            page.locator('#run-button').click()
            expect(page.locator('#sandbox-output .api-explorer')).to_be_visible()
            page.locator('#sandbox-output .api-explorer button').click()
            expect(page.locator('#sandbox-output')).to_contain_text('200')
            editor.fill(original + '\n# draft edit\n')
            expect(page.locator('#sandbox-edit-status')).to_be_visible()
            page.locator('.sandbox-reset').click()
            expect(editor).to_have_value(original)
            expect(editor).to_be_focused()
            expect(page.locator('#sandbox-edit-status')).to_be_hidden()
            expect(page.locator('#sandbox-output .api-explorer')).to_have_count(0)
            # Reset must win over an Apply that is still awaiting the emulator.
            reset_output = page.evaluate('''async () => {
                const pending = runSandbox(document.querySelector('#run-button'));
                resetSandbox(document.querySelector('.sandbox-reset'));
                await pending;
                return document.querySelector('#sandbox-output').textContent;
            }''')
            assert reset_output == page.evaluate('runeWebApp.state.i18n.Sandbox.reset_ready')
            print(locale or 'en/', 'home, mobile CTA, menu, skip, focus, history, anchors, lazy load, refresh, copy and download passed', flush=True)
        for locale in ['', 'es/', 'fr/']:
            for route in ['games', 'vectworms', 'studio']:
                page.set_viewport_size({'width': 1440, 'height': 1000})
                page.goto(f'{base}/{locale}{route}/')
                page.evaluate('scrollTo(0, 0)')
                box = page.locator('.example-preview').bounding_box()
                assert 0 < box['y'] < 800, (locale, route, box)
                expect(page.locator('.features-grid')).to_be_hidden()
                assert page.locator('.showcase-intro').evaluate('(e) => e.nextElementSibling.classList.contains("web-example")')
                if screenshots and not locale and route == 'studio':
                    page.screenshot(path=str(screenshots / 'studio-demo-first.png'))
                page.set_viewport_size({'width': 390, 'height': 844})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (locale, route)
        print('All showcases put the live demo before optional explanations on desktop and mobile', flush=True)
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.goto(base + '/studio/')
        page.locator('.language-summary').click()
        page.locator('.language-link', has_text='Français').click()
        expect(page).to_have_url(base + '/fr/studio/')
        expect(page.locator('html')).to_have_attribute('lang', 'fr')
        expect(page.locator('main')).to_have_attribute('data-route', 'studio')
        expect(page.locator('.source-file')).to_have_count(15)
        studio = page.frame_locator('.example-preview')
        tempo = studio.locator('body').evaluate('() => runeWebApp.state.tempo')
        studio.get_by_role('button', name='+4', exact=True).click()
        studio.locator('[data-on-click="saveToStorage"]').click()
        studio.get_by_role('button', name='+4', exact=True).click()
        studio.locator('[data-on-click="loadFromStorage"]').click()
        assert studio.locator('body').evaluate('() => runeWebApp.state.tempo') == tempo + 4
        with page.expect_download() as exported:
            studio.locator('[data-on-click="exportRune"]').click()
        song = Path(exported.value.path()).read_text()
        assert '@Music/vectraiders' in song and f'tempo = {tempo + 4}' in song
        print('Studio Save/Load works in the embedded preview and EXPORT .RUNE downloads the song', flush=True)
        # Destination links keep a useful URL for native new-tab navigation.
        with context.expect_page() as event:
            page.locator('.sidebar [data-on-click="navigate(\'web_components\')"]').click(button='middle')
        new_tab = event.value
        new_tab.wait_for_load_state()
        expect(new_tab.locator('main')).to_have_attribute('data-route', 'web_components')
        assert '/fr/web_components' in new_tab.url
        new_tab.close()
        page.goto(base + '/builtins/')
        label = page.locator('label[for="builtin-search"]').inner_text()
        expect(page.get_by_label(label, exact=True)).to_have_attribute('type', 'search')
        page.goto(base + '/not-a-page')
        expect(page.locator('main h1')).to_have_text('Page not found')
        page.locator('main a').click()
        expect(page.locator('main')).to_have_attribute('data-route', 'home')
        page.goto(base + '/fr/not-a-page')
        expect(page.locator('.not-found a')).to_have_attribute('href', '/fr/')
        page.locator('.not-found a').click()
        expect(page.locator('html')).to_have_attribute('lang', 'fr')
        expect(page.locator('main')).to_have_attribute('data-route', 'home')
        for broken in ['es/es', 'es/fr', 'fr/fr', 'fr/es']:
            page.goto(base + '/' + broken)
            page.locator('.language-summary').click()
            spanish = page.locator('.language-link', has_text='Español')
            expect(spanish).to_have_attribute('href', '/es/')
            spanish.click()
            expect(page.locator('html')).to_have_attribute('lang', 'es')
            expect(page.locator('main')).to_have_attribute('data-route', 'home')
        assert not errors, errors
        print('Language switch keeps Studio; native new-tab links and not-found recovery passed', flush=True)
        context.close()
        browser.close()


def run(directory, screenshots):
    check_starter(directory)
    with preview(directory) as base:
        check(base, directory, screenshots)


def check_hosting_prefix():
    with tempfile.TemporaryDirectory(prefix='vectrune-subpath-') as folder:
        directory = Path(folder) / 'guide'
        build_site(directory, ROOT / 'target/debug/vectrune', base='/guide/', selected_routes=['web_forms'])
        with preview(directory, '/guide/') as base:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch()
                page = browser.new_page()
                page.goto(base + '/fr/')
                expect(page.locator('main')).to_have_attribute('data-route', 'home')
                link = page.locator('.sidebar [data-on-click="navigate(\'web_forms\')"]')
                expect(link).to_have_attribute('href', '/guide/fr/web_forms')
                link.click()
                expect(page.locator('main h1')).to_be_focused()
                assert page.url == base + '/fr/web_forms'
                page.reload()
                expect(page.locator('main')).to_have_attribute('data-route', 'web_forms')
                expect(page.locator('html')).to_have_attribute('lang', 'fr')
                page.locator('.language-summary').click()
                page.locator('.language-link', has_text='English').click()
                expect(page).to_have_url(base + '/web_forms/')
                expect(page.locator('html')).to_have_attribute('lang', 'en-us')
                browser.close()
            print('Static hosting prefix preserves routes, refresh, assets and language switching', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    destination = parser.add_mutually_exclusive_group()
    destination.add_argument('--site-dir', type=Path)
    destination.add_argument('--url', help='Check a deployed site, including its public route inventory')
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    if args.url:
        with tempfile.TemporaryDirectory(prefix='vectrune-live-smoke-') as directory:
            with urlopen(args.url.rstrip('/') + '/routes.json') as response:
                Path(directory, 'routes.json').write_bytes(response.read())
            check(args.url.rstrip('/'), Path(directory), args.screenshots)
    elif args.site_dir:
        run(args.site_dir.resolve(), args.screenshots)
    else:
        with tempfile.TemporaryDirectory(prefix='vectrune-teaching-ux-') as directory:
            build_site(Path(directory), ROOT / 'target/debug/vectrune')
            run(Path(directory), args.screenshots)
    if not args.url:
        check_hosting_prefix()
