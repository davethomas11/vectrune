"""Loading before iframe navigation, first-frame readiness, source tabs and retry."""
import argparse
import asyncio
import re
from contextlib import nullcontext
from pathlib import Path

from playwright.async_api import async_playwright, expect
from teaching_ux import preview

parser = argparse.ArgumentParser()
source = parser.add_mutually_exclusive_group(required=True)
source.add_argument('--site-dir')
source.add_argument('--url')
parser.add_argument('--browser',choices=['chromium','webkit'],default='chromium')
args = parser.parse_args()


async def check(base):
    async with async_playwright() as pw:
        browser = await getattr(pw,args.browser).launch()
        context = await browser.new_context(viewport={'width':1100,'height':900})
        page = await context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        host_script, game_download = asyncio.Event(), asyncio.Event()

        async def hold_host(route):
            await host_script.wait()
            await route.continue_()

        async def hold_game(route):
            await game_download.wait()
            await route.continue_()

        await page.route('**/assets/game-embeds.js*',hold_host)
        await page.route('**/assets/games/starfall/index.html',hold_game)
        await page.add_init_script('''
          if(window!==window.top){
            let runtime;
            Object.defineProperty(window,'__RunePixel3DRuntime',{
              configurable:true,get(){return runtime;},set(api){
                runtime={...api,boot(options){window.__releaseEngine=()=>api.boot(options);}};
              }
            });
          }
        ''')
        await page.goto(base+'/starfall/',wait_until='commit')
        loader=page.locator('.game-loader')
        iframe=page.locator('iframe.example-preview')
        example=page.locator('.web-example[data-game="true"]')
        await expect(loader).to_be_visible()
        await expect(iframe).to_have_css('pointer-events','none')
        assert await iframe.evaluate('(f)=>f.inert')
        if args.browser=='chromium':
            await page.screenshot(path='/private/tmp/starfall-game-loading.png')
        # Loading is already styled while even the host's enhancement script waits.
        host_script.set()
        await expect(page.get_by_role('tab',name='Game',exact=True)).to_have_attribute('id',re.compile(r'game-example-\d+-tab-0'))
        await page.get_by_role('tab',name='Source code',exact=True).click()
        await expect(page.locator('.source-filter')).to_be_visible()
        await page.get_by_role('tab',name='Game',exact=True).click()
        await expect(loader).to_be_visible()
        game_download.set()
        frame=await (await iframe.element_handle()).content_frame()
        await frame.wait_for_function('typeof __releaseEngine==="function" && document.readyState==="complete"',polling=100)
        assert await frame.evaluate('document.documentElement.dataset.runeGameState')=='loading'
        await expect(loader).to_be_visible()
        await expect(iframe).to_have_css('pointer-events','none')
        # A load event, engine object, or unrelated message cannot reveal a blank canvas.
        await frame.evaluate("parent.postMessage({type:'rune-game-ready'},'*')")
        await page.evaluate("window.postMessage({type:'rune-game-ready'},'*')")
        await expect(example).to_have_attribute('data-load-state','loading')
        await frame.evaluate('__releaseEngine()')
        try:
            await expect(example).to_have_attribute('data-load-state','ready')
        except Exception:
            print('Ready diagnostic',args.browser,await frame.evaluate('''() => ({
              state:document.documentElement.dataset.runeGameState,visibility:document.visibilityState,
              pixel:__RunePixel3D.raycaster.buffer[0],url:location.href
            })'''),errors,flush=True)
            raise
        await expect(loader).not_to_be_visible()
        await expect(iframe).to_have_css('pointer-events','auto')
        assert not await iframe.evaluate('(f)=>f.inert')
        await expect(page.locator('.example-game-panel')).to_have_attribute('aria-busy','false')
        await frame.locator('[data-pixel-start]').click()
        assert await frame.evaluate('__RunePixel3D.app.state.status')=='intro'
        print('Slow download, delayed first frame, immediate loader and source browsing passed',flush=True)
        await context.close()

        context = await browser.new_context(viewport={'width':390,'height':844})
        page = await context.new_page()
        await page.clock.install()

        async def stalled(route):
            await route.fulfill(status=200,content_type='text/html',body='<html><script>document.documentElement.dataset.runeGameState="loading";</script><body>Initializing</body></html>')

        await page.route('**/assets/games/starfall/index.html',stalled)
        await page.goto(base+'/fr/starfall/')
        await page.wait_for_function('typeof runeWebApp!=="undefined" && document.documentElement.dataset.runeGameState==="ready"',polling=100)
        await expect(page.get_by_role('tab',name='Jeu',exact=True)).to_have_attribute('id',re.compile(r'game-example-\d+-tab-0'))
        await expect(page.locator('.game-load-status')).to_have_text('Chargement du jeu…')
        await page.clock.fast_forward(31000)
        await expect(page.locator('.web-example[data-game="true"]')).to_have_attribute('data-load-state','slow')
        retry=page.get_by_role('button',name='Réessayer le jeu',exact=True)
        await expect(retry).to_be_visible()
        assert (await page.locator('iframe.example-preview').bounding_box())['height']>=400
        await page.unroute('**/assets/games/starfall/index.html',stalled)
        await retry.click()
        await expect(page.locator('.web-example[data-game="true"]')).to_have_attribute('data-load-state','ready',timeout=15000)
        await expect(page.locator('.game-loader')).not_to_be_visible()
        assert not errors,errors
        print('Localized mobile slow-load message and successful retry passed',flush=True)
        await context.close()
        context = await browser.new_context(viewport={'width':1100,'height':900})
        page = await context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        for route in ['games','vectworms','monster-city','vect-breach','rune-crypt','skybound-2']:
            await page.goto(base+'/'+route+'/')
            await expect(page.locator('.web-example[data-game="true"]')).to_have_attribute('data-load-state','ready',timeout=15000)
            await expect(page.locator('.game-loader')).not_to_be_visible()
        print('All existing game engines clear their loading screens',flush=True)

        async def legacy(route):
            await route.fulfill(status=200,content_type='text/html',body='<html><body>Cached game<script>window.runeWebApp={state:{}};</script></body></html>')

        await page.route('**/assets/games/starfall/index.html',legacy)
        await page.goto(base+'/starfall/')
        await expect(page.locator('.web-example[data-game="true"]')).to_have_attribute('data-load-state','ready')
        assert not errors,errors
        print('Older cached exports remain compatible',flush=True)
        await context.close()
        await browser.close()


with preview(Path(args.site_dir)) if args.site_dir else nullcontext(args.url.rstrip('/')) as base:
    asyncio.run(check(base))
print('Game loading checks passed')
