"""Check the searchable technical reference, downloads, and documented wire APIs.

    python3 tests/browser/api_docs.py --site-dir /tmp/vectrune-docs-site
"""
import argparse
from contextlib import contextmanager
import json
from pathlib import Path
import shlex
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

ROOT = Path(__file__).resolve().parents[2]
CATALOG = json.loads((ROOT / 'knowledge/reference/api-docs.json').read_text())


@contextmanager
def running_api(source):
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    with tempfile.TemporaryDirectory(prefix='vectrune-api-docs-') as folder:
        app = Path(folder) / 'app.rune'
        app.write_text(source.replace('port = 3000', f'port = {port}'))
        with tempfile.TemporaryFile() as log:
            process = subprocess.Popen([str(ROOT / 'target/debug/vectrune'), str(app)], stdout=log, stderr=log)
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        log.seek(0)
                        raise AssertionError(log.read().decode())
                    try:
                        with socket.create_connection(('127.0.0.1', port), timeout=0.1):
                            break
                    except OSError:
                        time.sleep(0.1)
                else:
                    raise AssertionError('API did not start')
                yield f'http://127.0.0.1:{port}'
            finally:
                process.terminate()
                process.wait(timeout=10)


def wire_examples(directory):
    source = (directory / 'assets/content/docs/app.rune').read_text()
    assert source == (ROOT / 'teaching_website/content/docs/app.rune').read_text()
    with running_api(source) as api:
        with urlopen(api + '/health') as response:
            assert response.read() == b'OK'
        with urlopen(api + '/greetings/Ada') as response:
            assert response.headers.get_content_type() == 'text/plain'
            assert json.load(response) == {'name': 'Ada'}
        for body, status in [({'name': 'Ada', 'enthusiastic': True}, 201), ({'name': 'Ada'}, 400), ({'name': 'Ada', 'enthusiastic': 'yes'}, 400)]:
            request = Request(api + '/greetings', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
            try:
                response = urlopen(request)
            except HTTPError as error:
                response = error
            with response:
                assert response.status == status
        try:
            urlopen(Request(api + '/greetings', data=b'{', headers={'Content-Type': 'application/json'}))
        except HTTPError as error:
            assert error.code == 500
        else:
            raise AssertionError('Documented malformed JSON behavior changed')
        with urlopen(api + '/openapi.json') as response:
            contract = json.load(response)
        operation = contract['paths']['/greetings']['post']
        assert operation['requestBody']['content']['application/json']['schema']['$ref'] == '#/components/schemas/Greeting'
        assert list(operation['responses']) == ['200']
        assert contract['components']['schemas']['Greeting']['properties']['enthusiastic']['type'] == 'boolean'
        with urlopen(api + '/swagger-ui') as response:
            assert 'SwaggerUIBundle' in response.read().decode()
    graphql = next(page for page in CATALOG['pages'] if page['route'] == 'docs/graphql')
    with running_api((directory / 'assets/content/docs/graphql.rune').read_text()) as api:
        for section, expected in [(graphql['sections'][1], {'greeting': {'message': 'Hello from Rune'}}), (graphql['sections'][2], {'greet': {'message': 'Hello'}})]:
            # Run the exact documented JSON payload, including shell escaping.
            tokens = shlex.split(section['command'].split('curl ', 1)[1])
            payload = tokens[tokens.index('-d') + 1]
            with urlopen(Request(api + '/graphql', data=payload.encode(), headers={'Content-Type': 'application/json'})) as response:
                result = json.load(response)
                assert result == {'data': expected}, result
    with running_api((directory / 'assets/content/docs/websocket.rune').read_text()) as api:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            tab = browser.new_page()
            messages = tab.evaluate('''async url => {
                const clients = [new WebSocket(url), new WebSocket(url)];
                try {
                    await Promise.all(clients.map(socket => new Promise((resolve, reject) => {
                        socket.onopen = resolve;
                        socket.onerror = reject;
                        setTimeout(() => reject(new Error('WebSocket did not open')), 5000);
                    })));
                    const received = clients.map(socket => new Promise((resolve, reject) => {
                        socket.onmessage = event => resolve(event.data);
                        setTimeout(() => reject(new Error('Broadcast did not arrive')), 5000);
                    }));
                    clients[0].send('Hello from the browser');
                    return await Promise.all(received);
                } finally {
                    clients.forEach(socket => socket.close());
                }
            }''', api.replace('http://', 'ws://') + '/chat')
            assert messages == ['Hello from the browser'] * 2, messages
            browser.close()
    print('REST wire responses, OpenAPI, malformed JSON, GraphQL payloads, and two-client WebSocket broadcast pass', flush=True)


def browser_checks(base, directory, screenshots=None):
    from xml.etree import ElementTree as ET
    symbols = json.loads((directory / 'docs/search-index.json').read_text())
    urls = {entry['url'] for entry in symbols}
    assert len(urls) == len(symbols), 'Every entry/field needs a stable unique anchor'
    routes = [item.text.removeprefix('https://vectrune.com/').rstrip('/') for item in ET.parse(directory / 'docs/sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, permissions=['clipboard-read', 'clipboard-write'], reduced_motion='reduce')
        tab = context.new_page()
        errors = []
        tab.on('pageerror', lambda error: errors.append(str(error)))
        for locale in ['', 'es/', 'fr/']:
            for route in routes:
                response = tab.goto(f'{base}/{locale}{route}/')
                assert response.status == 200
                expect(tab.locator('article h1')).to_have_count(1)
                expect(tab.locator('link[rel="canonical"]')).to_have_attribute('href', f'https://vectrune.com/{route}/')
                expect(tab.locator('html')).to_have_attribute('lang', 'en')
        # Verify every search result URL points at a server-rendered anchor.
        from html.parser import HTMLParser
        class Anchors(HTMLParser):
            def __init__(self):
                super().__init__(); self.ids = set()
            def handle_starttag(self, tag, attrs):
                value = dict(attrs).get('id')
                if value:
                    assert value not in self.ids, value
                    self.ids.add(value)
        anchors = {}
        for entry in symbols:
            path, anchor = entry['url'].lstrip('/').split('#')
            if path not in anchors:
                parser = Anchors(); parser.feed((directory / path / 'index.html').read_text()); anchors[path] = parser.ids
            assert anchor in anchors[path], entry
        tab.goto(base + '/')
        tab.locator('.sidebar a', has_text='Language & API reference').click()
        expect(tab.locator('h1:visible')).to_have_text('Vectrune reference manual')
        tab.keyboard.press('/')
        search = tab.locator('#reference-search')
        expect(search).to_be_focused()
        for query, name in [('memory.set', 'memory.set'), ('set-memory', 'memory.set'), ('uuid', 'uuid.v4'), ('mouse_look', '@Scene.mouse_look')]:
            search.fill(query)
            expect(tab.locator('#search-results li a').first).to_have_text(name)
        tab.locator('#search-results li a').first.click()
        expect(tab.locator('h1:visible')).to_have_text('Pixel and 3D configuration')
        assert tab.url.endswith('#scene--mouse-look')
        tab.reload()
        expect(tab.locator('#scene--mouse-look')).to_be_visible()
        search.fill('max')
        tab.locator('#reference-category').select_option('web')
        expect(tab.locator('#search-results li a').first).to_have_text('max')
        expect(tab.locator('#search-results li').first).to_contain_text('Rune-Web')
        search.fill('there-is-no-such-vectrune-function')
        expect(tab.locator('#search-status')).to_contain_text('No matching entries')
        search.fill('<img src=x onerror=alert(1)>')
        expect(tab.locator('#search-results img')).to_have_count(0)
        tab.locator('#clear-search').click()
        expect(tab.locator('#reference-content')).to_be_visible()
        tab.goto(base + '/docs/?q=csv.read')
        expect(tab.locator('#search-results li a').first).to_have_text('csv.read')
        tab.locator('#search-results li a').first.click()
        expect(tab.locator('h1:visible')).to_have_text('Native functions')
        tab.go_back()
        expect(tab.locator('#search-results li a').first).to_have_text('csv.read')
        tab.goto(base + '/docs/getting-started/')
        command = tab.locator('.code-example code').first.inner_text()
        tab.locator('.docs-copy').first.click()
        tab.wait_for_function('navigator.clipboard.readText().then(value => value === ' + json.dumps(command) + ')')
        for filename in ['app.rune', 'api.test.rune', 'graphql.rune', 'websocket.rune']:
            with urlopen(base + '/assets/content/docs/' + filename) as response:
                assert response.read() == (directory / 'assets/content/docs' / filename).read_bytes()
        # Search and chapter browsing must still work at narrow phone widths.
        tab.set_viewport_size({'width': 390, 'height': 844})
        for route in routes:
            tab.goto(base + '/' + route + '/')
            expect(tab.locator('#reference-search')).to_be_visible()
            assert not tab.evaluate('document.documentElement.scrollWidth > innerWidth'), route
        tab.goto(base + '/docs/')
        tab.locator('.docs-menu summary').click()
        tab.locator('.docs-menu').get_by_role('link', name='Native functions', exact=True).click()
        expect(tab.locator('h1:visible')).to_have_text('Native functions')
        search.fill('to-number')
        expect(tab.locator('#search-results li a').first).to_have_text('to-number')
        tab.locator('#search-results li a').first.click()
        expect(tab.locator('#to-number')).to_be_visible()
        if screenshots:
            screenshots.mkdir(parents=True, exist_ok=True)
            tab.screenshot(path=str(screenshots / 'reference-mobile.png'))
            tab.set_viewport_size({'width': 1440, 'height': 1000})
            tab.goto(base + '/docs/library/native/#to-number')
            tab.screenshot(path=str(screenshots / 'reference-desktop.png'))
            tab.goto(base + '/docs/')
            search.fill('memory')
            expect(tab.locator('#search-results li').first).to_be_visible()
            tab.screenshot(path=str(screenshots / 'reference-search.png'))
        # The dictionary and complete definitions remain crawlable without JS.
        plain = browser.new_context(java_script_enabled=False)
        static = plain.new_page()
        static.goto(base + '/docs/index/')
        expect(static.get_by_role('link', name='set-memory', exact=True)).to_have_count(1)
        static.goto(base + '/docs/library/native/#memory-set')
        expect(static.locator('#memory-set')).to_contain_text('memory.set <key>')
        assert not errors, errors
        browser.close()
    print(f'{len(routes) * 3} docs deep links, {len(symbols)} anchors, search/aliases/filters, no-JS reading, downloads, and mobile navigation pass', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site-dir', type=Path, required=True)
    parser.add_argument('--screenshots', type=Path)
    args = parser.parse_args()
    wire_examples(args.site_dir)
    with preview(args.site_dir) as base:
        browser_checks(base, args.site_dir, args.screenshots)
