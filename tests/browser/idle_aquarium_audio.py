"""Verify Glowtide's quiet pad score, gesture unlock and fullscreen sound controls."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))
PROBE = """
const probe = window.audioProbe = {contexts:[],buses:[],oscillators:0};
const Audio = window.AudioContext;
window.AudioContext = class extends Audio {
  constructor(...args) { super(...args); probe.contexts.push(this); }
  createOscillator() { probe.oscillators++; return super.createOscillator(); }
};
const connect = AudioNode.prototype.connect;
AudioNode.prototype.connect = function(destination,...args) {
  if (destination instanceof AudioDestinationNode) {
    const analyser=this.context.createAnalyser();
    analyser.fftSize=2048;
    probe.buses.push(analyser);
    connect.call(this,analyser);
    connect.call(analyser,destination);
    return destination;
  }
  return connect.call(this,destination,...args);
};
probe.rms = () => {
  const analyser=probe.buses[0];
  if (!analyser) return 0;
  const data=new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  return Math.sqrt(data.reduce((sum,n)=>sum+n*n,0)/data.length);
};
"""

with tempfile.TemporaryDirectory(prefix="glowtide-audio-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "aquarium.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/idle_aquarium/idle_aquarium.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script(PROBE)
    page.goto(preview.as_uri())
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert page.evaluate("audioProbe.contexts.length") == 0, "Music must wait for a gesture"
    canvas = page.locator("canvas[data-rune-pixel-3d]")
    def hud_click(x,y):
        bounds=canvas.bounding_box()
        page.mouse.click(bounds["x"]+x/640*bounds["width"],bounds["y"]+y/400*bounds["height"])
    hud_click(615,25)
    page.wait_for_function("audioProbe.rms() > 0.00001")
    metadata = page.evaluate("({...__RunePixel3D.audioState})")
    assert metadata["track"] == "glowtide_drift", metadata
    assert metadata["tempo"] == 64 and metadata["totalBars"] == 16, metadata
    assert page.evaluate("audioProbe.oscillators") >= 5
    assert page.evaluate("audioProbe.rms()") < 0.05, "Keep the pad bed unobtrusive"
    page.keyboard.press("Tab")
    assert page.evaluate("__RunePixel3D.audioState.track") == "glowtide_drift"

    mute = page.get_by_role("button", name="Toggle aquarium sound", exact=True)
    assert not page.evaluate("__RunePixel3D.muted")
    mute.click()
    assert page.evaluate("__RunePixel3D.muted"), "Shell sound button must toggle immediately"
    expect(mute).to_have_attribute("aria-pressed", "true")
    page.wait_for_function("audioProbe.rms() < 0.0000001")
    before = page.evaluate("__RunePixel3D.app.state.ticks")
    page.wait_for_function(f"__RunePixel3D.app.state.ticks > {before}")
    page.keyboard.press("m")
    expect(mute).to_have_attribute("aria-pressed", "false")
    page.wait_for_function("audioProbe.rms() > 0.00001")
    page.keyboard.press("p")
    page.wait_for_function("audioProbe.rms() < 0.0000001")
    assert page.evaluate("__RunePixel3D.audioState.isPaused")
    page.keyboard.press("p")
    page.wait_for_function("audioProbe.rms() > 0.00001")

    page.locator("[data-pixel-fullscreen]").click()
    page.wait_for_function("document.fullscreenElement !== null")
    hud_click(577,25)
    assert page.evaluate("__RunePixel3D.muted")
    page.wait_for_function("audioProbe.rms() < 0.0000001")
    hud_click(577,25)
    page.wait_for_function("audioProbe.rms() > 0.00001")
    assert not errors, errors
    browser.close()

print("Glowtide audio: quiet pads, gesture unlock, mute, pause and fullscreen passed.")
