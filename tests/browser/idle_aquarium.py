"""Glowtide: lit tank composition, idle upgrades, controls and browser saves."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))

with tempfile.TemporaryDirectory(prefix="glowtide-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "aquarium.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/idle_aquarium/idle_aquarium.rune"),
        "-o", "html",
    ]))
    hud_fixture = Path(folder) / "hud.js"
    subprocess.run([
        str(ROOT / "runtime/rune-web/node_modules/.bin/esbuild"),
        str(ROOT / "runtime/rune-web/src/pixel3d/hud.ts"), "--bundle", "--format=iife",
        "--global-name=RuneHud", f"--outfile={hud_fixture}", "--log-level=error",
    ], check=True)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 1100})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(preview.as_uri())
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert page.locator(".game-surface button, .game-surface form, .game-surface input").count() == 0
    assert page.evaluate("__RunePixel3D.app.state.ui.buttons.length") == 6
    expect(page.get_by_label("Lighting quality")).to_have_value("enhanced")
    expect(page.locator('[data-pixel-action="buy_fish"]')).to_be_disabled()
    page.locator('[data-pixel-action="collect_treasure"]').click()
    expect(page.locator('[data-pixel-action="collect_treasure"]')).to_be_disabled()
    page.locator('[data-pixel-action="buy_fish"]').click()
    assert page.evaluate("__RunePixel3D.app.state.fish.length") == 4
    page.locator('[data-pixel-action="feed"]').click()
    expect(page.locator('[data-pixel-action="feed"]')).to_be_disabled()
    page.evaluate("() => { for(let i=0;i<60;i++) __RunePixel3D.step({}); }")
    page.locator('[data-pixel-action="grow_reef"]').click()
    assert page.evaluate("__RunePixel3D.app.state.progress.reef") == 1
    assert page.evaluate("__RunePixel3D.app.state.income") == 8

    # Compare the same frame, not two different moments in the animation.
    metrics = page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state, ray = g.raycaster;
      ray.setEnhancedLighting(false);
      const standard = g.frame().slice(), depth = ray.pixelDepth.slice();
      const lights = s.lights;
      s.lights = [];
      const unlit = g.frame().slice();
      s.lights = lights;
      ray.setEnhancedLighting(true);
      const enhanced = g.frame().slice();
      let centered = 0;
      for(let y=ray.height/4|0;y<ray.height*3/4;y++)
        for(let x=ray.width/4|0;x<ray.width*3/4;x++)
          if(Number.isFinite(depth[y*ray.width+x])) centered++;
      return {
        lit: standard.reduce((n,p,i)=>n+(p!==unlit[i]),0),
        bloom: enhanced.reduce((n,p,i)=>n+(p!==standard[i]),0),
        sameDepth: ray.pixelDepth.every((d,i)=>d===depth[i]),
        colors: new Set(enhanced).size, centered
      };
    }""")
    assert metrics["lit"] > 1000, metrics
    assert metrics["bloom"] > 100, metrics
    assert metrics["sameDepth"], metrics
    assert metrics["centered"] > 4000, metrics
    assert metrics["colors"] > 128, metrics

    canvas = page.locator("canvas[data-rune-pixel-3d]")
    canvas.focus()
    page.keyboard.press("l")
    assert page.evaluate("__RunePixel3D.app.state.progress.palette") == 1
    page.get_by_label("View tank from the right").click()
    assert page.evaluate("__RunePixel3D.app.state.orbit_target") == 15
    page.wait_for_function("__RunePixel3D.app.state.orbit > 14")
    canvas.focus()
    page.keyboard.down("ArrowLeft")
    page.wait_for_function("__RunePixel3D.app.state.orbit < 14")
    page.keyboard.up("ArrowLeft")
    page.locator("[data-pixel-pause]").click()
    page.wait_for_function("__RunePixel3D.paused")
    frozen = page.evaluate("__RunePixel3D.app.state.ticks")
    page.wait_for_timeout(150)
    assert page.evaluate("__RunePixel3D.app.state.ticks") == frozen
    page.locator("[data-pixel-pause]").click()
    page.wait_for_function("!__RunePixel3D.paused")

    saved = page.evaluate("({...__RunePixel3D.app.state.progress})")
    page.reload()
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert page.evaluate("__RunePixel3D.app.state.progress.fish") == saved["fish"]
    assert page.evaluate("__RunePixel3D.app.state.progress.reef") == saved["reef"]
    assert page.evaluate("__RunePixel3D.app.state.progress.palette") == saved["palette"]
    assert page.evaluate("__RunePixel3D.app.state.progress.pearls") >= saved["pearls"]
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies.map(b => b.care.id)") == [
        buddy["care"]["id"] for buddy in saved["buddies"]
    ]
    assert page.evaluate("__RunePixel3D.app.state.progress.critters.map(c => c.care.id)") == [
        critter["care"]["id"] for critter in saved["critters"]
    ]
    assert page.evaluate("__RunePixel3D.app.state.fed_ticks") == 0

    # Late-game scenery and both extreme camera positions must still render.
    page.evaluate("""() => {
      const g=__RunePixel3D, s=g.app.state;
      s.progress.pearls=100000;
      for(let i=0;i<20;i++) { g.invoke('buy_fish'); g.invoke('grow_reef'); }
      for(const direction of [-1,1]) {
        for(let i=0;i<8;i++) g.invoke('orbit_view',[direction]);
        g.frame();
      }
    }""")
    assert page.evaluate("__RunePixel3D.app.state.visitor[0].visible")
    expect(page.locator('[data-pixel-action="buy_fish"]')).to_be_disabled()
    expect(page.locator('[data-pixel-action="grow_reef"]')).to_be_disabled()
    page.get_by_label("Lighting quality").select_option("standard")
    page.reload()
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    expect(page.get_by_label("Lighting quality")).to_have_value("standard")
    assert page.evaluate("__RunePixel3D.app.state.fish.length") == 18
    page.get_by_label("Lighting quality").select_option("enhanced")

    def hud_click(target, row=None, touch=False):
        if row is None:
            canvas_click(target, 615, 25, touch)
            target.wait_for_function("__RunePixel3D.app.state.menu_open")
            return
        if not target.evaluate("__RunePixel3D.app.state.menu_open"):
            hud_click(target, touch=touch)
        if not target.evaluate("Boolean(window.RuneHud)"):
            target.add_script_tag(path=str(hud_fixture))
        position = target.evaluate("""row => {
          const c=document.querySelector('[data-rune-pixel-3d]'),r=c.getBoundingClientRect();
          const ui=structuredClone(__RunePixel3D.app.state.ui);
          // Include disabled rows to verify that clicking them stays inert.
          for(const item of ui.grid.items)item.disabled=false;
          const action=row===9?'close_menu':ui.grid.items[row].action;
          const h=RuneHud.collectHudHitRegions(c.width,c.height,ui,'playing',false).find(h=>h.action===action);
          return {x:r.x+(h.x+h.w/2)/c.width*r.width,y:r.y+(h.y+h.h/2)/c.height*r.height};
        }""", row)
        if touch:
            target.touchscreen.tap(position["x"], position["y"])
        else:
            target.mouse.click(position["x"], position["y"])

    def canvas_click(target, x, y, touch=False):
        bounds = target.locator("canvas[data-rune-pixel-3d]").bounding_box()
        px,py = bounds["x"]+x/640*bounds["width"],bounds["y"]+y/400*bounds["height"]
        target.touchscreen.tap(px,py) if touch else target.mouse.click(px,py)

    def keyboard_click(target, key, touch=False):
        cell = target.evaluate("""key => __RunePixel3D.keyboard.hits(640,400).find(h=>h.args[0]===key)""", key)
        assert cell, key
        canvas_click(target, cell["x"]+cell["w"]/2, cell["y"]+cell["h"]/2, touch)

    # Only the game surface enters fullscreen: these are canvas pixels,
    # not the shell buttons that remain outside it.
    page.locator("[data-pixel-fullscreen]").click()
    page.wait_for_function("document.fullscreenElement !== null")
    hud_click(page)
    assert page.evaluate("__RunePixel3D.app.state.menu_open")
    hud_click(page, 7)
    page.wait_for_function("!document.fullscreenElement")
    page.locator("[data-pixel-fullscreen]").click()
    page.wait_for_function("document.fullscreenElement !== null")
    page.evaluate("__RunePixel3D.app.state.progress.pearls=100000")
    page.evaluate("__RunePixel3D.invoke('update_labels')")
    hud_click(page, 3)
    assert page.evaluate("__RunePixel3D.app.state.progress.tank") == 1
    assert page.evaluate("__RunePixel3D.app.state.tank_capacity") == 24
    assert page.evaluate("__RunePixel3D.app.state.tank[0].scale") == 1
    hud_click(page, 1)
    assert page.evaluate("__RunePixel3D.app.state.fish.length") == 19
    hud_click(page, 0)
    assert page.evaluate("__RunePixel3D.app.state.fed_ticks") > 0
    page.evaluate("() => { for(let i=0;i<899 && !__RunePixel3D.app.state.eaten;i++) __RunePixel3D.step({}); }")
    assert page.evaluate("__RunePixel3D.app.state.eaten") > 0
    assert page.evaluate("__RunePixel3D.app.state.fed_ticks") > 0
    assert page.evaluate("__RunePixel3D.app.state.food.some(p=>!p.visible)")
    hud_click(page, 5)
    assert page.evaluate("__RunePixel3D.app.state.progress.palette") == 2
    hud_click(page, 9)
    assert not page.evaluate("__RunePixel3D.app.state.menu_open")
    page.keyboard.press("Tab")
    assert page.evaluate("__RunePixel3D.app.state.menu_open")
    page.evaluate("__RunePixel3D.app.state.menu_index=0")
    before_mood = page.evaluate("__RunePixel3D.app.state.progress.palette")
    page.keyboard.press("ArrowUp")
    assert page.evaluate("__RunePixel3D.app.state.menu_index") == 9
    page.keyboard.press("ArrowUp")
    page.keyboard.press("ArrowUp")
    page.keyboard.press("ArrowUp")
    page.keyboard.press("ArrowUp")
    assert page.evaluate("__RunePixel3D.app.state.menu_index") == 5
    page.keyboard.press("Enter")
    assert page.evaluate("__RunePixel3D.app.state.progress.palette") == (before_mood + 1) % 3
    assert not page.evaluate("__RunePixel3D.app.state.menu_open")
    hud_click(page)
    bounds = canvas.bounding_box()
    before_tap = page.evaluate("({...__RunePixel3D.app.state.progress})")
    # A sidebar consumes presses before gameplay mouse bindings, even on inert rows.
    page.evaluate("__RunePixel3D.controls.profile.mouse.Left={command:'cycle_lights'}")
    hud_click(page, 0)
    assert page.evaluate("__RunePixel3D.app.state.menu_open")
    assert page.evaluate("__RunePixel3D.app.state.progress.palette") == before_tap["palette"]
    page.mouse.click(bounds["x"] + bounds["width"] * .2, bounds["y"] + bounds["height"] * .5)
    assert not page.evaluate("__RunePixel3D.app.state.menu_open")
    assert page.evaluate("__RunePixel3D.app.state.progress.fish") == before_tap["fish"]
    assert page.evaluate("__RunePixel3D.app.state.progress.palette") == before_tap["palette"]
    page.evaluate("delete __RunePixel3D.controls.profile.mouse.Left")
    hud_click(page)
    page.keyboard.press("Tab")
    assert not page.evaluate("__RunePixel3D.app.state.menu_open")
    page.keyboard.press("Escape")
    page.wait_for_function("!document.fullscreenElement")
    page.reload()
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert page.evaluate("__RunePixel3D.app.state.progress.tank") == 1
    assert page.evaluate("__RunePixel3D.app.state.tank_capacity") == 24

    mobile = browser.new_page(
        viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
    )
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.goto(preview.as_uri())
    mobile.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth")
    mobile.evaluate("HTMLElement.prototype.requestFullscreen=undefined;HTMLElement.prototype.webkitRequestFullscreen=undefined")
    mobile.locator("[data-pixel-fullscreen]").tap()
    mobile.wait_for_function("document.documentElement.classList.contains('rune-pixel3d-expanded-page')")
    hud_click(mobile, touch=True)
    assert mobile.evaluate("__RunePixel3D.app.state.menu_open")
    hud_click(mobile, 5, touch=True)
    assert mobile.evaluate("__RunePixel3D.app.state.progress.palette") == 1
    hud_click(mobile, 0, touch=True)
    mobile.wait_for_function("__RunePixel3D.app.state.eaten > 0")
    hud_click(mobile, 9, touch=True)
    assert not mobile.evaluate("__RunePixel3D.app.state.menu_open")
    hud_click(mobile, touch=True)
    bounds = mobile.locator("canvas").bounding_box()
    mobile.touchscreen.tap(bounds["x"] + bounds["width"] * .2, bounds["y"] + bounds["height"] * .5)
    assert not mobile.evaluate("__RunePixel3D.app.state.menu_open")
    hud_click(mobile, touch=True)
    hud_click(mobile, 7, touch=True)
    mobile.wait_for_function("!document.documentElement.classList.contains('rune-pixel3d-expanded-page')")
    mobile.get_by_label("View tank from the left").tap()
    assert mobile.evaluate("__RunePixel3D.app.state.orbit_target") == -15
    assert mobile.evaluate("__RunePixel3D.app.state.fed_ticks") > 0

    # Fullscreen profiles stay inside the surface; input never triggers game shortcuts.
    def tap_fish(target, touch=False, dead=False):
        target.evaluate("__RunePixel3D.paused=true")
        point = target.evaluate("""dead => {
          const g=__RunePixel3D, {camera,things}=g.renderState(), ray=g.raycaster;
          g.frame();
          const a=Math.round(camera.angle*4096/360)%4096*2*Math.PI/4096;
          const dx=Math.cos(a),dy=Math.sin(a),p=camera.pitch*Math.PI/180;
          for (const [index,f] of g.app.state.fish.entries()) {
            if(Boolean(g.app.state.progress.buddies[index].dead)!==dead) continue;
            const x=f.x-camera.x,y=f.y-camera.y,z=f.z-(camera.z+1.25);
            const forward=x*dx+y*dy,d=forward*Math.cos(p)+z*Math.sin(p);
            const sx=ray.width/2*(1+(-x*dy+y*dx)/(d*Math.tan(ray.fov*Math.PI/360)));
            const sy=(ray.height>>1)-(z*Math.cos(p)-forward*Math.sin(p))*ray.height/d;
            if(g.pickThing('residents',sx,sy)===index) return {x:sx/ray.width,y:sy/ray.height};
          }
          throw Error('Expected a visible tappable fish');
        }""", dead)
        bounds = target.locator("canvas[data-rune-pixel-3d]").bounding_box()
        x,y = bounds["x"]+point["x"]*bounds["width"], bounds["y"]+point["y"]*bounds["height"]
        target.touchscreen.tap(x,y) if touch else target.mouse.click(x,y)
        if dead:
            assert not target.evaluate("__RunePixel3D.app.state.profile_open")
            assert target.evaluate("__RunePixel3D.app.state.nets[0].visible")
        else:
            assert target.evaluate("__RunePixel3D.app.state.profile_open")
            assert target.evaluate("__RunePixel3D.frameHud(__RunePixel3D.renderState()).ui.callout.screen") is not None

    mobile.locator("[data-pixel-fullscreen]").tap()
    mobile.wait_for_function("document.documentElement.classList.contains('rune-pixel3d-expanded-page')")
    mobile.evaluate("""() => {
      const g=__RunePixel3D; g.app.state.feed_cooldown=0;
      g.app.state.progress.pearls=10000; g.invoke('update_labels');
    }""")
    canvas_click(mobile, 25, 375, True)
    assert mobile.evaluate("__RunePixel3D.app.state.feed_cooldown") > 0
    before_fish = mobile.evaluate("__RunePixel3D.app.state.fish.length")
    canvas_click(mobile, 63, 375, True)
    assert mobile.evaluate("__RunePixel3D.app.state.fish.length") == before_fish + 1
    tap_fish(mobile, touch=True)
    original_index = mobile.evaluate("__RunePixel3D.app.state.selected_fish")
    canvas_click(mobile, 70, 146, True)
    assert mobile.evaluate("__RunePixel3D.app.state.keyboard_open")
    for _ in range(24):
        keyboard_click(mobile, "DELETE", True)
    for letter in "captain":
        keyboard_click(mobile, letter.upper(), True)
    keyboard_click(mobile, "SAVE", True)
    assert mobile.evaluate("__RunePixel3D.app.state.profile_name") == "captain"
    canvas_click(mobile, 210, 146, True)
    mobile.reload()
    mobile.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert mobile.evaluate(f"__RunePixel3D.app.state.progress.buddies[{original_index}].name") == "captain"
    tap_fish(page)
    # The connector follows swimming fish, not the original clicked position.
    before_line = page.evaluate("__RunePixel3D.frameHud(__RunePixel3D.renderState()).ui.callout.screen")
    page.evaluate("() => {__RunePixel3D.paused=false;for(let i=0;i<45;i++)__RunePixel3D.step({});__RunePixel3D.paused=true;}")
    after_line = page.evaluate("__RunePixel3D.frameHud(__RunePixel3D.renderState()).ui.callout.screen")
    assert before_line != after_line
    canvas_click(page, 70, 146)
    for _ in range(24):
        page.keyboard.press("Backspace")
    page.keyboard.down("S")
    assert page.evaluate("__RunePixel3D.keyboard.pressed.has('S')")
    page.keyboard.up("S")
    assert not page.evaluate("__RunePixel3D.keyboard.pressed.has('S')")
    page.keyboard.type("pace")
    page.keyboard.press("Enter")
    assert page.evaluate("__RunePixel3D.app.state.profile_name") == "Space"
    canvas_click(page, 210, 146)
    assert not page.evaluate("__RunePixel3D.app.state.profile_open")
    # A standard TV/gamepad opens Rename, navigates and selects a virtual key.
    tap_fish(page)
    original_profile_name = page.evaluate("__RunePixel3D.app.state.profile_name")
    page.evaluate("""() => {
      window.testPad={index:0,axes:[0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[testPad]});
    }""")
    page.evaluate("testPad.buttons[0].value=1")
    page.wait_for_function("__RunePixel3D.app.state.keyboard_open")
    original_draft = page.evaluate("__RunePixel3D.keyboard.value")
    page.wait_for_timeout(80)
    assert page.evaluate("__RunePixel3D.keyboard.value") == original_draft, "Opening A must not also type"
    page.evaluate("testPad.buttons[0].value=0")
    page.wait_for_timeout(80)
    page.evaluate("testPad.buttons[15].value=1")
    page.wait_for_function("__RunePixel3D.keyboard.focus===1")
    page.evaluate("testPad.buttons[15].value=0")
    page.wait_for_timeout(80)
    page.evaluate("testPad.buttons[0].value=1")
    page.wait_for_function("__RunePixel3D.keyboard.value.endsWith('w')")
    page.evaluate("testPad.buttons[0].value=0")
    page.wait_for_timeout(80)
    page.evaluate("testPad.buttons[1].value=1")
    page.wait_for_function("!__RunePixel3D.app.state.keyboard_open")
    assert page.evaluate("__RunePixel3D.app.state.profile_name") == original_profile_name, "Cancel must not rename"
    page.evaluate("testPad.buttons[1].value=0")
    canvas_click(page, 180, 146)

    feeding = browser.new_page()
    feeding.on("pageerror", lambda error: errors.append(str(error)))
    feeding.add_init_script("window.requestAnimationFrame=()=>0")
    feeding.goto(preview.as_uri())
    feeding.wait_for_function("window.__RunePixel3D")
    pacing = feeding.evaluate("""() => {
      const g=__RunePixel3D, s=g.app.state, reports=[];
      for (const count of [3,30]) {
        s.progress={pearls:100,fish:count,tank:count===30?2:0,reef:0,earned:0,palette:0};
        g.invoke('initialize'); g.invoke('feed');
        const paid=s.feed_cost;
        const total=s.food.length, samples=[], durations=new Set();
        let munchFrames=0, passive=0, traveled=0, prior=s.fish.map(f=>({...f}));
        for(let tick=1;tick<=900;tick++) {
          g.step({});
          if(tick%30===0) passive+=s.income;
          const owners=s.food.filter(p=>p.visible&&p.owner>=0).map(p=>p.owner);
          if(new Set(owners).size!==owners.length) throw Error('A fish reserved multiple snacks');
          s.fish.forEach((f,i)=>{
            if(f.snacking) traveled+=Math.hypot(f.x-prior[i].x,f.y-prior[i].y,f.z-prior[i].z);
            if(f.munch_ticks>0) {
              const p=s.food[f.target];
              if(!p?.visible || !p.chewing || p.scale>p.base_scale)
                throw Error('Munching must keep its shrinking snack visible');
              durations.add(f.munch_duration);
              munchFrames++;
            }
          });
          prior=s.fish.map(f=>({...f}));
          if([90,300,899].includes(tick)) samples.push({
            tick,eaten:s.eaten,visible:s.food.filter(p=>p.visible).length
          });
        }
        reports.push({
          count,total,samples,munchFrames,traveled,durations:[...durations],
          expired:s.food.every(p=>!p.visible),
          correctRewards:s.progress.pearls===100-paid+Math.floor(passive)+s.eaten*2
        });
      }
      return reports;
    }""")
    for report in pacing:
        assert report["samples"][0]["eaten"] == 0, report
        assert 0 < report["samples"][1]["eaten"] < report["total"], report
        assert report["munchFrames"] > 120, report
        assert report["traveled"] > 10, report
        assert len(report["durations"]) >= 3, report
        assert all(48 <= ticks <= 126 for ticks in report["durations"]), report
        assert report["expired"] and report["correctRewards"], report
    assert pacing[0]["samples"][2]["visible"] > 0, pacing[0]

    # Real persisted care fields must survive a reload without advancing offline.
    life = browser.new_page(has_touch=True, viewport={"width": 1200, "height": 1100})
    life.on("pageerror", lambda error: errors.append(str(error)))
    life.add_init_script("window.requestAnimationFrame=()=>0")
    life.goto(preview.as_uri())
    life.wait_for_function("window.__RunePixel3D")
    care = life.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      s.progress.buddies[0].hunger=599;
      s.progress.buddies[1].age=3599;
      s.ticks=29;g.step({});
      return s.progress.buddies;
    }""")
    assert care[0]["hunger"] == 600 and not care[0]["dead"]
    assert care[1]["dead"] and care[1]["cause"] == "Old age"
    life.reload()
    life.wait_for_function("window.__RunePixel3D")
    restored = life.evaluate("__RunePixel3D.app.state.progress.buddies")
    assert restored == care
    assert life.evaluate("__RunePixel3D.app.state.income") == 1
    assert life.evaluate("__RunePixel3D.app.state.crabs.length") == 1
    assert life.evaluate("__RunePixel3D.app.state.fish[1].model") == "aqua/dead"
    # Advance to the surface, then retrieve using an actual canvas touch.
    life.evaluate("() => {for(let i=0;i<600;i++)__RunePixel3D.step({});}")
    count = life.evaluate("__RunePixel3D.app.state.fish.length")
    tap_fish(life, touch=True, dead=True)
    assert life.evaluate("__RunePixel3D.app.state.fish.length") == count - 1
    assert life.evaluate("__RunePixel3D.app.state.fish[1].model") == "aqua/royal"
    life.reload()
    life.wait_for_function("window.__RunePixel3D")
    assert life.evaluate("__RunePixel3D.app.state.progress.fish") == 2
    assert life.evaluate("__RunePixel3D.app.state.progress.buddies[1].kind") == 2

    # The ninth in-canvas menu row opens a destructive-action confirmation.
    life.evaluate("""() => {
      __RunePixel3D.app.state.progress.pearls=10000;
      __RunePixel3D.invoke('grow_tank');__RunePixel3D.invoke('grow_reef');
    }""")
    hud_click(life, 8, touch=True)
    assert life.evaluate("__RunePixel3D.app.state.reset_open")
    canvas_click(life, 220, 146, True)
    assert not life.evaluate("__RunePixel3D.app.state.reset_open")
    assert life.evaluate("__RunePixel3D.app.state.progress.tank") == 1
    hud_click(life, 8, touch=True)
    canvas_click(life, 70, 146, True)
    assert life.evaluate("__RunePixel3D.app.state.progress.pearls") == 30
    assert life.evaluate("__RunePixel3D.app.state.progress.tank") == 0
    assert life.evaluate("__RunePixel3D.app.state.progress.reef") == 0
    assert life.evaluate("__RunePixel3D.app.state.fish.length") == 3
    life.reload()
    life.wait_for_function("window.__RunePixel3D")
    assert life.evaluate("__RunePixel3D.app.state.progress.pearls") == 30
    assert life.evaluate("__RunePixel3D.app.state.progress.buddies.every(b=>!b.dead&&b.age===0&&b.hunger===0)")
    # Old names/ages gain care fields without changing their species or wallet.
    life.evaluate("""() => localStorage.setItem('rune-pixel-glowtide-aquarium-v1',JSON.stringify({
      version:1,data:{pearls:123,fish:2,reef:1,earned:50,palette:2,tank:0,
        buddies:[{name:'Legacy Sunny',age:20},{name:'Legacy Bubbles',age:40}]}
    }))""")
    life.reload()
    life.wait_for_function("window.__RunePixel3D")
    legacy = life.evaluate("__RunePixel3D.app.state.progress")
    assert legacy["pearls"] == 123 and legacy["fish"] == 2
    assert legacy["buddies"][0]["name"] == "Legacy Sunny" and legacy["buddies"][0]["age"] == 20
    assert legacy["buddies"][1]["name"] == "Legacy Bubbles" and legacy["buddies"][1]["age"] == 40
    assert legacy["buddies"][1]["lifespan"] == 3600 and legacy["buddies"][1]["hunger"] == 0
    assert life.evaluate("__RunePixel3D.app.state.fish[1].model") == "aqua/tang"

    # Both new quick icons open canvas pickers; flowers stay rooted while critters scurry.
    garden = browser.new_page(viewport={"width": 1200, "height": 1100}, has_touch=True)
    garden.on("pageerror", lambda error: errors.append(str(error)))
    garden.goto(preview.as_uri())
    garden.wait_for_function("window.__RunePixel3D?.app.state.ticks>1")
    garden.evaluate("__RunePixel3D.paused=true;__RunePixel3D.app.state.progress.pearls=10000")
    canvas_click(garden, 101, 375, True)
    assert garden.evaluate("__RunePixel3D.app.state.shop") == "flowers"
    assert garden.evaluate("__RunePixel3D.app.state.ui.grid.items.length") == 3
    canvas_click(garden, 479, 160, True)
    assert garden.evaluate("__RunePixel3D.app.state.shop") == ""
    assert garden.evaluate("__RunePixel3D.app.state.garden[0].model") == "aqua/blossom"
    canvas_click(garden, 139, 375, True)
    assert garden.evaluate("__RunePixel3D.app.state.shop") == "critters"
    canvas_click(garden, 479, 184, True)
    assert garden.evaluate("__RunePixel3D.app.state.crabs[1].model") == "aqua/hermit"
    garden.evaluate("""() => {
      const g=__RunePixel3D;
      g.invoke('buy_critter',[2]);g.invoke('buy_critter',[3]);
      g.invoke('buy_floral',[1]);g.invoke('buy_floral',[2]);
      for(let i=0;i<5;i++)g.invoke('grow_reef');
    }""")
    travel = garden.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      const planted=JSON.stringify(s.garden),directions=new Set();
      let moving=0,resting=0,footMotion=0,previous=s.feet[0].z;
      for(let tick=0;tick<2000;tick++) {
        g.invoke('move_critters');g.invoke('animate_feet');
        // update the deterministic rest timing without advancing fish care.
        s.ticks++;
        for(const c of s.crabs) {
          if(c.moving) {moving++;directions.add(c.direction);} else resting++;
          if(Math.abs(c.x-20)>7.8*s.tank_scale || Math.abs(c.y-30)>3.7*s.tank_scale)
            throw Error('Critter crossed the tank wall');
          for(const o of s.obstacles)
            if(Math.hypot(c.x-o.x,c.y-o.y)<o.radius+0.12-0.000001)
              throw Error('Critter entered a decoration');
        }
        if(s.feet[0].z!==previous)footMotion++;
        previous=s.feet[0].z;
      }
      return {planted:planted===JSON.stringify(s.garden),directions:[...directions],moving,resting,footMotion};
    }""")
    assert travel["planted"] and len(travel["directions"]) == 8, travel
    assert travel["moving"] > 1000 and travel["resting"] > 100, travel
    assert travel["footMotion"] > 100, travel
    garden.evaluate("__RunePixel3D.invoke('update_labels')")
    purchased = garden.evaluate("({florals:__RunePixel3D.app.state.progress.florals,critters:__RunePixel3D.app.state.progress.critters})")
    garden.reload()
    garden.wait_for_function("window.__RunePixel3D?.app.state.ticks>1")
    assert garden.evaluate("__RunePixel3D.app.state.progress.florals") == purchased["florals"]
    assert garden.evaluate("__RunePixel3D.app.state.progress.critters") == purchased["critters"]
    assert garden.evaluate("__RunePixel3D.app.state.garden.length") == 3
    assert garden.evaluate("__RunePixel3D.app.state.crabs.length") == 4
    garden.evaluate("""() => {
      const g=__RunePixel3D;g.paused=true;g.app.state.progress.pearls=100000;
      g.invoke('grow_tank');g.invoke('grow_tank');
      for(let i=0;i<15;i++)g.invoke('buy_floral',[i%3]);
      for(let i=0;i<15;i++)g.invoke('buy_critter',[i%4]);
    }""")
    assert garden.evaluate("__RunePixel3D.app.state.garden.length") == 12
    assert garden.evaluate("__RunePixel3D.app.state.crabs.length") == 12
    pearls_at_capacity = garden.evaluate("__RunePixel3D.app.state.progress.pearls")
    garden.evaluate("__RunePixel3D.invoke('buy_floral',[0]);__RunePixel3D.invoke('buy_critter',[0])")
    assert garden.evaluate("__RunePixel3D.app.state.progress.pearls") == pearls_at_capacity
    garden.reload()
    garden.wait_for_function("window.__RunePixel3D?.app.state.ticks>1")
    assert garden.evaluate("__RunePixel3D.app.state.garden.length") == 12
    assert garden.evaluate("__RunePixel3D.app.state.crabs.length") == 12
    # Critter picking, connected naming and net retrieval use real canvas taps.
    care_page = browser.new_page(viewport={"width":1200,"height":1100}, has_touch=True)
    care_page.on("pageerror", lambda error: errors.append(str(error)))
    care_page.add_init_script("window.requestAnimationFrame=()=>0")
    care_page.goto(preview.as_uri())
    care_page.wait_for_function("window.__RunePixel3D")

    def tap_critter():
        point = care_page.evaluate("""() => {
          const g=__RunePixel3D,s=g.app.state;g.frame();
          const camera=g.renderState().camera,ray=g.raycaster;
          const center=ray.projectPoint(camera,s.crabs[0]);
          for(let dy=-12;dy<=12;dy+=2)for(let dx=-12;dx<=12;dx+=2) {
            const x=center.x+dx,y=center.y+dy;
            if(g.pickThing('residents',x,y)===s.fish.length)
              return {x:x/ray.width*640,y:y/ray.height*400};
          }
          throw Error('Expected tappable critter on sand');
        }""")
        canvas_click(care_page, point["x"], point["y"], True)

    tap_critter()
    assert care_page.evaluate("__RunePixel3D.app.state.selected_critter") == 0
    assert care_page.evaluate("__RunePixel3D.app.state.profile_name") == "Pebble"
    canvas_click(care_page, 50, 146, True)
    assert care_page.evaluate("__RunePixel3D.app.state.keyboard_open")
    care_page.evaluate("__RunePixel3D.frame()")
    for _ in range(24):
        keyboard_click(care_page, "DELETE", True)
    for letter in "claws":
        keyboard_click(care_page, letter.upper(), True)
    keyboard_click(care_page, "SAVE", True)
    assert care_page.evaluate("__RunePixel3D.app.state.profile_name") == "claws"
    canvas_click(care_page, 119, 146, True)
    assert care_page.evaluate("__RunePixel3D.app.state.critter_food.length") == 2
    care_page.evaluate("""() => {
      const g=__RunePixel3D;g.app.state.progress.critters[0].hunger=1200;
      for(let i=0;i<500;i++)g.step({});
    }""")
    assert care_page.evaluate("__RunePixel3D.app.state.progress.critters[0].hunger") < 1200
    critter_saved = care_page.evaluate("__RunePixel3D.app.state.progress.critters[0]")
    care_page.reload()
    care_page.wait_for_function("window.__RunePixel3D")
    assert care_page.evaluate("__RunePixel3D.app.state.progress.critters[0]") == critter_saved
    care_page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      s.progress.critters[0].hunger=1799;s.ticks=29;g.step({});
    }""")
    assert care_page.evaluate("__RunePixel3D.app.state.crabs[0].model") == "aqua/dead_critter"
    assert care_page.evaluate("__RunePixel3D.app.state.feet.every(f=>!f.visible)")
    care_page.reload()
    care_page.wait_for_function("window.__RunePixel3D")
    assert care_page.evaluate("__RunePixel3D.app.state.progress.critters[0].dead")
    tap_critter()
    assert care_page.evaluate("__RunePixel3D.app.state.crabs.length") == 0
    assert care_page.evaluate("__RunePixel3D.app.state.nets[0].visible")
    care_page.reload()
    care_page.wait_for_function("window.__RunePixel3D")
    assert care_page.evaluate("__RunePixel3D.app.state.progress.critters.length") == 0
    assert not errors, errors
    browser.close()

print("Glowtide aquarium: lighting, upgrades, camera, mobile and persistence passed.")
