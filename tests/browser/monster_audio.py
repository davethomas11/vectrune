"""Verify Monster City's real Web Audio output and its lifecycle in both shells."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PROBE = r'''
const probe = window.audioProbe = { contexts: [], buses: [], musicTimers: new Set(), oscillators: 0, noises: 0 };
const Audio = window.AudioContext;
window.AudioContext = class extends Audio {
  constructor(...args) {
    super(...args);
    probe.contexts.push(this);
  }
  createOscillator() { probe.oscillators++; return super.createOscillator(); }
  createBufferSource() { probe.noises++; return super.createBufferSource(); }
};
const connect = AudioNode.prototype.connect;
AudioNode.prototype.connect = function(destination, ...args) {
  if (destination instanceof AudioDestinationNode) {
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 1024;
    probe.buses.push({ node:this, analyser });
    connect.call(this, analyser);
    connect.call(analyser, destination);
    return destination;
  }
  return connect.call(this, destination, ...args);
};
const interval = window.setInterval, clear = window.clearInterval;
window.setInterval = (fn, ms, ...args) => {
  const id = interval(fn, ms, ...args);
  if (ms === 25) probe.musicTimers.add(id);
  return id;
};
window.clearInterval = id => { probe.musicTimers.delete(id); clear(id); };
probe.rms = () => {
  const bus = probe.buses[0]; if (!bus) return 0;
  const data = new Float32Array(bus.analyser.fftSize);
  bus.analyser.getFloatTimeDomainData(data);
  return Math.sqrt(data.reduce((sum, n) => sum + n*n, 0) / data.length);
};
'''

with tempfile.TemporaryDirectory(prefix='rune-pixel-audio-') as folder, sync_playwright() as playwright:
    folder = Path(folder)
    for source, name in [('monster_city.rune','game'), ('custom_shell.rune','shell')]:
        result = subprocess.run([str(ROOT/'target/debug/vectrune'), str(ROOT/'examples/monster_city'/source), '-o','html'], capture_output=True, text=True, check=True)
        (folder/f'{name}.html').write_text(result.stdout, encoding='utf-8')
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={'width':1365,'height':1000})
    errors = []
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script(PROBE)
    page.goto((folder/'game.html').as_uri())
    assert page.evaluate('audioProbe.contexts.length') == 0, 'Audio must wait for a user gesture'
    page.locator('canvas').click(position={'x':8,'y':8})
    page.wait_for_function('audioProbe.rms() > 0.0001')
    assert page.evaluate('__RunePixel.audioState.track') == 'monster_title'
    page.locator('[data-pixel-action="openStore"]').click()
    page.wait_for_function('__RunePixel.audioState.track === "monster_shop"')
    page.wait_for_function('audioProbe.rms() > 0.0001')
    assert page.evaluate('audioProbe.musicTimers.size') == 1
    before = page.evaluate('audioProbe.oscillators')
    page.locator('canvas').focus();page.keyboard.press('ArrowRight')
    assert page.evaluate('audioProbe.oscillators') > before
    for _ in range(3):
        page.get_by_role('button',name='NEXT',exact=True).click()
        assert page.evaluate('__RunePixel.audioState.track') == 'monster_shop'
        assert page.evaluate('audioProbe.musicTimers.size') == 1
    page.get_by_role('button',name='BACK TO TITLE',exact=True).click()
    page.wait_for_function('__RunePixel.audioState.track === "monster_title"')
    page.get_by_role('button',name='Start rampage').click()
    page.wait_for_function('audioProbe.rms() > 0.0001')
    assert page.evaluate('__RunePixel.audioState.track') == 'monster_city'
    assert page.evaluate('audioProbe.musicTimers.size') == 1
    assert page.evaluate('audioProbe.oscillators') > 0
    assert page.evaluate('audioProbe.noises') > 0
    mute = page.get_by_role('button',name='Mute game audio',exact=True)
    mute.click()
    expect(mute).to_have_attribute('aria-pressed','true')
    page.wait_for_function('audioProbe.rms() < 0.0000001')
    clock = page.evaluate('__RunePixel.app.state.clock')
    page.wait_for_function(f'__RunePixel.app.state.clock > {clock}')
    assert not page.evaluate('__RunePixel.paused')
    mute.click()
    page.wait_for_function('audioProbe.rms() > 0.0001')
    for _ in range(2):
        page.keyboard.press('p')
        assert page.evaluate('__RunePixel.audioState.isPaused')
        assert page.evaluate('audioProbe.musicTimers.size') == 0
        page.wait_for_function('audioProbe.rms() < 0.0000001')
        page.keyboard.press('p')
        page.wait_for_function('audioProbe.rms() > 0.0001')
        assert page.evaluate('audioProbe.musicTimers.size') == 1
    page.keyboard.press('m')
    expect(mute).to_have_attribute('aria-pressed','true')
    page.get_by_role('button',name='Restart',exact=False).click()
    assert page.evaluate('__RunePixel.muted')
    page.wait_for_function('audioProbe.rms() < 0.0000001')
    page.keyboard.press('m')
    page.wait_for_function('audioProbe.rms() > 0.0001')
    for _ in range(3):
        page.get_by_role('button',name='Restart',exact=False).click()
        assert page.evaluate('audioProbe.musicTimers.size') == 1
        assert page.evaluate('audioProbe.contexts.length') == 1
        assert page.evaluate('audioProbe.buses.length') == 1
    page.keyboard.down('ArrowRight');page.keyboard.down('Space')
    page.wait_for_function('__RunePixel.app.state.status === "won"',timeout=12000)
    page.keyboard.up('ArrowRight');page.keyboard.up('Space')
    assert not page.evaluate('__RunePixel.audioState.isPlaying')
    assert page.evaluate('audioProbe.musicTimers.size') == 0
    page.wait_for_timeout(650)
    page.wait_for_function('audioProbe.rms() < 0.0000001')
    page.goto((folder/'shell.html').as_uri())
    page.get_by_role('button',name='Start rampage').click()
    page.wait_for_function('audioProbe.rms() > 0.0001')
    canvas = page.locator('canvas').element_handle()
    page.wait_for_function('__RunePixel.app.state.clock > 65')
    assert canvas.evaluate('(node) => node.isConnected'), 'Music must not rerender the host shell'
    assert not page.evaluate('__RunePixel.paused')
    assert page.evaluate('Object.hasOwn(__RuneWeb.ctx().app.state,"playback_playing")') is False
    page.get_by_role('button',name='Toggle instructions').click()
    page.wait_for_function('__RunePixel.paused')
    assert page.evaluate('audioProbe.musicTimers.size') == 0
    page.get_by_role('button',name='Resume',exact=True).click()
    page.wait_for_function('audioProbe.rms() > 0.0001')
    assert page.evaluate('audioProbe.contexts.length') == 1
    page.evaluate('document.querySelector("canvas").remove()')
    page.wait_for_function('__RunePixel.paused && audioProbe.musicTimers.size === 0')
    page.wait_for_function('audioProbe.rms() < 0.0000001')
    assert not errors,errors
    browser.close()
print('Monster audio: audible PCM, music/effects, mute, pause/resume, restart, victory, shell isolation and cleanup pass')
