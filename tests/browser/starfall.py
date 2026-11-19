"""Starfall: full input-driven expedition, keyboard, controller, pause and touch."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="starfall-") as folder, sync_playwright() as pw:
    html = subprocess.run(
        [str(ROOT / "target/debug/vectrune"), str(ROOT / "examples/games/starfall/starfall.rune"), "-o", "html"],
        capture_output=True, text=True, check=True,
    ).stdout
    game_file = Path(folder) / "game.html"
    game_file.write_text(html)
    browser = pw.chromium.launch()
    context = browser.new_context(viewport={"width":1100, "height":1000})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script("""
      const RealAudio=window.AudioContext;
      window.__voices=0;
      window.AudioContext=class extends RealAudio {
        constructor(){
          super();window.__scoreContext=this;
          const oscillator=this.createOscillator.bind(this);
          this.createOscillator=()=>{window.__voices++;return oscillator();};
          const gain=this.createGain.bind(this);
          this.createGain=()=>{
            const node=gain(),connect=node.connect.bind(node);
            node.connect=(...args)=>{if(args[0]===this.destination)window.__scoreOutput=node;return connect(...args);};
            return node;
          };
        }
      };
    """)
    page.goto(game_file.as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert page.evaluate('__RunePixel3D.app.state.status') == "title"
    page.locator("[data-pixel-start]").click()
    expect(page.locator(".launch")).not_to_be_visible()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'intro'
    page.locator('[data-pixel-action="advance"]').click()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'landing'
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    assert page.evaluate((ROOT / "tests/browser/starfall_launch.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_chunks.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_layout.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_portals.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_rewards.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_discovery.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_cinematics.js").read_text())
    # A boss cell must survive storage reload even before its sector relay is collected.
    page.evaluate("__starfallLaunch();__RunePixel3D.invoke('claim_boss_container',['rootheart'])")
    saved_probe=page.context.new_page()
    saved_probe.goto(game_file.as_uri())
    saved_probe.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert saved_probe.evaluate('__RunePixel3D.app.state.max_health===5 && !__RunePixel3D.app.state.campaign.hydroponics && __RunePixel3D.app.state.campaign.containers.rootheart')
    saved_probe.close()
    page.evaluate('__starfallLaunch()')

    assert page.evaluate((ROOT / "tests/browser/starfall_vault_dodge.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_vault_route.js").read_text())
    page.locator("canvas").click()
    assert page.evaluate("document.pointerLockElement === null")
    page.keyboard.down("d")
    page.wait_for_function("__RunePixel3D.app.state.player.x > 9.5")
    page.keyboard.up("d")
    for fire_key in ["x", "j"]:
        page.wait_for_function("__RunePixel3D.app.state.cooldown === 0")
        page.keyboard.down(fire_key)
        page.wait_for_function("__RunePixel3D.app.state.cooldown > 0")
        page.keyboard.up(fire_key)
    # Mouse fires without pointer lock and preserves plasma hold/release behavior.
    page.wait_for_function("__RunePixel3D.app.state.cooldown === 0")
    page.mouse.down()
    page.wait_for_function("__RunePixel3D.app.state.cooldown > 0")
    page.mouse.up()
    page.evaluate("__starfallLaunch();__RunePixel3D.app.state.plasma=true;__RunePixel3D.app.state.enemies=[]")
    page.mouse.down()
    page.wait_for_function("__RunePixel3D.app.state.charge_ready")
    assert page.evaluate("document.pointerLockElement === null && __RunePixel3D.app.state.shots.length === 0")
    page.mouse.up()
    page.wait_for_function("__RunePixel3D.app.state.shots.some(shot => shot.charged)")
    page.evaluate("__starfallLaunch()")
    page.keyboard.down("w")
    page.wait_for_function("__RunePixel3D.app.state.aiming_up && __RunePixel3D.app.state.rifle.model === 'sf/rifle_up'")
    page.keyboard.up("w")
    for duck_key in ["s", "ArrowDown"]:
        page.keyboard.down(duck_key)
        page.wait_for_function("__RunePixel3D.app.state.ducking")
        page.keyboard.up(duck_key)
        page.wait_for_function("!__RunePixel3D.app.state.ducking")
    map_mute = page.evaluate("__RunePixel3D.muted")
    for muted in [not map_mute, map_mute]:
        page.keyboard.press("v")
        page.wait_for_function(f"__RunePixel3D.muted === {str(muted).lower()}")
    page.keyboard.press("p")
    expect(page.locator(".pause-menu")).to_be_visible()
    assert page.evaluate("!__RunePixel3D.app.state.ui.map && __RunePixel3D.app.state.pause_ui.map.expanded")
    tick = page.evaluate("__RunePixel3D.app.state.ticks")
    page.evaluate("""() => {
      window.__starfallRenderCount=0;
      window.__starfallRenderOriginal=__RunePixel3D.raycaster.render.bind(__RunePixel3D.raycaster);
      __RunePixel3D.raycaster.render=(...args)=>{__starfallRenderCount++;return __starfallRenderOriginal(...args);};
    }""")
    page.wait_for_timeout(150)
    assert page.evaluate("__RunePixel3D.app.state.ticks") == tick
    assert page.evaluate("__starfallRenderCount <= 1"), "Paused host repeatedly rasterized identical frames"
    page.evaluate("() => { __RunePixel3D.raycaster.render=__starfallRenderOriginal; }")
    page.locator(".pause-menu [data-pixel-pause]").click()
    expect(page.locator(".pause-menu")).not_to_be_visible()
    # Controller A jumps and X fires through the actual adapter.
    page.evaluate("""() => {
      window.__starfallPad={index:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false,touched:false}))};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[__starfallPad]});
      __starfallPad.buttons[0].value=1;
      __starfallPad.buttons[2].value=1;
    }""")
    page.wait_for_function("__RunePixel3D.app.state.player.z > 3.3 && __RunePixel3D.app.state.cooldown > 0")
    page.evaluate("__starfallPad.buttons[0].value=0;__starfallPad.buttons[2].value=0")
    page.wait_for_function("__RunePixel3D.app.state.grounded")
    page.evaluate("__starfallPad.buttons[5].value=1")
    page.wait_for_function("__RunePixel3D.app.state.ducking")
    page.evaluate("__starfallPad.buttons[5].value=0")
    page.wait_for_function("!__RunePixel3D.app.state.ducking")
    page.evaluate("__starfallPad.axes[1]=1")
    page.wait_for_function("__RunePixel3D.app.state.ducking")
    page.evaluate("__starfallPad.axes[1]=0;__starfallPad.buttons[9].value=1")
    page.wait_for_function("__RunePixel3D.paused")
    page.evaluate("__starfallPad.buttons[9].value=0")
    page.wait_for_timeout(80)
    page.evaluate("__starfallPad.buttons[9].value=1")
    page.wait_for_function("!__RunePixel3D.paused")
    page.evaluate("__starfallPad.buttons[9].value=0")
    page.evaluate("Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]})")
    assert page.evaluate((ROOT / "tests/browser/starfall_effects.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_recovery.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_plasma.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_lifecycle.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_escape.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_duck.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_extras.js").read_text())
    page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;__starfallLaunch();s.enemies=[];s.lives=1;
      g.invoke('take_damage',[6]);for(let i=0;i<24;i++)g.step({});
    }""")
    page.wait_for_function('__RunePixel3D.app.state.status === "gameover"')
    expect(page.locator(".launch")).to_be_visible()
    expect(page.locator("[data-pixel-start]")).to_have_text("New expedition / Enter")
    page.locator("[data-pixel-start]").click()
    assert page.evaluate('__RunePixel3D.app.state.status') == "intro"
    page.keyboard.press("Enter")
    assert page.evaluate('__RunePixel3D.app.state.status') == "landing"
    # Exercise the real keyboard door and dash adapters, including held-use debounce.
    page.evaluate("__starfallLaunch();__RunePixel3D.app.state.jets=true;__RunePixel3D.app.state.player.x=52;__RunePixel3D.app.state.enemies=[]")
    page.locator("canvas").focus()
    page.keyboard.down("e")
    page.wait_for_function("__RunePixel3D.app.state.sector_id==='hydroponics'")
    page.wait_for_timeout(100)
    assert page.evaluate("__RunePixel3D.app.state.sector_id") == "hydroponics"
    page.keyboard.up("e")
    page.evaluate("__RunePixel3D.app.state.dash_unlocked=true;__RunePixel3D.app.state.player.x=9")
    page.keyboard.down("Space")
    page.wait_for_function("__RunePixel3D.app.state.player.z>3.3")
    page.keyboard.up("Space")
    page.keyboard.down("Shift")
    page.wait_for_function("__RunePixel3D.app.state.dash_ticks>0")
    page.keyboard.up("Shift")
    # The same USE adapter operates Foundry hatches and gravity consoles.
    page.evaluate("__starfallLaunch();Object.assign(__RunePixel3D.app.state,{jets:true,plasma:true,garden_cleared:true});__RunePixel3D.app.state.player.x=69")
    page.keyboard.down("e")
    page.wait_for_function("__RunePixel3D.app.state.sector_id==='foundry'")
    page.keyboard.up("e")
    page.wait_for_function("!__RunePixel3D.app.state.use_held")
    page.evaluate("Object.assign(__RunePixel3D.app.state,{glove_unlocked:true,enemies:[]});Object.assign(__RunePixel3D.app.state.player,{x:57,z:5})")
    page.keyboard.down("e")
    page.wait_for_function("__RunePixel3D.app.state.gravity_low")
    page.wait_for_timeout(100)
    assert page.evaluate("__RunePixel3D.app.state.gravity_low")
    page.keyboard.up("e")
    # Sample the actual boss synth output after the initial user gesture.
    page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;__starfallLaunch();s.enemies=[];s.player.x=98;s.player.z=3;g.step({});
      if(s.music_track!=='sf_warden')throw Error('Boss track did not start');
      window.__scoreAnalyser=__scoreContext.createAnalyser();__scoreOutput.connect(__scoreAnalyser);
    }""")
    page.wait_for_timeout(160)
    energy=page.evaluate("""() => {
      const wave=new Float32Array(__scoreAnalyser.fftSize);__scoreAnalyser.getFloatTimeDomainData(wave);
      return wave.reduce((sum,value)=>sum+value*value,0)/wave.length;
    }""")
    assert energy>1e-8, f"Boss music is silent: {energy}"
    assert page.evaluate("""() => {
      const output=__scoreOutput;
      for(let i=0;i<10;i++)__RunePixel3D.step({});
      return output===__scoreOutput;
    }"""), "Boss music restarted while staying in the arena"
    page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;__starfallLaunch();s.jets=true;s.plasma=true;s.garden_cleared=true;s.player.x=69;g.step({use:true});g.step({});
      s.enemies=[];s.glove_unlocked=true;s.player.x=84;s.player.z=3;s.forge_clock=90;g.step({});
      if(s.music_track!=='sf_iron_cantor')throw Error('Cantor score did not start');
      window.__scoreAnalyser=__scoreContext.createAnalyser();__scoreOutput.connect(__scoreAnalyser);
    }""")
    page.wait_for_timeout(160)
    cantor_energy=page.evaluate("""() => {
      const wave=new Float32Array(__scoreAnalyser.fftSize);__scoreAnalyser.getFloatTimeDomainData(wave);
      return wave.reduce((sum,value)=>sum+value*value,0)/wave.length;
    }""")
    assert cantor_energy>1e-8, f"Cantor music is silent: {cantor_energy}"
    assert page.evaluate((ROOT / "tests/browser/starfall_garden_route.js").read_text())
    assert page.evaluate((ROOT / "tests/browser/starfall_foundry_route.js").read_text())
    route = page.evaluate((ROOT / "tests/browser/starfall_route.js").read_text())
    assert [point["label"] for point in route] == ["cargo", "plasma", "seal", "warden", "home"]
    page.reload()
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert page.evaluate("__RunePixel3D.app.state.campaign.hydroponics")
    assert page.evaluate("__RunePixel3D.app.state.campaign.foundry && __RunePixel3D.app.state.glove_unlocked && __RunePixel3D.app.state.plasma")
    assert page.evaluate("__RunePixel3D.app.state.dash_unlocked && __RunePixel3D.app.state.jets")
    assert page.evaluate("__RunePixel3D.app.state.max_health===7 && __RunePixel3D.app.state.campaign.containers.rootheart && __RunePixel3D.app.state.campaign.containers.cantor && __RunePixel3D.app.state.campaign.containers.warden")
    page.locator("canvas").focus()
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    assert not page.evaluate("__RunePixel3D.app.state.jets")
    page.locator("canvas").screenshot(path="/private/tmp/starfall-play.png")

    mobile = browser.new_page(viewport={"width":390,"height":844}, is_mobile=True, has_touch=True)
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.goto(game_file.as_uri())
    mobile.wait_for_function('typeof __RunePixel3D !== "undefined"')
    expect(mobile.locator(".rune-control-touch")).not_to_be_visible()
    mobile.locator("[data-pixel-start]").tap()
    mobile.locator('[data-control-touch="skip"]').tap()
    mobile.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    assert mobile.evaluate((ROOT / "tests/browser/starfall_launch.js").read_text())
    expect(mobile.locator(".rune-control-touch")).to_be_visible()
    assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth")
    for name, condition in [("jump", "player.z > 3.3"), ("fire", "cooldown > 0")]:
        button = mobile.locator(f'[data-control-touch="{name}"]')
        button.dispatch_event("pointerdown", {"pointerId":11,"pointerType":"touch","bubbles":True})
        mobile.wait_for_function("__RunePixel3D.app.state." + condition)
        button.dispatch_event("pointerup", {"pointerId":11,"pointerType":"touch","bubbles":True})
    stick = mobile.locator('[data-control-touch="joystick"]')
    for direction, condition in [(-1, 'aiming_up'), (1, 'ducking')]:
        mobile.wait_for_function('__RunePixel3D.app.state.grounded')
        box = stick.bounding_box()
        pointer = {"pointerId": 19, "pointerType": "touch", "bubbles": True,
                   "clientX": box['x'] + box['width']/2,
                   "clientY": box['y'] + box['height']*(.5 + direction*.35)}
        stick.dispatch_event('pointerdown', pointer)
        mobile.wait_for_function('__RunePixel3D.app.state.' + condition)
        stick.dispatch_event('pointerup', pointer)
    pause_button = mobile.locator('[data-control-touch="pause"]')
    for paused in [True, False]:
        pause_button.dispatch_event("pointerdown", {"pointerId":20,"pointerType":"touch","bubbles":True})
        mobile.wait_for_function(f"__RunePixel3D.paused === {str(paused).lower()}")
        pause_button.dispatch_event("pointerup", {"pointerId":20,"pointerType":"touch","bubbles":True})
        mobile.wait_for_timeout(80)
    mobile.evaluate("__starfallLaunch();__RunePixel3D.app.state.plasma=true;__RunePixel3D.app.state.enemies=[];__RunePixel3D.invoke('refresh_ui')")
    fire=mobile.locator('[data-control-touch="fire"]')
    fire.dispatch_event("pointerdown", {"pointerId":12,"pointerType":"touch","bubbles":True})
    mobile.wait_for_function("__RunePixel3D.app.state.charge_ready")
    fire.dispatch_event("pointerup", {"pointerId":12,"pointerType":"touch","bubbles":True})
    mobile.wait_for_function("__RunePixel3D.app.state.shots.some(shot=>shot.charged)")
    mobile.evaluate("__starfallLaunch();__RunePixel3D.app.state.jets=true;__RunePixel3D.app.state.player.x=52;__RunePixel3D.app.state.enemies=[]")
    use=mobile.locator('[data-control-touch="use"]')
    use.dispatch_event("pointerdown", {"pointerId":13,"pointerType":"touch","bubbles":True})
    mobile.wait_for_function("__RunePixel3D.app.state.sector_id==='hydroponics'")
    use.dispatch_event("pointerup", {"pointerId":13,"pointerType":"touch","bubbles":True})
    mobile.evaluate("__RunePixel3D.app.state.dash_unlocked=true;__RunePixel3D.app.state.player.x=9")
    jump=mobile.locator('[data-control-touch="jump"]')
    jump.dispatch_event("pointerdown", {"pointerId":14,"pointerType":"touch","bubbles":True})
    mobile.wait_for_function("__RunePixel3D.app.state.player.z>3.3")
    jump.dispatch_event("pointerup", {"pointerId":14,"pointerType":"touch","bubbles":True})
    dash=mobile.locator('[data-control-touch="dash"]')
    dash.dispatch_event("pointerdown", {"pointerId":15,"pointerType":"touch","bubbles":True})
    mobile.wait_for_function("__RunePixel3D.app.state.dash_ticks>0")
    dash.dispatch_event("pointerup", {"pointerId":15,"pointerType":"touch","bubbles":True})
    mobile.evaluate("__starfallLaunch();Object.assign(__RunePixel3D.app.state,{jets:true,plasma:true,garden_cleared:true});__RunePixel3D.app.state.player.x=69;__RunePixel3D.step({use:true});__RunePixel3D.step({});__RunePixel3D.app.state.glove_unlocked=true;Object.assign(__RunePixel3D.app.state.player,{x:57,z:5})")
    use.dispatch_event("pointerdown", {"pointerId":16,"pointerType":"touch","bubbles":True})
    mobile.wait_for_function("__RunePixel3D.app.state.gravity_low")
    use.dispatch_event("pointerup", {"pointerId":16,"pointerType":"touch","bubbles":True})
    mobile.evaluate("__starfallLaunch();__RunePixel3D.invoke('begin_discovery',['jets','sf/jets']);for(let i=0;i<40;i++)__RunePixel3D.step({})")
    assert mobile.evaluate("__RunePixel3D.app.state.discovery_active")
    mobile.locator('[data-control-touch="jump"]').tap()
    mobile.wait_for_function("!__RunePixel3D.app.state.discovery_active")
    assert mobile.evaluate("!__RunePixel3D.app.state.discovery_item.visible && __RunePixel3D.app.state.notice_ticks>0")
    mobile.screenshot(path="/private/tmp/starfall-mobile.png", full_page=True)
    assert not errors, errors
    browser.close()
print("Starfall expedition, keyboard, controller, pause, replay and mobile controls passed")
