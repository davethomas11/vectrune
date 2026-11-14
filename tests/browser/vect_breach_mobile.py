"""Real multi-touch movement/aim/fire/use and fullscreen with landscape fallback."""
import argparse
import base64
from contextlib import nullcontext
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser = argparse.ArgumentParser()
source = parser.add_mutually_exclusive_group(required=True)
source.add_argument('--site-dir')
source.add_argument('--url')
args = parser.parse_args()
with (preview(Path(args.site_dir)) if args.site_dir else nullcontext(args.url.rstrip('/'))) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/assets/games/vect-breach/index.html')
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    canvas = page.locator('canvas')
    canvas.tap()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'story'
    canvas.tap()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'playing'
    page.evaluate('__RunePixel3D.muted=true;__RunePixel3D.app.state.enemies=[];__RunePixel3D.app.state.pickups=[]')
    stick = page.get_by_role('button', name='Move joystick')
    use = page.get_by_role('button', name='Use terminal or elevator')
    expect(stick).to_be_visible()
    expect(use).to_be_visible()
    client = context.new_cdp_session(page)
    def point(identifier, x, y):
        return {'id': identifier, 'x': x, 'y': y, 'radiusX': 4, 'radiusY': 4, 'force': 1}
    def dispatch(kind, points):
        client.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': points})
    def center(locator):
        box = locator.bounding_box()
        return box['x'] + box['width']/2, box['y'] + box['height']/2
    sx, sy = center(stick)
    move = point(1, sx, sy)
    dispatch('touchStart', [move])
    move = point(1, sx, sy - 45)
    x = page.evaluate('__RunePixel3D.app.state.player.x')
    dispatch('touchMove', [move])
    page.wait_for_function(f'__RunePixel3D.app.state.player.x > {x} + 0.1')
    assert page.evaluate('__RunePixel3D.app.state.ammo') == 24, 'Joystick must never fire'
    box = canvas.bounding_box()
    aim = point(2, box['x'] + box['width']*.68, box['y'] + box['height']*.5)
    dispatch('touchStart', [move, aim])
    page.wait_for_function('__RunePixel3D.app.state.ammo < 24')
    angle = page.evaluate('__RunePixel3D.app.state.player.angle')
    aim = point(2, aim['x']-35, aim['y']+12)
    dispatch('touchMove', [move, aim])
    page.wait_for_function(f'__RunePixel3D.app.state.player.angle !== {angle}')
    dispatch('touchEnd', [move])
    dispatch('touchEnd', [])
    page.wait_for_timeout(100)
    ammo = page.evaluate('__RunePixel3D.app.state.ammo')
    position = page.evaluate('({...__RunePixel3D.app.state.player})')
    page.wait_for_timeout(500)
    assert page.evaluate('__RunePixel3D.app.state.ammo') == ammo
    assert page.evaluate('({...__RunePixel3D.app.state.player})') == position
    # Cancelling either pointer releases its action; blur clears every input.
    dispatch('touchStart', [move])
    dispatch('touchCancel', [])
    assert page.locator('.stick-thumb').evaluate('(e)=>e.style.transform') == ''
    page.evaluate('__RunePixel3D.app.state.fire_cooldown=0')
    dispatch('touchStart', [aim])
    dispatch('touchCancel', [])
    page.wait_for_timeout(100)
    ammo = page.evaluate('__RunePixel3D.app.state.ammo')
    page.wait_for_timeout(450)
    assert page.evaluate('__RunePixel3D.app.state.ammo') == ammo
    page.evaluate('__RunePixel3D.app.state.player={x:6.5,y:4.5,angle:0}')
    use.tap()
    page.wait_for_function('__RunePixel3D.app.state.switch_activated')
    assert page.evaluate('__RunePixel3D.app.state.ammo') == ammo, 'USE must not shoot'
    page.wait_for_function('!__RunePixel3D.app.state.use_held')
    page.evaluate('__RunePixel3D.app.state.player={x:14.5,y:7.4,angle:0}')
    use.tap()
    page.wait_for_function('__RunePixel3D.app.state.level === 2')
    assert page.evaluate('__RunePixel3D.app.state.status') == 'story'
    canvas.tap()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'playing'
    page.evaluate('''() => {
      window.__landscape=[];
      Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async mode=>{__landscape.push(mode);throw new Error('Device does not allow locking');}});
    }''')
    page.get_by_role('button', name='Toggle fullscreen').tap()
    page.wait_for_function('!!document.fullscreenElement || !!document.querySelector(".rune-pixel3d-expanded")')
    page.wait_for_function('__landscape.includes("landscape")')
    expect(use).to_be_visible()
    expect(stick).to_be_visible()
    expect(page.get_by_role('button', name='Toggle fullscreen')).to_have_text('EXIT')
    page.screenshot(path='/private/tmp/vect-breach-mobile-fullscreen.png')
    client.send('Emulation.setDeviceMetricsOverride', {'width':844,'height':390,'screenWidth':844,'screenHeight':390,'deviceScaleFactor':2,'mobile':True,'screenOrientation':{'type':'landscapePrimary','angle':90}})
    page.wait_for_function('innerWidth === 844')
    expect(page.locator('.rotate-hint')).not_to_be_visible()
    for control in [stick, use, page.get_by_role('button', name='Toggle fullscreen')]:
        box = control.bounding_box()
        assert box['x'] >= 0 and box['y'] >= 0 and box['x']+box['width'] <= 845 and box['y']+box['height'] <= 391
    capture = client.send('Page.captureScreenshot', {'format':'png','captureBeyondViewport':False})
    Path('/private/tmp/vect-breach-mobile-landscape.png').write_bytes(base64.b64decode(capture['data']))
    page.get_by_role('button', name='Toggle fullscreen').tap()
    page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
    page.set_viewport_size({'width': 390, 'height': 844})
    # iPhone-style API fallback expands the actual teaching-site iframe.
    page.goto(base + '/vect-breach/')
    iframe = page.locator('iframe.example-preview')
    frame = iframe.element_handle().content_frame()
    frame.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert 'allow-orientation-lock' in iframe.get_attribute('sandbox')
    frame.evaluate('''() => {
      const surface=document.querySelector('canvas').parentElement;
      Object.defineProperty(surface,'requestFullscreen',{value:undefined});
      Object.defineProperty(surface,'webkitRequestFullscreen',{value:undefined});
    }''')
    frame.get_by_role('button', name='Toggle fullscreen').tap()
    expect(iframe).to_have_class('example-preview iframe-fullscreen')
    page.wait_for_function('Math.abs(document.querySelector("iframe.example-preview").getBoundingClientRect().width-innerWidth)<2',timeout=2000)
    frame.get_by_role('button', name='Toggle fullscreen').tap()
    expect(iframe).to_have_class('example-preview')
    assert not page.locator('.iframe-fullscreen-host').count()
    assert not errors, errors
    browser.close()
print('Vect Breach mobile: two-finger movement/aim/fire, release/cancel, USE progression, fullscreen landscape request and embedded fallback pass')
