"""Touch-only launch, full-screen landscape, rotation and contextual game controls."""
import argparse
from contextlib import nullcontext
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser = argparse.ArgumentParser()
source = parser.add_mutually_exclusive_group(required=True)
source.add_argument('--site-dir')
source.add_argument('--url')
args = parser.parse_args()


def fitted(frame):
    frame.wait_for_function('''() => {
      const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
      return Math.abs(r.width-innerWidth)<2 && Math.abs(r.height-innerHeight)<2 &&
        Math.abs(c.width/c.height-r.width/r.height)<.015;
    }''')
    assert frame.evaluate('document.querySelector("canvas").width * document.querySelector("canvas").height < 432*270*1.02')


with (preview(Path(args.site_dir)) if args.site_dir else nullcontext(args.url.rstrip('/'))) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    for fallback in [False, True]:
        viewport = {'width':390,'height':844} if fallback else {'width':844,'height':390}
        context = browser.new_context(viewport=viewport, is_mobile=True, has_touch=True)
        if fallback:
            context.add_init_script('HTMLElement.prototype.requestFullscreen = undefined; HTMLElement.prototype.webkitRequestFullscreen = undefined')
        page = context.new_page()
        cdp = context.new_cdp_session(page)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + '/starfall/')
        frame = page.locator('iframe.example-preview').element_handle().content_frame()
        frame.wait_for_function('typeof __RunePixel3D !== "undefined"')
        frame.locator('.toolbar [data-pixel-fullscreen]').tap()
        frame.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
        fitted(frame)
        expect(frame.locator('.fullscreen-exit-hud')).to_be_visible()
        if fallback:
            expect(page.locator('iframe.example-preview')).to_have_class('example-preview iframe-fullscreen')
            hint = frame.locator('.rune-control-rotate')
            expect(hint).to_be_visible()
            expect(hint.locator('strong')).to_have_text("It's cramped in here")
            expect(hint.locator('span')).to_have_text('Please rotate your phone to landscape.')
            heading, message = hint.locator('strong,span').evaluate_all('(e)=>e.map(n=>n.getBoundingClientRect().toJSON())')
            assert heading['bottom'] < message['top']
            frame.locator('canvas').screenshot(path='/private/tmp/starfall-mobile-portrait-hint.png')
            page.set_viewport_size({'width':844,'height':390})
            fitted(frame)
            expect(hint).not_to_be_visible()
        assert frame.evaluate('__RunePixel3D.app.state.status') == 'title'
        page.touchscreen.tap(420,180)
        assert frame.evaluate('__RunePixel3D.app.state.status') == 'title'
        expect(frame.locator('.launch [data-pixel-start]')).to_be_visible()
        frame.locator('canvas').screenshot(path=f'/private/tmp/starfall-mobile-title-{fallback}.png')
        if fallback:
            launch = frame.locator('.launch [data-pixel-start]').evaluate('(b)=>{const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y-8}}')
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[launch]})
            page.wait_for_timeout(160)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        else:
            frame.locator('.launch [data-pixel-start]').tap()
        frame.wait_for_function('__RunePixel3D.app.state.status === "intro"')
        frame.locator('[data-control-touch="skip"]').tap()
        frame.wait_for_function('__RunePixel3D.app.state.status === "playing"')
        frame.evaluate('__RunePixel3D.app.state.enemies=[]')
        buttons = frame.locator('.rune-control-touch button:visible').evaluate_all('(buttons)=>buttons.map(b=>b.dataset.controlTouch).sort()')
        assert buttons == ['fire', 'joystick', 'jump', 'pause'], buttons
        expect(frame.locator('.fullscreen-exit-hud')).to_be_visible()
        frame.locator('canvas').screenshot(path=f'/private/tmp/starfall-mobile-play-{fallback}.png')
        rects = frame.locator('.rune-control-touch button:visible').evaluate_all('(buttons)=>buttons.map(b=>{const r=b.getBoundingClientRect();return {id:b.dataset.controlTouch,x:r.x,y:r.y,w:r.width,h:r.height}})')
        for i, a in enumerate(rects):
            for b in rects[i+1:]:
                assert min(a['x']+a['w'], b['x']+b['w']) <= max(a['x'],b['x']) or min(a['y']+a['h'], b['y']+b['h']) <= max(a['y'],b['y']), (a,b)
        # A slight miss between Jump and Fire chooses only the nearer control.
        frame.evaluate('''() => {
          const g=__RunePixel3D, original=g.controls.event.bind(g.controls);
          window.__touchEvents=[];
          g.controls.event=e=>{if(e.device==='virtual'||e.device==='mouse')__touchEvents.push(e);return original(e);};
        }''')
        fire = frame.locator('[data-control-touch="fire"]').evaluate('(b)=>{const r=b.getBoundingClientRect();return {x:r.x-4,y:r.y+r.height/2}}')
        page.touchscreen.tap(fire['x'],fire['y'])
        frame.wait_for_function('__RunePixel3D.app.state.cooldown > 0')
        assert frame.evaluate('__touchEvents.filter(e=>e.value===true).map(e=>e.input)') == ['fire']
        frame.wait_for_function('__RunePixel3D.app.state.cooldown===0 && __RunePixel3D.app.state.grounded')
        frame.evaluate('__touchEvents=[]')
        before = frame.evaluate('({x:__RunePixel3D.app.state.player.x,width:innerWidth,height:innerHeight,scale:visualViewport.scale})')
        for _ in range(3):
            page.touchscreen.tap(420,180)
        assert frame.evaluate('__touchEvents.length') == 0
        assert frame.evaluate('__RunePixel3D.app.state.player.x') == before['x']
        assert not frame.evaluate('__RunePixel3D.paused')
        assert frame.evaluate('__RunePixel3D.app.state.cooldown') == 0
        # Long-press/context selection and pinch gestures stay inside the game.
        assert frame.evaluate('''() => ['contextmenu','selectstart','gesturestart'].every(type=>{
          const e=new Event(type,{bubbles:true,cancelable:true});document.querySelector('canvas').dispatchEvent(e);return e.defaultPrevented;
        })''')
        assert frame.locator('canvas').evaluate('(c)=>getComputedStyle(c).webkitUserSelect') == 'none'
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':380,'y':180},{'x':460,'y':180}]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':300,'y':180},{'x':540,'y':180}]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':420,'y':180}]})
        page.wait_for_timeout(650)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        assert frame.evaluate('visualViewport.scale') == before['scale']
        assert frame.evaluate('innerWidth') == before['width']
        assert frame.evaluate('innerHeight') == before['height']
        assert frame.evaluate('getSelection().toString()') == ''
        stick = frame.locator('[data-control-touch="joystick"]')
        for direction, state in [(-1, 'aiming_up'), (1, 'ducking')]:
            frame.wait_for_function('__RunePixel3D.app.state.grounded')
            # Pointer coordinates are local to the iframe, unlike bounding_box().
            point = stick.evaluate('(s)=>{const r=s.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,h:r.height}}')
            event = {'pointerId': 31, 'pointerType': 'touch', 'bubbles': True,
                     'clientX': point['x'], 'clientY': point['y']+direction*point['h']*.35}
            stick.dispatch_event('pointerdown', event)
            frame.wait_for_function('__RunePixel3D.app.state.' + state)
            stick.dispatch_event('pointerup', event)
        frame.evaluate("Object.assign(__RunePixel3D.app.state,{jets:true,dash_unlocked:true});__RunePixel3D.app.state.player.x=52;__RunePixel3D.invoke('refresh_ui')")
        expect(frame.locator('[data-control-touch="dash"]')).to_be_visible()
        expect(frame.locator('[data-control-touch="use"]')).to_be_visible()
        frame.locator('[data-control-touch="use"]').tap()
        frame.wait_for_function('__RunePixel3D.app.state.sector_id === "hydroponics"')
        frame.evaluate('__RunePixel3D.app.state.player.x=10;__RunePixel3D.invoke("refresh_ui")')
        expect(frame.locator('[data-control-touch="use"]')).not_to_be_visible()
        if fallback:
            page.set_viewport_size({'width':390,'height':844})
            fitted(frame)
        pause = frame.locator('[data-control-touch="pause"]').evaluate('(b)=>{const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}}')
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[pause]})
        page.wait_for_timeout(160)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        frame.wait_for_function('__RunePixel3D.paused')
        expect(frame.locator('.fullscreen-exit-hud')).to_be_visible()
        expect(frame.locator('[data-control-touch="fire"]')).not_to_be_visible()
        if fallback:
            page.set_viewport_size({'width':390,'height':844})
            fitted(frame)
            expect(frame.locator('.rune-control-rotate')).to_be_visible()
            page.set_viewport_size({'width':844,'height':390})
            fitted(frame)
        frame.locator('canvas').screenshot(path=f'/private/tmp/starfall-mobile-landscape-{fallback}.png')
        # Exit stays visible; its own near-miss margin also works without a menu.
        page.touchscreen.tap(420,220)
        assert frame.evaluate('__RunePixel3D.paused')
        frame.locator('.pause-menu [data-pixel-pause]').tap()
        frame.wait_for_function('!__RunePixel3D.paused')
        frame.evaluate('''() => {
          window.__exitEvents=[];
          for(const type of ['pointerdown','pointerup','lostpointercapture','click'])document.addEventListener(type,e=>{
            __exitEvents.push({type,id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target.className,trusted:e.isTrusted});
          },true);
        }''')
        exit = frame.locator('.fullscreen-exit-hud').evaluate('(b)=>{const r=b.getBoundingClientRect();return {x:r.x-8,y:r.y+r.height/2}}')
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[exit]})
        page.wait_for_timeout(160)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        try:
            frame.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")',timeout=5000)
        except Exception:
            print('Exit diagnostic',fallback,exit,frame.evaluate('__exitEvents'),flush=True)
            raise
        frame.wait_for_function('document.querySelector("canvas").width===432 && document.querySelector("canvas").height===270')
        assert not errors, errors
        print('Native' if not fallback else 'Fallback', 'fullscreen touch checks passed',flush=True)
        context.close()
    browser.close()
print('Starfall mobile: padded controls, inert background, long press/pinch guards, portrait hint, persistent exit, fullscreen launch and rotation passed')
