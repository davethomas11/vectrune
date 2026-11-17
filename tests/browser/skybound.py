"""Skybound: actual-input course traversal, third-person rendering and touch."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="skybound-") as folder, sync_playwright() as pw:
    html = subprocess.run(
        [str(ROOT / "target/debug/vectrune"), str(ROOT / "examples/skybound/skybound.rune"), "-o", "html"],
        capture_output=True, text=True, check=True,
    ).stdout
    game_file = Path(folder) / "game.html"
    game_file.write_text(html)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(game_file.as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    page.locator("canvas").click()
    assert page.evaluate('__RunePixel3D.app.state.status') == "title"
    page.locator("[data-pixel-start]").click()
    expect(page.locator(".launch")).not_to_be_visible()
    page.locator("canvas").click()
    assert page.evaluate("document.pointerLockElement === null")
    assert not page.evaluate("__RunePixel3D.app.state.checkpoint_active")
    # Exercise the actual keyboard adapter, including pause and camera commands.
    page.keyboard.down("ArrowUp")
    page.wait_for_function("__RunePixel3D.app.state.player.x > 7.3")
    page.keyboard.up("ArrowUp")
    page.keyboard.press("p")
    expect(page.locator(".pause-menu")).to_be_visible()
    tick = page.evaluate("__RunePixel3D.app.state.ticks")
    page.wait_for_timeout(150)
    assert page.evaluate("__RunePixel3D.app.state.ticks") == tick
    page.locator(".pause-menu [data-pixel-pause]").click()
    expect(page.locator(".pause-menu")).not_to_be_visible()
    before = page.evaluate("__RunePixel3D.app.state.yaw")
    page.keyboard.down("e")
    page.wait_for_function("(yaw) => __RunePixel3D.app.state.yaw > yaw + 6", arg=before)
    page.keyboard.up("e")
    # Exercise controller polling through the browser adapter as well.
    page.evaluate("""() => {
      window.__skyPad={index:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false,touched:false}))};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[__skyPad]});
      __skyPad.buttons[0].value=1;
    }""")
    page.wait_for_function("__RunePixel3D.app.state.player.z > 3.3")
    page.evaluate("Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]})")
    # Restart, then traverse every gap without setting positions or inventory.
    route = page.evaluate("""() => {
      const g=__RunePixel3D, s=g.app.state, route=[];
      g.start(); g.invoke('center_camera');
      function ticks(n,input={}) { for(let i=0;i<n;i++) g.step(input); }
      function move(n,input) { ticks(n,input); ticks(8); }
      function landed(z) {
        if(s.player.z!==z || s.hearts!==3) throw Error('Unreachable island '+z);
        route.push({x:s.player.x,y:s.player.y,z:s.player.z});
        const render=g.renderState();
        if(render.camera===s.player || !render.things.some(t=>t.model.startsWith('sky/hero')))
          throw Error('Third-person avatar/camera binding missing');
        if(!g.frame().every(pixel=>(pixel>>>24)===255)) throw Error('Invalid framebuffer');
        // Every orbit angle must retain a valid, in-volume camera.
        const yaw=s.yaw;
        for(let angle=0;angle<360;angle+=45) {
          s.yaw=angle; for(let i=0;i<16;i++)g.invoke('update_view'); g.frame();
        }
        s.yaw=yaw; for(let i=0;i<16;i++)g.invoke('update_view');
      }
      move(18,{forward:true});
      ticks(25,{forward:true,jump:true}); ticks(10); landed(4);
      move(9,{forward:true});
      ticks(10,{forward:true,right:true,jump:true});
      ticks(15,{forward:true,jump:true}); ticks(10); landed(5);
      move(10,{forward:true}); move(21,{right:true});
      ticks(25,{right:true,jump:true}); ticks(10); landed(6);
      move(16,{back:true});
      if(!s.checkpoint_active) throw Error('Checkpoint not activated');
      move(2,{right:true}); move(4,{back:true});
      ticks(25,{back:true,jump:true}); ticks(10); landed(7);
      move(13,{back:true});
      ticks(25,{back:true,jump:true}); ticks(10); landed(8);
      move(5,{right:true});
      if(s.status!=='won' || s.collected<5) throw Error('Summit or coin collection failed');
      return route;
    }""")
    assert len(route) == 5
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    assert page.evaluate("__RunePixel3D.app.state.collected") == 0
    page.locator("canvas").screenshot(path="/private/tmp/skybound-play.png")

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.goto(game_file.as_uri())
    mobile.wait_for_function('typeof __RunePixel3D !== "undefined"')
    expect(mobile.locator(".rune-control-touch")).not_to_be_visible()
    mobile.locator("[data-pixel-start]").tap()
    expect(mobile.locator(".rune-control-touch")).to_be_visible()
    assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth")
    jump = mobile.locator('[data-control-touch="jump"]')
    jump.dispatch_event("pointerdown", {"pointerId": 11, "pointerType": "touch", "bubbles": True})
    mobile.wait_for_function("__RunePixel3D.app.state.player.z > 3.3")
    jump.dispatch_event("pointerup", {"pointerId": 11, "pointerType": "touch", "bubbles": True})
    orbit = mobile.locator('[data-control-touch="orbit_right"]')
    yaw = mobile.evaluate("__RunePixel3D.app.state.yaw")
    orbit.dispatch_event("pointerdown", {"pointerId": 12, "pointerType": "touch", "bubbles": True})
    mobile.wait_for_function("(yaw) => __RunePixel3D.app.state.yaw > yaw + 6", arg=yaw)
    orbit.dispatch_event("pointerup", {"pointerId": 12, "pointerType": "touch", "bubbles": True})
    mobile.screenshot(path="/private/tmp/skybound-mobile.png", full_page=True)
    assert not errors, errors
    browser.close()
print("Skybound course, camera, keyboard, pause, replay and mobile controls passed")
