"""Controller pause remains stable through DOM menu transitions and held buttons."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='starfall-pad-pause-') as folder, sync_playwright() as pw:
    html = subprocess.run([str(ROOT/'target/debug/vectrune'), str(ROOT/'examples/games/starfall/starfall.rune'), '-o','html'], capture_output=True, text=True, check=True).stdout
    file = Path(folder)/'game.html'; file.write_text(html)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width':1100,'height':1000})
    page.goto(file.as_uri()); page.wait_for_function('typeof __RunePixel3D!=="undefined"')
    page.evaluate((ROOT/'tests/browser/starfall_launch.js').read_text())
    page.evaluate('''() => {
      __starfallLaunch();const g=__RunePixel3D;
      g.app.state.enemies=[];
      const descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(g),'paused');
      window.__pauseTransitions=[];
      Object.defineProperty(g,'paused',{get(){return descriptor.get.call(g)},set(value){
        if(value!==descriptor.get.call(g))__pauseTransitions.push(value);descriptor.set.call(g,value);
      }});
      window.__pausePad={index:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false,touched:false}))};
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[__pausePad]});
    }''')
    page.locator('canvas').focus()
    for button in [9,6]:
        page.evaluate('__pauseTransitions=[]')
        page.evaluate('button=>{__pausePad.buttons[button].value=1}',button)
        page.wait_for_function('__RunePixel3D.paused')
        tick=page.evaluate('__RunePixel3D.app.state.ticks')
        page.wait_for_timeout(500)
        assert page.evaluate('__pauseTransitions') == [True], 'Held controller button repeatedly toggled pause'
        assert page.evaluate('__RunePixel3D.app.state.ticks') == tick, 'Game advanced while paused'
        assert page.locator('.pause-menu').is_visible()
        page.evaluate('button=>{__pausePad.buttons[button].value=0}',button)
        page.wait_for_timeout(100)
        page.evaluate('button=>{__pausePad.buttons[button].value=1}',button)
        page.wait_for_function('!__RunePixel3D.paused')
        page.wait_for_timeout(500)
        assert page.evaluate('__pauseTransitions') == [True,False], 'Held resume button re-paused the game'
        assert not page.locator('.pause-menu').is_visible()
        assert page.evaluate('__RunePixel3D.app.state.ticks') > tick, 'Game did not resume'
        page.evaluate('button=>{__pausePad.buttons[button].value=0}',button)
        page.wait_for_timeout(100)
    browser.close()
print('Controller Start and left trigger: one pause/resume per press, stable menus, frozen/resumed simulation passed')
