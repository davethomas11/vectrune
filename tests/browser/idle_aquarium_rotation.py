"""Mouse/touch orbit, easing, glass sides and visible starter-tank growth."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))

with tempfile.TemporaryDirectory(prefix="aquarium-rotation-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "aquarium.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/idle_aquarium/idle_aquarium.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    context = browser.new_context(has_touch=True, viewport={"width":1200,"height":1000})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script("window.requestAnimationFrame=()=>0")
    page.goto(preview.as_uri())
    page.wait_for_function("Boolean(window.__RunePixel3D)", polling=50)
    canvas = page.locator("canvas[data-rune-pixel-3d]")
    box = canvas.bounding_box()
    x, y = box["x"]+box["width"]*.4, box["y"]+box["height"]*.5
    page.mouse.move(x,y)
    page.mouse.down()
    page.mouse.move(x+box["width"]*.25,y,steps=10)
    page.mouse.up()
    target = page.evaluate("__RunePixel3D.app.state.orbit_target")
    assert abs(target-45)<.2, target
    assert page.evaluate("__RunePixel3D.app.state.orbit") == 0
    assert not page.evaluate("__RunePixel3D.app.state.profile_open")
    page.evaluate("__RunePixel3D.step({})")
    assert 0 < page.evaluate("__RunePixel3D.app.state.orbit") < 45
    page.evaluate("for(let i=0;i<60;i++) __RunePixel3D.step({})")
    assert page.evaluate("__RunePixel3D.app.state.orbit") == target
    assert page.evaluate("__RunePixel3D.app.state.tank_scale") == .75
    assert page.evaluate("""__RunePixel3D.app.state.tank.filter(t=>t.model.includes('glass')).length""") == 4
    assert page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state,scale=s.tank_scale;
      return s.tank.filter(t=>t.model.includes('glass')).every(t=>{
        const [a,b]=g.config.models[t.model].glass;
        const angle=t.angle??0,front=angle===90;
        return Math.abs(a*t.scale-8*scale)<1e-8 &&
          Math.abs(b*t.scale-(front?18:9)*scale)<1e-8 &&
          Math.abs(t.z-(2+4*scale))<1e-8 &&
          (front?Math.abs(t.x-20)<1e-8:Math.abs(t.y-30)<1e-8);
      });
    }""")

    cdp = context.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
    cdp.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":x-box["width"]*.2,"y":y}]})
    cdp.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
    target = page.evaluate("__RunePixel3D.app.state.orbit_target")
    assert abs(target-9) < .01, target
    assert not page.evaluate("__RunePixel3D.app.state.profile_open")

    page.evaluate("__RunePixel3D.invoke('toggle_menu')")
    page.mouse.move(x,y)
    page.mouse.down()
    page.mouse.move(x+100,y,steps=5)
    page.mouse.up()
    assert page.evaluate("__RunePixel3D.app.state.orbit_target") == target
    page.evaluate("__RunePixel3D.invoke('toggle_menu')")
    result = page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      s.progress.pearls=100000;
      const distance=()=>Math.hypot(s.camera.x-20,s.camera.y-30);
      const scales=[s.tank_scale],distances=[distance()];
      for(let i=0;i<2;i++){g.invoke('grow_tank');scales.push(s.tank_scale);distances.push(distance());}
      g.invoke('drag_orbit',[720]);
      for(let i=0;i<80;i++)g.step({});
      g.frame();
      return {scales,distances,target:s.orbit_target,orbit:s.orbit};
    }""")
    assert result["scales"] == [.75,1,1.25], result
    assert all(abs(d-27)<.001 for d in result["distances"]), result
    assert result["orbit"] == result["target"], result
    for size in range(3):
        page.evaluate("""size => {
          const g=__RunePixel3D;g.app.state.progress.tank=size;g.invoke('initialize');
        }""", size)
        for angle in range(0,361,5):
            page.evaluate("""angle => {
              const g=__RunePixel3D,s=g.app.state;
              s.orbit=angle;s.orbit_target=angle;g.invoke('animate');g.frame();
            }""", angle)
    assert not errors, errors
    browser.close()
