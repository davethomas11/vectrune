"""Exercise natural parachute pickup and all seven powers in the actual shared renderer."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
QUIET="""const g=__RunePixel,s=g.app.state; s.profile.level=15;s.profile.seed=42;g.start();s.soldiers=[];s.tanks=[];s.aircraft=[];s.next_drop=999999;for(const b of s.buildings)b.hp=1000;"""
with tempfile.TemporaryDirectory(prefix='monster-powers-') as folder, sync_playwright() as pw:
    game=Path(folder)/'game.html'
    result=subprocess.run([str(ROOT/'target/debug/vectrune'),str(ROOT/'examples/monster_city/monster_city.rune'),'-o','html'],capture_output=True,text=True,check=True)
    game.write_text(result.stdout,encoding='utf-8')
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1200,'height':1000})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(game.as_uri());page.get_by_role('button',name='Start rampage').click()
    page.get_by_role('button',name='Mute game audio',exact=True).click()
    page.evaluate(QUIET+'s.next_drop=30')
    page.wait_for_function('__RunePixel.app.state.crates.length === 1')
    first=page.evaluate('__RunePixel.app.state.crates[0]')
    assert first['sprite']=='supply/parachute'
    page.wait_for_function(f'__RunePixel.app.state.crates[0].y > {first["y"]}')
    page.screenshot(path='/private/tmp/monster-parachute.png',full_page=True)
    page.evaluate('const s=__RunePixel.app.state;s.monster.x=Math.max(0,s.crates[0].x-8)')
    page.wait_for_function('__RunePixel.app.state.power !== ""',timeout=6000)
    assert page.evaluate('__RunePixel.app.state.crates.length')==0
    page.evaluate(QUIET+"g.invoke('grantPower',['atomic']);for(let i=0;i<60;i++)g.step({});")
    assert page.evaluate('__RunePixel.app.state.charge_ticks')==0
    assert page.evaluate('__RunePixel.app.state.buildings[0].hp')==1000
    page.evaluate('for(let i=0;i<6;i++)__RunePixel.step({})')
    assert page.evaluate('__RunePixel.app.state.buildings[0].hp')<1000
    page.wait_for_function('__RunePixel.app.state.power_fx.length === 3')
    page.screenshot(path='/private/tmp/monster-atomic.png',full_page=True)
    for kind in ['shield','electric','giant','speed','baby','aftershock']:
        page.evaluate(QUIET+f"g.invoke('grantPower',['{kind}']);g.step({{}});g.step({{}});")
        assert page.evaluate('__RunePixel.app.state.power')==kind
        assert page.evaluate('__RunePixel.app.state.power_label')
        page.screenshot(path=f'/private/tmp/monster-power-{kind}.png',full_page=True)
    page.evaluate(QUIET+"g.invoke('grantPower',['shield']);g.paused=true;")
    before=page.evaluate('__RunePixel.app.state.power_ticks')
    page.wait_for_timeout(180)
    assert page.evaluate('__RunePixel.app.state.power_ticks')==before
    page.evaluate('__RunePixel.paused=false;for(let i=0;i<180;i++)__RunePixel.step({})')
    assert page.evaluate('__RunePixel.app.state.power')==''
    page.reload()
    assert page.evaluate('__RunePixel.app.state.power')==''
    assert page.evaluate('__RunePixel.app.state.crates.length')==0
    page.set_viewport_size({'width':390,'height':844})
    page.get_by_role('button',name='Start rampage').click()
    page.evaluate(QUIET+"g.invoke('grantPower',['giant']);g.step({});")
    page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='/private/tmp/monster-power-mobile.png',full_page=True)
    assert not errors,errors
    browser.close()
print('Monster powers: natural parachute pickup, all seven renderers, beam charge/damage, pause, expiry and temporary-state reload pass')
