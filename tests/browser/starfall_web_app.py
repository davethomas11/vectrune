"""Browser fullscreen and iOS/Android Home Screen launch presentation."""
import argparse
from contextlib import nullcontext
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser = argparse.ArgumentParser()
source = parser.add_mutually_exclusive_group(required=True)
source.add_argument('--site-dir')
source.add_argument('--url')
args = parser.parse_args()

with (preview(Path(args.site_dir)) if args.site_dir else nullcontext(args.url.rstrip('/'))) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    normal = browser.new_context(viewport={'width':844,'height':390}, is_mobile=True, has_touch=True)
    normal.add_init_script('''
      const request=HTMLElement.prototype.requestFullscreen;
      HTMLElement.prototype.requestFullscreen=function(options){window.__fullscreenOptions=options;return request.call(this,options);};
    ''')
    page = normal.new_page()
    page.goto(base+'/assets/games/starfall/index.html')
    page.wait_for_function('typeof __RunePixel3D!=="undefined"')
    expect(page.locator('.rune-pixel3d-expanded')).to_have_count(0)
    manifest_url = urljoin(page.url,page.locator('link[rel="manifest"]').get_attribute('href'))
    response = page.request.get(manifest_url)
    assert response.status == 200
    manifest = response.json()
    assert manifest['display']=='fullscreen' and 'standalone' in manifest['display_override']
    assert manifest['orientation']=='landscape'
    launch_url = urljoin(manifest_url,manifest['start_url'])
    assert launch_url.startswith(urljoin(manifest_url,manifest['scope']))
    assert page.request.get(urljoin(manifest_url,manifest['icons'][0]['src'])).status==200
    expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).to_have_attribute('content','yes')
    expect(page.locator('link[rel="apple-touch-icon"]')).to_have_count(1)
    cdp = normal.new_cdp_session(page)
    print('Chrome installability:',cdp.send('Page.getInstallabilityErrors'),flush=True)
    page.locator('.toolbar [data-pixel-fullscreen]').tap()
    page.wait_for_function('document.fullscreenElement===document.querySelector(".game-surface")')
    assert page.evaluate('__fullscreenOptions.navigationUI')=='hide'
    page.locator('.fullscreen-exit-hud').tap()
    page.wait_for_function('!document.fullscreenElement')
    normal.close()

    for platform in ['ios','android']:
        context = browser.new_context(viewport={'width':390,'height':844} if platform=='ios' else {'width':844,'height':390},is_mobile=True,has_touch=True)
        context.add_init_script('window.__nativeFullscreenCalls=0;')
        if platform=='ios':
            context.add_init_script('''
              Object.defineProperty(navigator,'standalone',{value:true,configurable:true});
              HTMLElement.prototype.requestFullscreen=undefined;HTMLElement.prototype.webkitRequestFullscreen=undefined;
            ''')
        else:
            context.add_init_script('''
              const match=window.matchMedia.bind(window);
              window.matchMedia=query=>query==='(display-mode: fullscreen)'?{matches:true}:match(query);
              HTMLElement.prototype.requestFullscreen=function(){__nativeFullscreenCalls++;return Promise.reject(new Error('No startup gesture'));};
            ''')
        page = context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(launch_url)
        page.wait_for_function('typeof __RunePixel3D!=="undefined" && !!document.querySelector(".rune-pixel3d-expanded")')
        assert page.evaluate('__nativeFullscreenCalls')==0
        expect(page.locator('.launch [data-pixel-start]')).to_be_visible()
        expect(page.locator('.fullscreen-exit-hud')).to_be_visible()
        page.locator('.launch [data-pixel-start]').tap()
        page.wait_for_function('__RunePixel3D.app.state.status==="intro"')
        page.locator('[data-control-touch="skip"]').tap()
        page.wait_for_function('__RunePixel3D.app.state.status==="playing"')
        page.locator('.fullscreen-exit-hud').tap()
        page.wait_for_function('!document.querySelector(".rune-pixel3d-expanded")')
        expect(page.get_by_role('link',name='Back to Vectrune',exact=True)).to_be_visible()
        assert not errors,errors
        print(platform,'installed launch simulation, touch start and exit passed',flush=True)
        context.close()
    browser.close()
print('Starfall: manifest and icons, Android navigationUI hide, iPhone/Android installed launch and exit passed')
