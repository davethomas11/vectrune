"""Skybound 2: campaign, bosses, music, persistence and the browser controls."""
from base64 import b64decode
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="skybound-2-") as folder, sync_playwright() as pw:
    html = subprocess.run(
        [str(ROOT / "target/debug/vectrune"), str(ROOT / "examples/skybound_2/skybound_2.rune"), "-o", "html"],
        capture_output=True, text=True, check=True,
    ).stdout
    game_file = Path(folder) / "game.html"
    game_file.write_text(html)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1160, "height": 1050})
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
    assert page.evaluate("__RunePixel3D.app.state.saga.unlocked") == 1
    assert page.evaluate("window.__scoreContext === undefined")
    expect(page.locator('.destination[data-pixel-args="[1]"]')).to_be_disabled()
    page.locator("canvas").focus()
    page.keyboard.press("Digit4")
    assert page.evaluate("__RunePixel3D.app.state.enter_locked")
    page.keyboard.press("Enter")
    assert page.evaluate("__RunePixel3D.app.state.phase") == "map"
    page.keyboard.press("Digit1")
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.phase === "playing"')
    expect(page.locator(".atlas")).not_to_be_visible()
    page.locator("canvas").click()
    assert page.evaluate("document.pointerLockElement === null")
    page.keyboard.down("Space")
    page.wait_for_function("__RunePixel3D.app.state.gliding")
    page.keyboard.up("Space")
    assert page.evaluate("__RunePixel3D.app.state.music_track") == "beyond_reedwake"
    page.wait_for_function("window.__voices > 4")
    # Sample the actual synth output after a user gesture, rather than only its state.
    page.evaluate("window.__scoreAnalyser=__scoreContext.createAnalyser();__scoreOutput.connect(__scoreAnalyser)")
    page.wait_for_timeout(120)
    energy = page.evaluate("""() => {
      const wave=new Float32Array(__scoreAnalyser.fftSize);__scoreAnalyser.getFloatTimeDomainData(wave);
      return wave.reduce((sum,value)=>sum+value*value,0)/wave.length;
    }""")
    assert energy > 1e-8, f"Synth output is silent: {energy}"
    page.keyboard.press("p")
    expect(page.locator(".pause-menu")).to_be_visible()
    tick = page.evaluate("__RunePixel3D.app.state.ticks")
    page.wait_for_timeout(120)
    assert page.evaluate("__RunePixel3D.app.state.ticks") == tick
    page.locator(".pause-menu [data-pixel-restart]").click()
    expect(page.locator(".atlas")).to_be_visible()
    # The route driver uses only real simulation inputs and normal campaign actions.
    route = page.evaluate(Path(__file__).with_name("skybound_2_route.js").read_text())
    assert route[-1]["phase"] == "result"
    assert route[-1]["boss"] == 0
    assert route[-1]["h"] > 0
    assert all("STUCK" not in step["name"] for step in route)
    for name in ["first-clear", "boss1-clear", "tide-clear", "canopy-clear", "aurora-clear", "emberglass-clear", "regent-clear"]:
        assert any(step["name"] == name and step["phase"] == "result" and step["squished"] > 0 for step in route), name
    assert any(step["name"] == "reedwake-detour" and step["squished"] > 0 for step in route)
    for name, variable in [("kilnback", "__kilnFrame"), ("regent", "__regentFrame")]:
        data_url = page.evaluate(variable)
        Path(f"/private/tmp/skybound-2-{name}.png").write_bytes(b64decode(data_url.split(",", 1)[1]))
    expect(page.locator(".outcome")).to_contain_text("DAWN BELONGS TO EVERYONE")
    campaign = page.evaluate("JSON.stringify(__RunePixel3D.app.state.saga)")
    page.reload()
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert page.evaluate("JSON.stringify(__RunePixel3D.app.state.saga)") == campaign
    assert page.evaluate("__RunePixel3D.app.state.saga.cleared.every(Boolean)")
    expect(page.locator('.destination[data-pixel-args="[6]"]')).to_be_enabled()
    page.screenshot(path="/private/tmp/skybound-2-atlas.png", full_page=True)
    # The original four-level save preserves its finale and opens the new destinations.
    legacy = browser.new_page(viewport={"width":1160,"height":1050})
    legacy.on("pageerror", lambda error: errors.append(str(error)))
    legacy.add_init_script("localStorage.setItem('rune-pixel-skybound-2',JSON.stringify({version:1,data:{unlocked:4,cleared:[true,true,true,true],best:[8,5,9,6]}}))")
    legacy.goto(game_file.as_uri())
    legacy.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert legacy.evaluate("__RunePixel3D.app.state.saga.best") == [8,5,9,0,0,0,6]
    assert legacy.evaluate("__RunePixel3D.app.state.saga.cleared") == [True,True,True,False,False,False,True]
    assert legacy.evaluate("__RunePixel3D.app.state.saga.unlocked") == 7
    assert legacy.evaluate("__RunePixel3D.app.state.selected") == 3
    expect(legacy.locator('.destination[data-pixel-args="[3]"]')).to_be_enabled()
    legacy.close()
    page.bring_to_front()
    # A standard controller can launch the selected destination and jump.
    page.locator("canvas").focus()
    page.evaluate("""() => {
      window.__nixPad={index:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false,touched:false}))};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[__nixPad]});
      __nixPad.buttons[8].value=1;
    }""")
    page.wait_for_function('__RunePixel3D.app.state.phase === "playing"')
    page.evaluate("__nixPad.buttons[8].value=0;__nixPad.buttons[0].value=1")
    page.wait_for_function("__RunePixel3D.app.state.player.z > 3.3")
    page.evaluate("Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]})")

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.goto(game_file.as_uri())
    mobile.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth")
    mobile.locator(".atlas [data-pixel-start]").tap()
    fly = mobile.locator('[data-control-touch="jump"]')
    expect(fly).to_be_visible()
    fly.dispatch_event("pointerdown", {"pointerId": 17, "pointerType": "touch", "bubbles": True})
    mobile.wait_for_function("__RunePixel3D.app.state.gliding")
    assert mobile.evaluate("__RunePixel3D.app.state.avatar.model") == "beyond/nix_glide"
    fly.dispatch_event("pointerup", {"pointerId": 17, "pointerType": "touch", "bubbles": True})
    mobile.wait_for_function("!__RunePixel3D.app.state.gliding")
    mobile.screenshot(path="/private/tmp/skybound-2-mobile.png", full_page=True)
    assert not errors, errors
    browser.close()
print("Skybound 2: all seven levels, both bosses, audible music, saves, keyboard/controller/touch passed")
