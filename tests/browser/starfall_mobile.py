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
        context = browser.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
        if fallback:
            context.add_init_script('HTMLElement.prototype.requestFullscreen = undefined; HTMLElement.prototype.webkitRequestFullscreen = undefined')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base + '/starfall/')
        frame = page.locator('iframe.example-preview').element_handle().content_frame()
        frame.wait_for_function('typeof __RunePixel3D !== "undefined"')
        frame.locator('.toolbar [data-pixel-fullscreen]').tap()
        frame.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
        fitted(frame)
        if fallback:
            expect(page.locator('iframe.example-preview')).to_have_class('example-preview iframe-fullscreen')
        assert frame.evaluate('__RunePixel3D.app.state.status') == 'title'
        expect(frame.locator('.launch [data-pixel-start]')).to_be_visible()
        frame.locator('canvas').screenshot(path=f'/private/tmp/starfall-mobile-title-{fallback}.png')
        frame.locator('.launch [data-pixel-start]').tap()
        frame.wait_for_function('__RunePixel3D.app.state.status === "intro"')
        frame.locator('[data-control-touch="skip"]').tap()
        frame.wait_for_function('__RunePixel3D.app.state.status === "playing"')
        frame.evaluate('__RunePixel3D.app.state.enemies=[]')
        buttons = frame.locator('.rune-control-touch button:visible').evaluate_all('(buttons)=>buttons.map(b=>b.dataset.controlTouch).sort()')
        assert buttons == ['fire', 'joystick', 'jump', 'pause'], buttons
        frame.locator('canvas').screenshot(path=f'/private/tmp/starfall-mobile-play-{fallback}.png')
        rects = frame.locator('.rune-control-touch button:visible').evaluate_all('(buttons)=>buttons.map(b=>{const r=b.getBoundingClientRect();return {id:b.dataset.controlTouch,x:r.x,y:r.y,w:r.width,h:r.height}})')
        for i, a in enumerate(rects):
            for b in rects[i+1:]:
                assert min(a['x']+a['w'], b['x']+b['w']) <= max(a['x'],b['x']) or min(a['y']+a['h'], b['y']+b['h']) <= max(a['y'],b['y']), (a,b)
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
        frame.locator('[data-control-touch="pause"]').tap()
        frame.wait_for_function('__RunePixel3D.paused')
        expect(frame.locator('[data-control-touch="fire"]')).not_to_be_visible()
        if fallback:
            page.set_viewport_size({'width':390,'height':844})
            fitted(frame)
            page.set_viewport_size({'width':844,'height':390})
            fitted(frame)
        frame.locator('canvas').screenshot(path=f'/private/tmp/starfall-mobile-landscape-{fallback}.png')
        frame.locator('.pause-menu .fullscreen-exit').tap()
        frame.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
        frame.wait_for_function('document.querySelector("canvas").width===432 && document.querySelector("canvas").height===270')
        assert not errors, errors
        context.close()
    browser.close()
print('Starfall mobile: fullscreen touch launch, full landscape viewport, compact controls, stick aim/duck, contextual actions, rotation and exit passed')
