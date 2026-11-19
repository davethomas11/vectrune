"""Exercise real standalone hosts, Vect, embedded Rune and browser IndexedDB.

Build target/debug/vectrune first, then run python3 tests/browser/storage.py.
"""
import json
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from contextlib import contextmanager
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BINARY = ROOT / 'target/debug/vectrune'


@contextmanager
def running(source, port=None, secondary=None):
    if port is None:
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
    with tempfile.TemporaryFile() as log:
        command = [str(BINARY), str(source), '--port', str(port)]
        if secondary is not None:
            command += ['--secondary-app', str(secondary)]
        process = subprocess.Popen(command, stdout=log, stderr=log)
        try:
            for _ in range(100):
                if process.poll() is not None:
                    log.seek(0)
                    raise AssertionError(log.read().decode())
                try:
                    with socket.create_connection(('127.0.0.1', port), timeout=0.1):
                        break
                except OSError:
                    time.sleep(0.05)
            else:
                raise AssertionError('Server did not start')
            yield f'http://127.0.0.1:{port}'
        finally:
            process.terminate()
            process.wait(timeout=10)


def main():
    with tempfile.TemporaryDirectory(prefix='rune-storage-') as folder:
        source = Path(folder)
        for file in (ROOT / 'examples/data/storage').glob('*.rune'):
            shutil.copyfile(file, source / file.name)
        for file in (ROOT / 'examples/data/storage').glob('*.vect'):
            shutil.copyfile(file, source / file.name)
        for script, expected in [('checkout.vect', 'Stock remaining: 9'),
                                 ('replay.vect', 'events this page: 1'),
                                 ('replay.vect', 'events this page: 0')]:
            output = subprocess.check_output([str(BINARY), str(source / script)], text=True)
            assert expected in output, output
        with running(source / 'db-server.rune') as endpoint:
            (source / 'remote.rune').write_text('@DataSource/main\ntype = rune-db\nmode = remote\nendpoint = ' + endpoint + '\n')
            output = subprocess.check_output([str(BINARY), str(source / 'client.vect')], text=True)
            assert 'Changed count: 1' in output, output
            record = json.loads(subprocess.check_output([str(BINARY), 'db', 'get', 'notes', 'hello', '--endpoint', endpoint], text=True))
            assert record['value']['count'] == 1
        # Reopening another app proves the standalone owner released the file.
        with running(source / 'api.rune') as endpoint:
            with urlopen(endpoint + '/notes/hello') as response:
                assert json.load(response)['value']['count'] == 1
            body = json.dumps({'title': 'Embedded native'}).encode()
            with urlopen(Request(endpoint + '/notes/new', data=body, headers={'Content-Type': 'application/json'})) as response:
                assert response.status == 201
            with urlopen(endpoint + '/changes') as response:
                assert len(json.load(response)['events']) == 3
        with running(source / 'event-server.rune') as endpoint:
            subprocess.run([str(BINARY), 'events', 'append', 'orders', 'created', '--value', '{"id":1}', '--endpoint', endpoint], check=True, capture_output=True)
            page = json.loads(subprocess.check_output([str(BINARY), 'events', 'read', 'orders', '--endpoint', endpoint], text=True))
            assert page['events'][0]['sequence'] == '1'
        with running(source / 'web.rune') as endpoint, sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(endpoint)
            expect(page.get_by_role('heading', name='Rune DB in the browser')).to_be_visible()
            page.get_by_role('button', name='Save a note', exact=True).click()
            expect(page.get_by_text('Saved after transaction commit', exact=True)).to_be_visible()
            page.reload()
            page.get_by_role('button', name='Load saved note', exact=True).click()
            expect(page.get_by_text('Saved title: Hello from IndexedDB', exact=True)).to_be_visible()
            assert not errors, errors
            browser.close()
        # Verify the browser network adapter and CORS against the same native core.
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            db_port = probe.getsockname()[1]
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            web_port = probe.getsockname()[1]
        fullstack = ROOT / 'examples/data/storage/fullstack'
        for name in ['ui.rune', 'style.rune']:
            shutil.copyfile(fullstack / name, source / name)
        remote_web = (fullstack / 'app.rune').read_text().replace('http://127.0.0.1:7333', f'http://127.0.0.1:{db_port}')
        (source / 'remote-web.rune').write_text(remote_web)
        db_source = source / 'fullstack-database.rune'
        db_source.write_text((fullstack / 'database.rune').read_text().replace('http://127.0.0.1:3000', f'http://127.0.0.1:{web_port}').replace('http://localhost:3000', f'http://localhost:{web_port}').replace('port = 7333', f'port = {db_port}'))
        with running(source / 'remote-web.rune', web_port, secondary=db_source) as endpoint, sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(endpoint)
            page.get_by_label('Note title', exact=True).fill('A shared server note')
            page.get_by_label('Note title', exact=True).press('Tab')
            page.get_by_role('button', name='Save note', exact=True).click()
            expect(page.get_by_role('status')).to_have_text('Note and event committed together on the server')
            page.get_by_role('button', name='Add one view', exact=True).click()
            expect(page.get_by_text('Views: 1', exact=True)).to_be_visible()
            page.reload()
            page.get_by_role('button', name='Load note', exact=True).click()
            expect(page.get_by_text('Saved title: A shared server note', exact=True)).to_be_visible()
            expect(page.get_by_text('Views: 1', exact=True)).to_be_visible()
            page.get_by_role('button', name='Read new events', exact=True).click()
            expect(page.locator('pre')).to_contain_text('note.saved')
            page.get_by_role('button', name='Read new events', exact=True).click()
            expect(page.locator('pre')).to_have_text('[]')
            page.get_by_role('button', name='Replay events', exact=True).click()
            expect(page.locator('pre')).to_contain_text('note.saved')
            record = json.loads(subprocess.check_output([str(BINARY), 'db', 'get', 'notes', 'hello', '--endpoint', f'http://127.0.0.1:{db_port}'], text=True))
            assert record['value'] == {'title': 'A shared server note', 'views': 1}, record
            # A fresh browser context has no IndexedDB/session state from page 1.
            second = browser.new_page()
            second.goto(endpoint)
            second.get_by_role('button', name='Load note', exact=True).click()
            expect(second.get_by_text('Saved title: A shared server note', exact=True)).to_be_visible()
            assert not errors, errors
            browser.close()
        # The relative endpoint keeps both 127.0.0.1 and localhost same-origin.
        shutil.copyfile(fullstack / 'single-server.rune', source / 'single-server.rune')
        with running(source / 'single-server.rune') as endpoint, sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            for origin in [endpoint, endpoint.replace('127.0.0.1', 'localhost')]:
                page = browser.new_page()
                failures = []
                page.on('requestfailed', lambda request: failures.append(request.url))
                page.on('response', lambda response: failures.append(f'{response.status} {response.url}') if response.status >= 400 else None)
                page.goto(origin)
                expect(page.get_by_role('button', name='Add one view', exact=True)).to_be_disabled()
                page.get_by_role('button', name='Save note', exact=True).click()
                expect(page.get_by_role('status')).to_have_text('Note and event committed together on the server')
                page.get_by_role('button', name='Read new events', exact=True).click()
                expect(page.locator('.event-card').first).to_contain_text('note.saved')
                for width in [390, 1440]:
                    page.set_viewport_size({'width': width, 'height': 1000})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                assert not failures, failures
                page.close()
            record = json.loads(subprocess.check_output([str(BINARY), 'db', 'get', 'notes', 'hello', '--endpoint', endpoint], text=True))
            assert record['value']['title'] == 'Hello from Rune-Web'
            browser.close()
    print('Native hosts, CLI, remote Vect, embedded Rune, split/same-server browser persistence and replay passed')


if __name__ == '__main__':
    main()
