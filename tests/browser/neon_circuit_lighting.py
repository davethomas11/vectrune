"""Compare Neon Circuit lighting presets without changing resolution or depth."""
import base64
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = os.environ.get("NEON_LIGHTING_SHOTS")

with tempfile.TemporaryDirectory(prefix="neon-lighting-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "neon.html"
    preview.write_bytes(subprocess.check_output([
        "vectrune", str(ROOT / "examples/games/neon_circuit/neon_circuit.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(preview.as_uri())
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    switch = page.get_by_role("combobox", name="Lighting quality")
    assert switch.input_value() == "enhanced"
    switch.select_option("standard")
    page.reload()
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert switch.input_value() == "standard"
    assert not page.evaluate("__RunePixel3D.raycaster.enhancedLighting")
    switch.select_option("enhanced")
    page.wait_for_function("__RunePixel3D.raycaster.enhancedLighting")

    captures = page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state, ray = g.raycaster;
      const canvas = document.createElement('canvas');
      const w = canvas.width = ray.width, h = canvas.height = ray.height;
      if (w !== 576 || h !== 360) throw Error('Unexpected render resolution');
      const paint = canvas.getContext('2d');
      const makePng = pixels => {
        paint.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer),w,h),0,0);
        return canvas.toDataURL().split(',')[1];
      };
      const captures = [];
      function compare(name) {
        ray.setEnhancedLighting(false);
        const standard = g.frame().slice(), depth = ray.pixelDepth.slice();
        ray.setEnhancedLighting(true);
        const enhanced = g.frame().slice();
        const changed = enhanced.reduce((n,p,i) => n + (p !== standard[i]), 0);
        if (changed < 120 || ray.pixelDepth.some((d, i) => d !== depth[i])) {
          throw Error(name + ' should change color while keeping depth, changed ' + changed);
        }
        captures.push([name, makePng(standard), makePng(enhanced), changed]);
      }
      compare('01_title');
      g.invoke('load_stage', [0]);
      compare('02_entrance');
      g.invoke('on_boss_defeated');
      for(let i=0;i<101;i++) g.step({});
      compare('03_flip');
      for(let i=0;i<19;i++) g.step({});
      compare('04_overhead');
      g.invoke('load_stage', [6]);
      g.invoke('on_boss_defeated');
      for(let i=0;i<149;i++) g.step({});
      if(!s.escape_first_person) throw Error('Expected a first-person return');
      for(let i=0;i<18;i++) g.step({aim_up:true,fire:true});
      compare('05_first_person');
      return captures;
    }""")
    if SHOTS:
        Path(SHOTS).mkdir(parents=True, exist_ok=True)
        for name, standard, enhanced, _ in captures:
            for label, pixels in [("standard", standard), ("enhanced", enhanced)]:
                (Path(SHOTS) / f"{name}_{label}.png").write_bytes(base64.b64decode(pixels))
    switch.select_option("standard")
    page.wait_for_function("!__RunePixel3D.raycaster.enhancedLighting")
    assert not errors, errors
    browser.close()
    print("Enhanced lighting pixel comparisons passed.")
