"""Rune Miners real-block progression, portable combat and touch pitch regression."""
from pathlib import Path
from contextlib import ExitStack
from functools import partial
from http.server import ThreadingHTTPServer
import subprocess
import tempfile
from threading import Thread
from playwright.sync_api import expect, sync_playwright
from rune_web_guide import QuietHandler

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="rune-miners-") as folder, sync_playwright() as pw, ExitStack() as cleanup:
    html = subprocess.run(
        [str(ROOT / "target/debug/vectrune"), str(ROOT / "examples/rune_miners/rune_miners.rune"), "-o", "html"],
        capture_output=True, text=True, check=True,
    ).stdout
    game_file = Path(folder) / "game.html"
    game_file.write_text(html)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=folder))
    cleanup.callback(server.server_close)
    cleanup.callback(server.shutdown)
    Thread(target=server.serve_forever, daemon=True).start()
    game_url = f"http://127.0.0.1:{server.server_port}/game.html"
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(game_url)
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    page.locator("canvas").click()
    assert page.evaluate("__RunePixel3D.app.state.status") == "title"
    page.locator("[data-pixel-action=cycle_biome]").click()
    assert page.evaluate("__RunePixel3D.app.state.biome") == "ember"
    page.locator("[data-pixel-action=cycle_biome]").click()
    page.locator("canvas").focus()
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    expect(page.locator(".title-actions")).not_to_be_visible()
    expect(page.locator(".defense-dock")).not_to_be_visible()
    expect(page.locator(".action-dock")).to_be_visible()
    page.evaluate("__RunePixel3D.paused=true")
    expect(page.locator(".pause-menu")).to_be_visible()
    expect(page.locator(".pause-menu")).to_contain_text("Health 60/60")
    expect(page.locator("[data-pixel-action=choice_one]")).to_be_disabled()
    expect(page.locator("[data-pixel-action=choice_two]")).to_be_disabled()
    assert page.evaluate("__RunePixel3D.app.state.ui.objective") == "GATHER: 3 TIMBER / 3 STONE / 2 COPPER LEFT"
    assert page.evaluate("__RunePixel3D.app.state.target_name") == "TIMBER +1"
    assert page.evaluate("__RunePixel3D.app.state.target_marker.length") == 1
    # Use the actual movement/mining actions throughout: no inventory or position fixtures.
    result = page.evaluate("""() => {
      const g=__RunePixel3D, s=g.app.state;
      function ticks(n,input={}) { g.paused=false; for(let i=0;i<n;i++)g.step(input); g.paused=true; }
      function aim(x,y,z) {
        const dx=x+.5-s.player.x,dy=y+.5-s.player.y,dz=z+.5-s.player.z-1.25;
        s.player.angle=Math.atan2(dy,dx)*180/Math.PI;
        s.player.pitch=Math.atan2(dz,Math.hypot(dx,dy))*180/Math.PI;
      }
      function mine(x,y,z) { aim(x,y,z);ticks(19);g.invoke('mine'); }
      ticks(12,{forward:true});
      mine(7,4,4);mine(7,4,3);mine(7,5,3);
      const wood=s.timber;
      s.player.angle=0;s.player.pitch=0;
      ticks(24,{forward:true});ticks(12,{strafe_right:true});
      mine(8,6,4);mine(8,6,3);mine(8,7,3);mine(9,6,3);mine(9,7,3);
      const gathered={timber:s.timber,stone:s.stone,copper:s.copper};
      s.player.angle=0;s.player.pitch=0;
      ticks(12,{strafe_left:true});ticks(36,{back:true});
      g.invoke('choice_one');g.invoke('choice_two');g.invoke('recruit');
      const crafted=s.pick&&s.blade&&s.companion;
      ticks(47,{strafe_right:true});ticks(47,{forward:true});
      ticks(47,{strafe_right:true});ticks(100,{forward:true});
      const cave={phase:s.phase,z:s.player.z};
      g.invoke('skip_tutorial');
      if(s.ui.panel!==null||s.target_marker.length)throw Error('Battle must leave guardian visible');
      g.invoke('choice_two');ticks(40);g.invoke('guard');ticks(10);
      const guardHealth=s.health;
      g.invoke('choice_one');ticks(44);g.invoke('dodge');ticks(6);
      const dodgeHealth=s.health;
      if(s.ui.meters[2].value!==0)throw Error('Impact bar must reset on player turn');
      g.invoke('choice_two');ticks(30);
      return {wood,gathered,crafted,cave,guardHealth,dodgeHealth,status:s.status,effects:s.effects.length};
    }""")
    assert result["wood"] == 3, result
    assert result["gathered"] == {"timber": 3, "stone": 3, "copper": 2}, result
    assert result["crafted"], result
    assert result["cave"] == {"phase": "player", "z": 1}, result
    assert result["guardHealth"] == result["dodgeHealth"] == 56, result
    assert result["status"] == "won" and result["effects"] == 0, result
    assert page.evaluate("__RunePixel3D.app.state.ui.panel.title") == "EXPEDITION COMPLETE"
    page.evaluate("__RunePixel3D.start();__RunePixel3D.paused=true")
    before = page.evaluate("__RunePixel3D.app.state.world.cells")
    page.locator("[data-pixel-restart]").click()
    page.wait_for_function('__RunePixel3D.app.state.status === "title"')
    assert page.evaluate("__RunePixel3D.app.state.timber") == 0
    assert page.evaluate("__RunePixel3D.app.state.world.cells") == before

    page.locator("[data-pixel-start]").click()
    page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      s.timber=20;s.stone=20;s.copper=20;g.invoke('refresh_ui');
    }""")
    page.locator('[data-pixel-action="inventory"]').click()
    expect(page.locator(".backpack-menu")).to_be_visible()
    expect(page.locator(".action-dock")).not_to_be_visible()
    expect(page.locator(".defense-dock")).not_to_be_visible()
    expect(page.locator(".equipment-slots")).to_contain_text("Hand pick")
    page.locator('[data-pixel-action="menu_one_action"]').click()
    expect(page.locator(".backpack-menu h2")).to_have_text("EQUIPMENT 1/3")
    expect(page.locator('[data-pixel-action="menu_one_action"]')).to_be_disabled()
    page.locator('[data-pixel-action="close_menu"]').click()
    page.locator('[data-pixel-action="workbench"]').click()
    expect(page.locator('[data-pixel-action="menu_one_action"]')).to_contain_text("Stone pick")
    page.locator('[data-pixel-action="menu_one_action"]').click()
    assert page.evaluate("__RunePixel3D.app.state.equipment.tool") == "stone_pick"
    expect(page.locator(".equipment-slots")).to_contain_text("Stone pick")
    expect(page.locator('[data-pixel-action="menu_one_action"]')).to_be_disabled()
    page.locator('[data-pixel-action="menu_next"]').click()
    page.locator('[data-pixel-action="menu_two_action"]').click()
    assert page.evaluate("__RunePixel3D.app.state.equipment.tool") == "copper_pick"
    page.locator('[data-pixel-action="close_menu"]').click()
    page.locator("canvas").focus()
    page.keyboard.press("o")
    assert page.evaluate("__RunePixel3D.app.state.hud_preset") == 1
    assert page.evaluate("__RunePixel3D.app.state.ui.detail") == ""
    page.keyboard.press("o")
    assert page.evaluate("__RunePixel3D.app.state.ui.objective") == ""
    expect(page.locator(".next-goal")).not_to_be_visible()
    expect(page.locator(".expedition-readout [data-pixel-text=summary]")).not_to_be_visible()
    page.keyboard.press("u")
    assert page.evaluate("__RunePixel3D.app.state.ui.textScale") == 2
    expect(page.locator('.utility-bar [data-pixel-action="toggle_text"]')).to_have_attribute("aria-pressed", "true")
    page.keyboard.press("i")
    expect(page.locator(".backpack-menu")).to_be_visible()
    assert page.evaluate("__RunePixel3D.app.state.ui.panel !== null")
    page.keyboard.press("i")
    page.keyboard.press("u")
    page.keyboard.press("o")
    expect(page.locator(".next-goal")).to_be_visible()
    page.locator("canvas").focus()
    page.keyboard.press("i")
    expect(page.locator(".backpack-menu h2")).to_have_text("BACKPACK")
    page.keyboard.press("1")
    page.keyboard.press("n")
    expect(page.locator(".backpack-menu h2")).to_have_text("EQUIPMENT 2/3")
    page.keyboard.press("v")
    expect(page.locator(".backpack-menu h2")).to_have_text("EQUIPMENT 1/3")
    page.keyboard.press("i")
    expect(page.locator(".backpack-menu")).not_to_be_visible()
    page.keyboard.press("h")
    expect(page.locator(".battle-help")).to_contain_text("Choose Strike")
    page.locator('[data-pixel-action="choice_one"]').click()
    expect(page.locator(".action-dock")).not_to_be_visible()
    expect(page.locator(".defense-dock")).to_be_visible()
    page.wait_for_function("__RunePixel3D.app.state.battle_clock===40")
    page.wait_for_timeout(200)
    assert page.evaluate("__RunePixel3D.app.state.battle_clock") == 40
    page.locator('[data-pixel-action="guard"]').click()
    expect(page.locator(".battle-help")).to_contain_text("choose Skill")
    page.locator('[data-pixel-action="choice_two"]').click()
    page.wait_for_function("__RunePixel3D.app.state.battle_clock===44")
    page.locator('[data-pixel-action="dodge"]').click()
    assert page.evaluate("""() => {
      const s=__RunePixel3D.app.state;
      return s.phase==='explore' && s.tutorial_done && s.health===60 && s.focus===2;
    }""")
    # Headless Chromium can deny pointer lock even for a plain canvas. Exercise
    # the host's release contract without depending on OS/browser permission.
    page.evaluate("""() => {
      window.testLockedCanvas=document.querySelector('canvas');
      window.originalExitPointerLock=document.exitPointerLock;
      Object.defineProperty(document,'pointerLockElement',{
        configurable:true,get:()=>window.testLockedCanvas,
      });
      document.exitPointerLock=()=>{window.testLockedCanvas=null;};
      document.querySelector('canvas').focus();
    }""")
    page.keyboard.press("i")
    expect(page.locator(".backpack-menu")).to_be_visible()
    page.wait_for_function("document.pointerLockElement === null")
    page.keyboard.press("Escape")
    expect(page.locator(".backpack-menu")).not_to_be_visible()
    page.evaluate("() => {delete document.pointerLockElement;document.exitPointerLock=window.originalExitPointerLock;}")

    mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    phone = mobile.new_page()
    phone.on("pageerror", lambda error: errors.append(str(error)))
    phone.goto(game_url)
    phone.wait_for_function('typeof __RunePixel3D !== "undefined"')
    phone.locator("[data-pixel-start]").tap()
    phone.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    expect(phone.locator('[data-control-touch=joystick]')).to_be_visible()
    expect(phone.locator('[data-control-touch=mine]')).to_be_visible()
    expect(phone.locator('[data-control-touch=guard]')).not_to_be_visible()
    expect(phone.locator('[data-control-touch=dodge]')).not_to_be_visible()
    for width, height in [(320, 720), (390, 844), (844, 390)]:
        phone.set_viewport_size({"width": width, "height": height})
        phone.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        geometry = phone.evaluate("""() => {
          const scene=document.querySelector('canvas').getBoundingClientRect();
          const controls=[...document.querySelectorAll('.rune-control-touch button')].filter(e=>!e.hidden)
            .map(e=>({id:e.dataset.controlTouch,r:e.getBoundingClientRect()}));
          const outside=controls.filter(({r})=>r.left<scene.left-1 || r.right>scene.right+1 ||
            r.top<scene.top+72 || r.bottom>scene.bottom+1 || r.width<44 || r.height<44).map(c=>c.id);
          const overlaps=[];
          for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
            const a=controls[i],b=controls[j];
            if(a.r.left<b.r.right && a.r.right>b.r.left && a.r.top<b.r.bottom && a.r.bottom>b.r.top)
              overlaps.push([a.id,b.id]);
          }
          return {outside,overlaps};
        }""")
        assert geometry == {"outside": [], "overlaps": []}, (width, height, geometry)
    phone.set_viewport_size({"width": 390, "height": 844})
    phone.locator("canvas").dispatch_event("pointerdown", {
        "pointerId": 10, "pointerType": "touch", "clientX": 160, "clientY": 250, "bubbles": True,
    })
    phone.locator("canvas").dispatch_event("pointermove", {
        "pointerId": 10, "pointerType": "touch", "clientX": 160, "clientY": 230, "bubbles": True,
    })
    phone.wait_for_function("__RunePixel3D.app.state.player.pitch > 0")
    phone.locator("canvas").dispatch_event("pointerup", {
        "pointerId": 10, "pointerType": "touch", "bubbles": True,
    })
    phone.evaluate("__RunePixel3D.paused=true")
    assert phone.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      s.player={x:5.5,y:4.5,z:3,angle:0,pitch:0,vz:0};
      g.invoke('mine');
      const age=s.mining_effects[0].age;
      for(let i=0;i<20;i++)g.step({});
      return g.paused && s.mining_effects[0].age===age;
    }""")
    expect(phone.locator(".pause-menu")).to_be_visible()
    expect(phone.locator("[data-pixel-restart]")).to_be_visible()
    phone.locator('.pause-menu [data-pixel-action="cycle_hud"]').tap()
    phone.locator('.pause-menu [data-pixel-action="toggle_text"]').tap()
    assert phone.evaluate("__RunePixel3D.paused && __RunePixel3D.app.state.pause_ui.textScale===2")
    phone.locator("[data-pixel-restart]").tap()
    phone.wait_for_function('__RunePixel3D.app.state.status === "title"')
    phone.locator("[data-pixel-start]").tap()
    assert phone.evaluate("__RunePixel3D.app.state.hud_preset===1 && __RunePixel3D.app.state.large_text")
    phone.locator('[data-pixel-action="inventory"]').tap()
    expect(phone.locator(".backpack-menu")).to_be_visible()
    expect(phone.locator(".rune-control-touch")).not_to_be_visible()
    phone.locator('[data-pixel-action="menu_two_action"]').tap()
    expect(phone.locator(".backpack-menu h2")).to_have_text("CAMP WORKBENCH 1/2")
    expect(phone.locator('[data-pixel-action="menu_one_action"]')).to_be_disabled()
    phone.locator('[data-pixel-action="menu_next"]').tap()
    expect(phone.locator(".backpack-menu")).to_contain_text("requires a crafted stone pick")
    expect(phone.locator(".menu-heading [data-pixel-action=close_menu]")).to_be_in_viewport()
    phone.locator('[data-pixel-action="close_menu"]').tap()
    expect(phone.locator(".backpack-menu")).not_to_be_visible()
    stick = phone.locator('[data-control-touch=joystick]')
    stick.scroll_into_view_if_needed()
    box = stick.bounding_box()
    stick.dispatch_event("pointerdown", {
        "pointerId": 99, "pointerType": "touch",
        "clientX": box["x"] + box["width"] / 2 + 30,
        "clientY": box["y"] + box["height"] / 2, "bubbles": True,
    })
    assert phone.evaluate("__RunePixel3D.controls.sample(1/30).move_x > 0")
    phone.evaluate("__RunePixel3D.invoke('combat_help')")
    expect(phone.locator('[data-control-touch=joystick]')).not_to_be_visible()
    assert phone.evaluate("Number(__RunePixel3D.controls.sample(1/30).move_x || 0) === 0")
    expect(phone.locator('[data-control-touch=mine]')).not_to_be_visible()
    expect(phone.locator('[data-control-touch=one]')).to_be_visible()
    phone.locator('[data-control-touch=one]').tap()
    expect(phone.locator('[data-control-touch=guard]')).to_be_visible()
    expect(phone.locator('[data-control-touch=one]')).not_to_be_visible()
    phone.wait_for_function("__RunePixel3D.app.state.battle_clock===40")
    phone.locator('[data-control-touch=guard]').tap()
    # Touch input is consumed by the next fixed simulation tick, not the DOM tap.
    phone.wait_for_function('__RunePixel3D.app.state.tutorial_step === "skill"')
    assert phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert not errors, errors
    mobile.close()
    browser.close()
    print("Rune Miners browser progression, combat lessons, inventory, crafting and mobile passed")
