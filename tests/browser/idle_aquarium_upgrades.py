"""Canvas upgrade purchases, animated cosmetics, care bounds and saved economy."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))

with tempfile.TemporaryDirectory(prefix="aquarium-upgrades-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "aquarium.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/idle_aquarium/idle_aquarium.rune"), "-o", "html",
    ]))
    hud_fixture = Path(folder) / "hud.js"
    subprocess.run([
        str(ROOT / "runtime/rune-web/node_modules/.bin/esbuild"),
        str(ROOT / "runtime/rune-web/src/pixel3d/hud.ts"), "--bundle", "--format=iife",
        "--global-name=RuneHud", f"--outfile={hud_fixture}", "--log-level=error",
    ], check=True)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width":1200,"height":1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script("window.requestAnimationFrame=()=>0")
    page.goto(preview.as_uri())
    page.wait_for_function("Boolean(window.__RunePixel3D)", polling=50)
    page.add_script_tag(path=str(hud_fixture))

    def hud_click(index, callout=False):
        point = page.evaluate("""({index,callout})=>{
          const g=__RunePixel3D,ui=g.app.state.ui,c=document.querySelector('[data-rune-pixel-3d]'),r=c.getBoundingClientRect();
          const target=callout?ui.callout.actions[index]:ui.grid.items[index];
          const hit=RuneHud.collectHudHitRegions(c.width,c.height,ui,'playing',false)
            .find(h=>h.action===target.action && JSON.stringify(h.args)===JSON.stringify(target.args??[]));
          if(!hit) throw Error('Missing enabled HUD hit: '+target.action);
          const x=hit.x+hit.w/2,y=hit.y+hit.h/2;
          return {x:r.x+x/c.width*r.width,y:r.y+y/c.height*r.height};
        }""", {"index":index,"callout":callout})
        page.mouse.click(point["x"],point["y"])

    page.evaluate("""__RunePixel3D.app.state.progress.pearls=10000;
      __RunePixel3D.invoke('inspect_fish',[0]);""")
    hud_click(1, callout=True)
    assert page.evaluate("__RunePixel3D.app.state.shop") == "fish"
    page.evaluate("__RunePixel3D.frame()")
    hud_click(0)
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].style")
    assert page.evaluate("__RunePixel3D.app.state.progress.pearls") == 9880
    # Purchase patterns through the same canvas-rendered sidebar.
    hud_click(1)
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].pattern") == 1
    hud_click(2)
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].pattern") == 2
    assert page.evaluate("__RunePixel3D.app.state.progress.pearls") == 9720
    for kind, model in [(1, "aqua/candy-stripes"), (2, "aqua/moon-stripes"), (1, "aqua/candy-stripes"), (2, "aqua/moon-stripes")]:
        hud_click(kind)
        assert page.evaluate("__RunePixel3D.app.state.progress.pearls") == 9720
        assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].pattern") == kind
        assert page.evaluate("__RunePixel3D.app.state.shop_index") == kind
        assert page.evaluate(f"__RunePixel3D.app.state.ui.grid.items[{kind}].sub") == "Active on this fish / Owned"
        assert page.evaluate("__RunePixel3D.app.state.fish_style[3].model") == model
        page.evaluate("__RunePixel3D.frame()")
    assert page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      const before=s.fish_style[0].angle;
      g.step({});
      if(s.fish_style[0].angle===before) throw Error('Tail did not animate');
      if(!s.residents.includes(s.fish_style[0])) throw Error('Cosmetics not pickable');
      g.invoke('inspect_resident',[s.fish.length+s.crabs.length]);
      if(s.selected_fish!==0) throw Error('Tail picked the wrong owner');
      g.invoke('close_profile');g.invoke('close_shop');
      g.invoke('open_care_upgrades');
      return true;
    }""")
    hud_click(0)
    assert page.evaluate("__RunePixel3D.app.state.progress.food_level") == 1
    page.evaluate("__RunePixel3D.frame()")
    hud_click(1)
    assert page.evaluate("__RunePixel3D.app.state.progress.life_level") == 1
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].lifespan") == 2970
    assert page.evaluate("__RunePixel3D.app.state.progress.critters[0].lifespan") == 5940
    page.evaluate("__RunePixel3D.app.state.progress.income_remainder=1;__RunePixel3D.app.state.save_revision++")
    page.evaluate("__RunePixel3D.flushSave()")
    page.reload()
    page.wait_for_function("Boolean(window.__RunePixel3D)", polling=50)
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].style")
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].pattern") == 2
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].lifespan") == 2970
    assert page.evaluate("__RunePixel3D.app.state.progress.food_level") == 1
    assert page.evaluate("__RunePixel3D.app.state.progress.income_remainder") == 1
    assert page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      s.progress.pearls=100000;
      for(let i=0;i<2;i++){g.invoke('buy_care_upgrade',[0]);g.invoke('buy_care_upgrade',[1]);}
      g.invoke('feed');
      if(s.fed_ticks!==1800 || s.feed_cooldown!==2100) throw Error('Food duration/cooldown');
      // With no fish reserving food, verify the authored shower outlives 30 seconds.
      for(const buddy of s.progress.buddies) buddy.dead=true;
      for(let i=0;i<930;i++)g.step({});
      if(!s.food.some(p=>p.visible)) throw Error('Long-lasting food expired at the old cutoff');
      g.invoke('initialize');
      s.progress.fish=8;s.progress.pearls=100000;g.invoke('build_fish');
      for(let i=0;i<8;i++){g.invoke('inspect_fish',[i]);g.invoke('buy_fish_upgrade',[0]);}
      g.invoke('animate');
      if(new Set(s.fish.filter((f,i)=>!s.progress.buddies[i].dead).map(f=>f.model)).size<5)
        throw Error('Styled species lost variety');
      for(const model of s.styled_species) {
        const ray=g.raycaster;
        ray.render({x:20,y:24,z:3,angle:90},[{x:20,y:28,z:4,model}]);
        if(!ray.pixelDepth.some(Number.isFinite)) throw Error('Missing styled geometry');
      }
      g.frame();
      g.invoke('request_reset');g.invoke('reset_tank');
      return !s.progress.food_level && !s.progress.life_level &&
        s.fish_style.length===0 && s.progress.pearls===30 && !s.progress.buddies[0].style;
    }""")
    assert not errors, errors
    live = browser.new_page(viewport={"width":1200,"height":1000})
    live.on("pageerror", lambda error: errors.append(str(error)))
    live.goto(preview.as_uri())
    live.wait_for_function("window.__RunePixel3D?.app.state.ticks > 2")
    live.add_script_tag(path=str(hud_fixture))
    live.evaluate("__RunePixel3D.invoke('inspect_fish',[0])")
    point = live.evaluate("""() => {
      const c=document.querySelector('[data-rune-pixel-3d]'),r=c.getBoundingClientRect();
      const h=RuneHud.collectHudHitRegions(c.width,c.height,__RunePixel3D.app.state.ui,'playing',false)
        .find(h=>h.action==='open_fish_upgrades');
      return {x:r.x+(h.x+h.w/2)/c.width*r.width,y:r.y+(h.y+h.h/2)/c.height*r.height};
    }""")
    live.mouse.click(point["x"],point["y"])
    assert live.evaluate("__RunePixel3D.app.state.shop") == "fish"
    ticks = live.evaluate("__RunePixel3D.app.state.ticks")
    live.wait_for_function(f"__RunePixel3D.app.state.ticks > {ticks + 5}")
    live.evaluate("__RunePixel3D.invoke('close_shop');__RunePixel3D.invoke('open_care_upgrades')")
    ticks = live.evaluate("__RunePixel3D.app.state.ticks")
    live.wait_for_function(f"__RunePixel3D.app.state.ticks > {ticks + 5}")
    assert not errors, errors
    browser.close()
