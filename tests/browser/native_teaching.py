"""Verify native teaching-site locale routes and dropdown switching."""
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from urllib.request import Request, urlopen

from playwright.sync_api import expect, sync_playwright
from rune_web_guide import ROOT


def check():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    source = ROOT / 'teaching_website/teaching.rune'
    with tempfile.NamedTemporaryFile(dir=source.parent, suffix='.rune', delete=False) as file:
        temporary = Path(file.name)
    temporary.write_text(source.read_text().replace('@App\n', f'@App\nport = {port}\n', 1))
    process = subprocess.Popen([str(ROOT / 'target/debug/vectrune'), str(temporary)], cwd=source.parent, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}'
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise AssertionError('Native teaching server exited')
            try:
                with urlopen(base + '/', timeout=1):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise AssertionError('Native teaching server did not start')
        for path in ['/', '/es/', '/fr/', '/es/studio', '/fr/web_forms', '/assets/routes/home.json', '/assets/routes/studio.json', '/assets/content/quickstart/app.rune']:
            with urlopen(Request(base + path, method='HEAD')) as response:
                assert response.status == 200, path
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            for route in ['', 'studio', 'web_forms']:
                page.goto(base + '/' + route)
                for folder, language, lang in [('es', 'Español', 'es'), ('fr', 'Français', 'fr'), ('', 'English', 'en-us')]:
                    page.locator('.language-summary').click()
                    page.locator('.language-link', has_text=language).click()
                    expect(page.locator('html')).to_have_attribute('lang', lang)
                    expect(page.locator('main')).to_have_attribute('data-route', route or 'home')
                    expected = base + '/' + '/'.join(value for value in [folder, route] if value)
                    assert page.url.rstrip('/') == expected.rstrip('/')
                    page.reload()
                    expect(page.locator('main')).to_have_attribute('data-route', route or 'home')
            page.goto(base + '/')
            page.locator('.sidebar [data-on-click="navigate(\'studio\')"]').click()
            expect(page.locator('.source-file')).to_have_count(15)
            assert not errors, errors
            browser.close()
        print('Native server: locale switching, deep links, refresh, lazy chunks and starter download passed', flush=True)
    finally:
        process.terminate()
        process.communicate(timeout=10)
        temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    check()
