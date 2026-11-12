"""Exercise Rune Studio's browser behavior alongside studio.test.rune's native web tests.

Requires Python Playwright and Chromium, plus a built target/debug/vectrune.
Run: python3 tests/browser/rune_studio.py
"""
from contextlib import contextmanager
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
from threading import Thread

from playwright.sync_api import expect, sync_playwright
from rune_web_guide import QuietHandler, ROOT


@contextmanager
def studio_preview():
    with tempfile.TemporaryDirectory(prefix='rune-studio-browser-') as directory:
        result = subprocess.run(
            [str(ROOT / 'target/debug/vectrune'), str(ROOT / 'examples/rune_studio/rune_studio.rune'), '-o', 'html'],
            capture_output=True, text=True, check=True,
        )
        Path(directory, 'index.html').write_text(result.stdout, encoding='utf-8')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=directory))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}'
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


def check(base):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base)
        expect(page.locator('.studio-title')).to_have_text('RUNE STUDIO')
        expect(page.locator('.bpm-badge')).to_have_text('144 BPM')

        page.locator('[data-on-click="selectSong(\'moonlight\')"]').click()
        expect(page.locator('.bpm-badge')).to_have_text('108 BPM')
        expect(page.locator('[data-on-click="setTimeSignature(\'3/4\')"]')).to_have_class('btn-timesig active')
        page.get_by_role('button', name='+4', exact=True).click()
        expect(page.locator('.bpm-badge')).to_have_text('112 BPM')

        page.locator('[data-on-click="selectVoice(\'bass\')"]').first.click()
        page.locator('[data-on-click="clearActiveTrack"]').click()
        bass = page.locator('.track-rack').filter(has=page.locator('.track-name', has_text='TRIANGLE BASS'))
        expect(bass.locator('.track-score-box')).to_have_text('')
        page.locator('.matrix-keys-column [data-on-click="insertNote(\'E4\')"]').click()
        expect(bass.locator('.track-score-box')).to_have_text('E4:8')
        expect(page.locator('.badge-val')).to_have_text('E4')

        # Persist via controls, then reload the actual page to test browser storage.
        page.locator('[data-on-click="saveToStorage"]').click()
        page.reload()
        expect(page.locator('.studio-title')).to_have_text('RUNE STUDIO')
        page.locator('[data-on-click="selectSong(\'moonlight\')"]').click()
        expect(page.locator('.bpm-badge')).to_have_text('108 BPM')
        page.locator('[data-on-click="loadFromStorage"]').click()
        expect(page.locator('.bpm-badge')).to_have_text('112 BPM')
        expect(bass.locator('.track-score-box')).to_have_text('E4:8')
        expect(page.locator('.status-txt')).to_contain_text('Restored Moonlight')

        # Verify transport behavior, without claiming to measure audible output.
        page.locator('[data-on-click="playTrack"]').click()
        expect(page.locator('[data-on-click="pauseTrack"]')).to_be_visible()
        page.locator('[data-on-click="stopTrack"]').click()
        expect(page.locator('[data-on-click="playTrack"]')).to_be_visible()
        expect(page.locator('[data-on-click="pauseTrack"]')).to_have_count(0)
        expect(page.locator('.status-txt')).to_have_text('Stopped playback')

        page.locator('[data-on-click="setLowerTab(\'export\')"]').click()
        expect(page.locator('.code-preview')).to_contain_text('@Music/moonlight')
        expect(page.locator('.code-preview')).to_contain_text('tempo = 112')
        with page.expect_download() as exported:
            page.locator('[data-on-click="exportRune"]').click()
        assert exported.value.suggested_filename == 'moonlight.rune'
        song = Path(exported.value.path()).read_text(encoding='utf-8')
        assert '@Music/moonlight' in song and 'tempo = 112' in song
        assert 'time_signature = 3/4' in song
        assert 'bass:\n    E4:8' in song
        assert not errors, errors
        context.close()
        browser.close()
    print('Studio browser checks pass: presets, tempo, note editing, Save/Load after reload, Play/Stop, and .rune export', flush=True)


if __name__ == '__main__':
    with studio_preview() as base:
        check(base)
