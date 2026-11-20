"""Exercise Rune Studio's browser behavior alongside studio.test.rune's native web tests.

Requires Python Playwright and Chromium, plus a built target/debug/vectrune.
Run: python3 tests/browser/rune_studio.py
"""
from contextlib import contextmanager
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import re
import subprocess
import tempfile
from threading import Thread

from playwright.sync_api import expect, sync_playwright
from rune_web_guide import QuietHandler, ROOT


@contextmanager
def studio_preview():
    with tempfile.TemporaryDirectory(prefix='rune-studio-browser-') as directory:
        result = subprocess.run(
            [str(ROOT / 'target/debug/vectrune'), str(ROOT / 'examples/rune-web/studio/rune_studio.rune'), '-o', 'html'],
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


def check_fixed_bars(page):
    grid = page.locator('.matrix-grid-surface')
    first_note = grid.locator('.matrix-note-block').first
    following_note = grid.locator('.matrix-note-block').nth(1)
    divider = grid.locator('.matrix-bar-divider').first
    expect(grid).to_have_css('width', '1920px')
    expect(divider).to_have_css('left', '480px')
    expect(following_note).to_have_css('left', '60px')
    first_note.click(button='right')
    expect(first_note).to_have_css('left', '60px')
    expect(divider).to_have_css('left', '480px')
    expect(grid).to_have_css('width', '1920px')
    grid.click(position={'x': 15, 'y': 8 * 28 + 12})
    expect(first_note).to_have_css('left', '0px')
    expect(first_note.locator('.matrix-note-pitch')).to_have_text('E4')
    expect(following_note).to_have_css('left', '60px')

    page.get_by_role('button', name='3/4', exact=True).click()
    expect(grid).to_have_css('width', '1440px')
    expect(divider).to_have_css('left', '360px')
    page.locator('.bar-tab[data-on-click="selectBar(2)"]').click()
    expect(grid).to_have_css('width', '360px')
    expect(first_note).to_have_css('left', '0px')
    page.get_by_role('button', name='4/4', exact=True).click()
    expect(grid).to_have_css('width', '480px')


def drag_origin(target):
    return target.evaluate("""element => {
        element.scrollIntoView({block: 'nearest', inline: 'nearest'});
        const rect = element.getBoundingClientRect();
        return [rect.left + rect.width / 2, rect.top + rect.height / 2];
    }""")


def drag_mouse(page, target, dx, dy=0, blocked=False):
    x, y = drag_origin(target)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx, y + dy, steps=6)
    expect(page.locator('.studio-drag-preview')).to_have_count(1)
    if blocked:
        expect(page.locator('.studio-drag-blocked')).to_have_count(1)
    page.mouse.up()
    expect(page.locator('.studio-drag-preview')).to_have_count(0)


def check_note_drags(page):
    page.locator('[data-on-click="clearActiveTrack"]').click()
    grid = page.locator('.matrix-grid-surface')
    grid.click(position={'x': 15, 'y': 8 * 28 + 12})
    grid.click(position={'x': 255, 'y': 7 * 28 + 12})
    notes = grid.locator('.matrix-note-block')
    first = notes.first
    expect(notes).to_have_count(2)

    # Move in time and pitch, then stretch until the next note.
    drag_mouse(page, first.locator('.matrix-note-body'), 120, -28)
    expect(first).to_have_css('left', '120px')
    expect(first.locator('.matrix-note-pitch')).to_have_text('F4')
    drag_mouse(page, first.locator('[data-studio-resize]'), 90)
    expect(first).to_have_css('width', '116px')
    expect(notes.nth(1)).to_have_css('left', '240px')

    # Occupied targets preserve the original note, and a free bar accepts it.
    drag_mouse(page, first.locator('.matrix-note-body'), 120, blocked=True)
    expect(first).to_have_css('left', '120px')
    drag_mouse(page, first.locator('.matrix-note-body'), 360)
    moved = notes.nth(1)
    expect(moved).to_have_css('left', '480px')
    expect(moved).to_have_css('width', '116px')
    drag_mouse(page, moved.locator('[data-studio-resize]'), -60)
    expect(moved).to_have_css('width', '56px')
    expect(notes).to_have_count(2)
    expect(grid).to_have_css('width', '1920px')

    page.get_by_label('Open song').select_option('vectraiders')


def check_polyphony(page):
    page.locator('[data-on-click="clearActiveTrack"]').click()
    grid = page.locator('.matrix-grid-surface')
    grid.click(position={'x': 15, 'y': 12 * 28 + 12})
    grid.click(position={'x': 15, 'y': 8 * 28 + 12})
    notes = grid.locator('.matrix-note-block')
    low = notes.filter(has=page.locator('.matrix-note-pitch', has_text='C4'))
    high = notes.filter(has=page.locator('.matrix-note-pitch', has_text='E4'))
    expect(notes).to_have_count(2)
    expect(low).to_have_css('left', '0px')
    expect(high).to_have_css('left', '0px')

    drag_mouse(page, high.locator('[data-studio-resize]'), 60)
    expect(high).to_have_css('width', '116px')
    expect(low).to_have_css('width', '56px')
    drag_mouse(page, low.locator('.matrix-note-body'), 30, 28)
    moved = notes.filter(has=page.locator('.matrix-note-pitch', has_text='B3'))
    expect(moved).to_have_css('left', '30px')
    expect(high).to_have_css('left', '0px')
    moved.click(button='right')
    expect(notes).to_have_count(1)
    expect(high).to_have_css('width', '116px')

    grid.click(position={'x': 15, 'y': 5 * 28 + 12})
    page.locator('[data-on-click="saveToStorage"]').click()
    page.locator('[data-on-click="clearActiveTrack"]').click()
    page.get_by_label('Open song').select_option('reload_saved')
    expect(notes).to_have_count(2)
    page.locator('[data-on-click="setLowerTab(\'export\')"]').click()
    expect(page.locator('.code-preview')).to_contain_text('lead_studio_1:')
    expect(page.locator('.code-preview')).to_contain_text('instruments = {"lead":"square"')
    with page.expect_download() as exported:
        page.locator('[data-on-click="exportRune"]').click()
    song = Path(exported.value.path()).read_text(encoding='utf-8')
    assert 'lead_studio_1:\n    ' in song
    assert '"lead_studio_1":"square"' in song
    page.keyboard.press('Space')
    page.wait_for_function("""() => {
        const channels = window.audioSync.getSnapshot().channelStepIds;
        return 'lead' in channels && 'lead_studio_1' in channels;
    }""")
    page.locator('.btn-pause').click()
    page.locator('[data-on-click="setLowerTab(\'tracks\')"]').click()
    page.get_by_label('Open song').select_option('vectraiders')


def check_copy_paste(page):
    page.locator('[data-on-click="clearActiveTrack"]').click()
    grid = page.locator('.matrix-grid-surface')
    for tick, row in ((0, 8), (0, 5), (2, 12), (4, 13)):
        grid.click(position={'x': tick * 30 + 15, 'y': row * 28 + 12})
    notes = grid.locator('.matrix-note-block')
    selected = grid.locator('.selected-step')
    expect(notes).to_have_count(4)
    page.keyboard.press('Escape')

    for pitch in ('E4', 'G4'):
        notes.filter(has=page.locator('.matrix-note-pitch', has_text=pitch)).click(
            position={'x': 10, 'y': 12}, modifiers=['Shift'],
        )
    expect(selected).to_have_count(2)

    tools = page.locator('.matrix-note-tools')
    tools.get_by_role('button', name='Select', exact=True).click()
    viewport = page.locator('.matrix-container')
    viewport.evaluate("element => { element.scrollLeft = 0; element.scrollTop = 0; }")
    page.evaluate("window.scrollTo(0, 0)")
    bounds = grid.bounding_box()
    x, y = bounds['x'], bounds['y']
    page.mouse.move(x + 5, y + 4 * 28)
    page.mouse.down()
    page.mouse.move(x + 119, y + 13 * 28 - 1, steps=6)
    expect(page.locator('.studio-note-marquee')).to_be_visible()
    page.mouse.up()
    expect(selected).to_have_count(3)
    page.keyboard.press('Control+c')
    expect(page.locator('.status-txt')).to_have_text('Copied 3 notes')

    tools.get_by_role('button', name='Paste', exact=True).click()
    grid.click(position={'x': 15, 'y': 8 * 28 + 12})
    expect(page.locator('.status-txt')).to_contain_text('overlaps an existing note')
    expect(notes).to_have_count(4)

    page.locator('.bar-tab[data-on-click="selectBar(2)"]').click()
    grid.click(position={'x': 45, 'y': 8 * 28 + 12})
    expect(page.locator('.status-txt')).to_have_text('Pasted 3 notes')
    expect(selected).to_have_count(3)
    for pitch, left in (('E4', '30px'), ('G4', '30px'), ('C4', '90px')):
        copy = selected.filter(has=page.locator('.matrix-note-pitch', has_text=pitch))
        expect(copy).to_have_css('left', left)
        expect(copy).to_have_css('width', '56px')

    page.keyboard.press('Control+v')
    expect(grid).to_have_class(re.compile('paste-tool'))
    page.keyboard.press('Escape')
    expect(selected).to_have_count(0)
    page.get_by_label('Open song').select_option('vectraiders')


def check_transport(page):
    page.locator('.bar-tab[data-on-click="selectBar(0)"]').click()
    rail = page.get_by_role('slider', name='Playback position in beats')
    playhead = page.locator('#ruler-playhead')
    x, y = drag_origin(rail)
    width = rail.bounding_box()['width']
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + width / 8, y, steps=6)
    page.mouse.up()
    expect(rail).to_have_attribute('aria-valuenow', '10')
    expect(playhead).to_have_css('left', re.compile(r'.+px'))
    page.keyboard.press('Space')
    expect(page.locator('.btn-pause')).to_be_visible()
    for button in page.locator('.btn-transport-seek').all():
        expect(button).to_be_hidden()
    page.wait_for_function('() => window.audioSync.getSnapshot().currentBeat > 10.25')
    page.keyboard.press('Space')
    expect(page.locator('.status-txt')).to_contain_text('Paused')
    frozen = page.evaluate('window.audioSync.getSnapshot().currentBeat')
    expect(rail).to_have_attribute('aria-valuenow', format(round(frozen, 2), 'g'))
    page.wait_for_timeout(180)
    assert page.evaluate('window.audioSync.getSnapshot().currentBeat') == frozen

    page.locator('.btn-play').click()
    page.wait_for_function('(beat) => window.audioSync.getSnapshot().currentBeat > beat + 0.15', arg=frozen, timeout=1500)
    page.locator('.btn-pause').click()
    expect(page.locator('.status-txt')).to_contain_text('Paused')

    # Seek with the paused cursor in the grid and resume from the dragged position.
    parked = float(rail.get_attribute('aria-valuenow'))
    grip = page.locator('.seq-seek-grip')
    x, y = drag_origin(grip)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 60, y, steps=6)
    page.mouse.up()
    sought = float(rail.get_attribute('aria-valuenow'))
    assert abs(sought - parked - 0.5) <= 0.13, (parked, sought)
    page.keyboard.press('Space')
    page.wait_for_function('(beat) => window.audioSync.getSnapshot().currentBeat > beat + 0.15', arg=sought, timeout=1500)
    page.locator('.btn-pause').click()
    rail.press('Home')
    expect(rail).to_have_attribute('aria-valuenow', '0')
    page.get_by_role('button', name='Next bar').click()
    expect(rail).to_have_attribute('aria-valuenow', '4')
    page.locator('.bar-tab[data-on-click="selectBar(2)"]').click()
    page.get_by_role('button', name='Next bar').click()
    expect(rail).to_have_attribute('aria-valuenow', '8')
    expect(page.locator('.bar-tab.active')).to_have_text('BAR 3')
    page.get_by_role('button', name='Previous bar').click()
    expect(rail).to_have_attribute('aria-valuenow', '4')
    expect(page.locator('.bar-tab.active')).to_have_text('BAR 2')
    page.get_by_role('button', name='Back to start').click()
    expect(rail).to_have_attribute('aria-valuenow', '0')
    expect(page.locator('.bar-tab.active')).to_have_text('BAR 1')


def drag_touch(session, target, dx):
    x, y = drag_origin(target)
    session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    session.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx, 'y': y}]})
    session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


def check_touch_editor_and_strip(browser, base):
    context = browser.new_context(has_touch=True, is_mobile=True, viewport={'width': 390, 'height': 844})
    page = context.new_page()
    page.goto(base)
    viewport = page.locator('.matrix-container')
    keys = page.locator('.matrix-keys-column')
    expect(page.locator('.matrix-note-block').first).to_be_in_viewport()
    initial_key_x = keys.bounding_box()['x']
    viewport.evaluate('element => { element.scrollLeft = 180; element.scrollTop = 140; }')
    assert abs(keys.bounding_box()['x'] - initial_key_x) < 2
    assert viewport.evaluate('element => element.scrollTop') > 80
    assert page.evaluate('document.documentElement.scrollWidth === window.innerWidth')
    viewport.evaluate('element => { element.scrollLeft = 0; element.scrollTop = 0; }')
    page.locator('.voice-tab[data-on-click="selectVoice(\'drums\')"]').tap()
    page.locator('[data-on-click="clearActiveTrack"]').tap()
    page.locator('.bar-tab[data-on-click="selectBar(2)"]').tap()

    grid = page.locator('.matrix-grid-surface')
    grid.tap(position={'x': 75, 'y': 108})
    note = grid.locator('.matrix-note-block')
    expect(note).to_have_css('left', '60px')
    session = context.new_cdp_session(page)
    drag_touch(session, note.locator('.matrix-note-body'), 30)
    expect(note).to_have_css('left', '90px')
    drag_touch(session, note.locator('[data-studio-resize]'), 30)
    expect(note).to_have_css('width', '86px')

    page.locator('[data-on-click="setEditorMode(\'strip\')"]').tap()
    strip = page.locator('.step-strip')
    chip = strip.locator('.step-chip')
    expect(strip).to_have_css('width', '768px')
    expect(chip).to_have_css('left', '144px')
    expect(chip).to_have_css('width', '140px')
    expect(chip.locator('.step-pitch')).to_have_text('kick')
    expect(strip.locator('button, [data-on-click], [data-on-contextmenu], [data-studio-note], [data-studio-resize]')).to_have_count(0)
    expect(page.locator('.duration-picker, .bar-actions, .editor-tools, .drum-pads, .btn-timesig')).to_have_count(0)
    chip.tap()
    drag_touch(session, chip, 48)
    expect(chip).to_have_count(1)
    expect(chip).to_have_css('left', '144px')

    ruler = page.get_by_role('slider', name='Playback position in beats')
    ruler.tap(position={'x': ruler.bounding_box()['width'] * 4.75 / 16, 'y': 10})
    expect(ruler).to_have_attribute('aria-valuenow', '4.75')
    expect(page.locator('.step-strip-scroll .seq-playhead')).to_have_css('left', '144px')
    page.locator('.btn-play').tap()
    expect(strip.locator('.playing-step-now')).to_have_count(1)
    page.locator('.btn-pause').tap()

    page.locator('[data-on-click="setEditorMode(\'matrix\')"]').tap()
    expect(note).to_have_css('left', '90px')
    expect(note).to_have_css('width', '86px')
    note.get_by_title('Delete').tap()
    expect(note).to_have_count(0)
    for y in (12, 108):
        grid.tap(position={'x': 45, 'y': y})
    tools = page.locator('.matrix-note-tools')
    tools.get_by_role('button', name='Select', exact=True).tap()
    expect(grid).to_have_class(re.compile('selection-tool'))
    grid.tap(position={'x': 105, 'y': 54})
    expect(grid.locator('.selected-step')).to_have_count(0)
    for pitch in ('hihat', 'kick'):
        note.filter(has=page.locator('.matrix-note-pitch', has_text=pitch)).tap(position={'x': 10, 'y': 12})
    expect(grid.locator('.selected-step')).to_have_count(2)
    tools.get_by_role('button', name='Copy', exact=True).tap()
    expect(page.locator('.status-txt')).to_have_text('Copied 2 notes')
    tools.get_by_role('button', name='Paste', exact=True).tap()
    expect(grid).to_have_class(re.compile('paste-tool'))
    grid.tap(position={'x': 195, 'y': 54})
    expect(page.locator('.status-txt')).to_have_text('Pasted 2 notes')
    expect(note).to_have_count(4)
    pasted = grid.locator('.selected-step')
    expect(pasted).to_have_count(2)
    for item in pasted.all():
        expect(item).to_have_css('left', '180px')
    context.close()


def check_keyboard_audition(page, bass):
    score = bass.locator('.track-score-box')
    original_score = score.inner_text()
    page.evaluate('window.studioAuditions = []')
    side_keys = page.locator('.matrix-keys-column')
    bottom_keys = page.locator('.piano-roll')
    side_keys.get_by_role('button', name='E4', exact=True).click()
    bottom_keys.get_by_role('button', name='C4', exact=True).click()
    page.get_by_role('button', name='Sine', exact=True).click()
    side_keys.get_by_role('button', name='A4', exact=True).click()
    page.locator('.voice-tab[data-on-click="selectVoice(\'lead\')"]').click()
    bottom_keys.get_by_role('button', name='A4', exact=True).click()
    page.locator('.voice-tab[data-on-click="selectVoice(\'bass\')"]').click()

    sounds = page.evaluate('window.studioAuditions')
    assert [sound['wave'] for sound in sounds] == ['triangle', 'triangle', 'sine', 'square'], sounds
    for sound, expected in zip(sounds, [329.63, 261.63, 440, 440], strict=True):
        assert abs(sound['frequency'] - expected) < 0.1, sounds
    expect(page.get_by_role('button', name='Sine', exact=True)).to_have_class('pill-instrument active')
    expect(page.locator('.badge-val')).to_have_text('A4')
    expect(score).to_have_text(original_score)
    expect(page.locator('.matrix-note-block')).to_have_count(0)


def check_song_projects(page):
    page.get_by_role('button', name='New Song', exact=True).click()
    title = page.get_by_role('textbox', name='Song title')
    expect(title).to_have_value('Untitled 1')
    expect(page.locator('.bpm-badge')).to_have_text('120 BPM')
    expect(page.locator('.matrix-note-block')).to_have_count(0)
    title.fill('')
    title.press_sequentially('Night Drive', delay=35)
    expect(title).to_have_value('Night Drive')
    page.locator('.matrix-grid-surface').click(position={'x': 15, 'y': 8 * 28 + 12})
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.locator('.status-txt')).to_contain_text('Saved Night Drive')
    page.reload()
    expect(page.get_by_label('Open song').locator('option', has_text='Night Drive')).to_have_count(1)
    page.get_by_label('Open song').select_option(label='Night Drive')
    expect(title).to_have_value('Night Drive')
    expect(page.locator('.matrix-note-pitch')).to_have_text('E4')

    page.get_by_role('button', name='New Song', exact=True).click()
    expect(title).to_have_value('Untitled 2')
    expect(page.locator('.matrix-note-block')).to_have_count(0)
    page.get_by_label('Open song').select_option(label='Night Drive')
    expect(page.locator('.matrix-note-pitch')).to_have_text('E4')
    page.get_by_label('Open song').select_option('vectraiders')


def check(base):
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("""(() => {
            window.studioAuditions = [];
            const create = AudioContext.prototype.createOscillator;
            AudioContext.prototype.createOscillator = function() {
                const osc = create.call(this);
                const set = osc.frequency.setValueAtTime.bind(osc.frequency);
                const start = osc.start.bind(osc);
                let frequency;
                osc.frequency.setValueAtTime = (value, time) => {
                    frequency ??= value;
                    return set(value, time);
                };
                osc.start = (...args) => {
                    window.studioAuditions.push({ wave: osc.type, frequency });
                    return start(...args);
                };
                return osc;
            };
        })();""")
        page.goto(base)
        expect(page.locator('.studio-title')).to_have_text('RUNE STUDIO')
        expect(page.locator('.bpm-badge')).to_have_text('144 BPM')
        check_song_projects(page)
        check_note_drags(page)
        check_polyphony(page)
        check_copy_paste(page)
        check_fixed_bars(page)
        check_transport(page)

        page.get_by_label('Open song').select_option('moonlight')
        expect(page.locator('.bpm-badge')).to_have_text('108 BPM')
        expect(page.locator('[data-on-click="setTimeSignature(\'3/4\')"]')).to_have_class('btn-timesig active')
        page.get_by_role('button', name='+4', exact=True).click()
        expect(page.locator('.bpm-badge')).to_have_text('112 BPM')

        page.locator('[data-on-click="selectVoice(\'bass\')"]').first.click()
        page.locator('[data-on-click="clearActiveTrack"]').click()
        bass = page.locator('.track-rack').filter(has=page.locator('.track-name', has_text='VOICE 2: BASS'))
        expect(bass.locator('.track-score-box')).to_have_text('')
        # A long note placed on the last sixteenth still ends at the bar line.
        page.locator('.bar-tab[data-on-click="selectBar(2)"]').click()
        page.get_by_role('button', name='1/2', exact=True).click()
        grid = page.locator('.matrix-grid-surface')
        grid.click(position={'x': 345, 'y': 8 * 28 + 12})
        note = grid.locator('.matrix-note-block')
        expect(note).to_have_css('left', '330px')
        expect(note).to_have_css('width', '26px')
        note.get_by_title('Delete').click()
        expect(note).to_have_count(0)
        page.locator('.bar-tab[data-on-click="selectBar(0)"]').click()
        page.get_by_role('button', name='1/8', exact=True).click()
        check_keyboard_audition(page, bass)
        grid.click(position={'x': 15, 'y': 8 * 28 + 12})
        expect(bass.locator('.track-score-box')).to_have_text(re.compile(r'^E4:8'))
        expect(page.locator('.badge-val')).to_have_text('E4')

        page.locator('.btn-add-bar').click()
        expect(page.locator('.bar-tab.active')).to_have_text('BAR 5')

        # Persist via controls, then reload the actual page to test browser storage.
        page.locator('[data-on-click="saveToStorage"]').click()
        page.reload()
        expect(page.locator('.studio-title')).to_have_text('RUNE STUDIO')
        page.get_by_label('Open song').select_option('moonlight')
        expect(page.locator('.bpm-badge')).to_have_text('108 BPM')
        page.get_by_label('Open song').select_option('reload_saved')
        expect(page.locator('.bpm-badge')).to_have_text('112 BPM')
        expect(bass.locator('.track-score-box')).to_have_text(re.compile(r'^E4:8'))
        expect(page.locator('.status-txt')).to_contain_text('Restored Moonlight')
        expect(bass.locator('.badge-wave')).to_have_text('sine')
        page.locator('.voice-tab[data-on-click="selectVoice(\'bass\')"]').click()
        expect(page.get_by_role('button', name='Sine', exact=True)).to_have_class('pill-instrument active')
        expect(page.locator('.bar-tab')).to_have_count(6)

        # Verify transport behavior, without claiming to measure audible output.
        page.locator('[data-on-click="playTrack"]').click()
        expect(page.locator('[data-on-click="pauseTrack"]')).to_be_visible()
        page.locator('.btn-pause').click()
        expect(page.locator('[data-on-click="playTrack"]')).to_be_visible()
        expect(page.locator('[data-on-click="pauseTrack"]')).to_have_count(0)
        expect(page.locator('.status-txt')).to_contain_text('Paused')

        page.locator('[data-on-click="setLowerTab(\'export\')"]').click()
        expect(page.locator('.code-preview')).to_contain_text('@Music/moonlight')
        expect(page.locator('.code-preview')).to_contain_text('tempo = 112')
        with page.expect_download() as exported:
            page.locator('[data-on-click="exportRune"]').click()
        assert exported.value.suggested_filename == 'moonlight.rune'
        song = Path(exported.value.path()).read_text(encoding='utf-8')
        assert '@Music/moonlight' in song and 'tempo = 112' in song
        assert 'time_signature = 3/4' in song and 'bars = 5' in song
        assert 'bass:\n    E4:8' in song
        assert '"bass":"sine"' in song
        assert not errors, errors
        context.close()
        check_touch_editor_and_strip(browser, base)
        browser.close()
    print('Studio browser checks pass: new and saved songs, fixed 4/4 and 3/4 bars, polyphonic playback and copy/paste, keyboard audition and instrument switching, pause/resume and seek, grid placement, mouse and touch matrix editing, read-only Strip playback, right-click and touch removal, Save/Load, Play/Pause, and .rune export', flush=True)


if __name__ == '__main__':
    with studio_preview() as base:
        check(base)
