"""Verify the published cabinet, discoverability, locale routing, source and real-origin saves."""
import argparse
from pathlib import Path
import re
from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser=argparse.ArgumentParser();parser.add_argument('--site-dir',required=True);args=parser.parse_args()
with preview(Path(args.site_dir)) as base, sync_playwright() as pw:
    browser=pw.chromium.launch();context=browser.new_context(viewport={'width':1440,'height':1000})
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'/')
    expect(page.get_by_role('link',name='Play Monster City',exact=True)).to_be_visible()
    page.locator('.sidebar a[href$="monster-city"]').click()
    expect(page.locator('main')).to_have_attribute('data-route','monster-city')
    expect(page.locator('main h1')).to_contain_text('Monster City')
    iframe=page.locator('iframe.example-preview');expect(iframe).to_have_attribute('src','/assets/games/monster-city/index.html')
    game=page.frame_locator('iframe.example-preview')
    game.get_by_role('button',name='Start rampage',exact=True).click()
    frame=iframe.element_handle().content_frame()
    assert frame.evaluate('getComputedStyle(document.body).backgroundColor')=='rgb(20, 29, 39)'
    assert frame.get_by_role('button',name='Use skin special').evaluate('(b)=>b.getBoundingClientRect().height>=44')
    assert frame.url.startswith(base+'/assets/games/monster-city/'),frame.url
    frame.evaluate("const g=__RunePixel,s=g.app.state;s.profile.coins=300;g.invoke('openStore');g.invoke('chooseSkin',['ember'])")
    assert frame.evaluate('__RunePixel.saveStatus')=='saved'
    assert frame.evaluate('__RunePixel.app.state.profile.coins')==180
    assert frame.evaluate('__RunePixel.app.state.profile.skin')=='ember'
    files=page.locator('.source-file summary').all_text_contents()
    for required in ['site_shell.rune','monster_city.rune','combat.rune','powers.rune','skins/nova.pixel.rune']:
        assert any(name.strip().endswith(required) for name in files),(required,files)
    assert not any('.test.rune' in name for name in files)
    index=next(i for i,name in enumerate(files) if re.search(r'(^|/)combat\.rune$',name.strip()))
    page.locator('.source-file summary').nth(index).click()
    source=page.locator('.source-file').nth(index).locator('code').text_content()
    assert '\n' in source and 'action useSpecial:' in source
    for locale,language in [('es','Español'),('fr','Français'),('','English')]:
        page.locator('.language-summary').click();page.locator('.language-link',has_text=language).click()
        expect(page.locator('main')).to_have_attribute('data-route','monster-city')
        expected=base+('/'+locale if locale else '')+'/monster-city'
        assert page.url.rstrip('/')==expected
        frame=page.locator('iframe.example-preview').element_handle().content_frame()
        frame.wait_for_function('typeof __RunePixel !== "undefined"')
        assert frame.evaluate('__RunePixel.app.state.profile.coins')==180
        assert frame.evaluate('__RunePixel.app.state.profile.skin')=='ember'
        page.reload()
        expect(page.locator('main h1')).to_contain_text('Monster City')
    frame=page.locator('iframe.example-preview').element_handle().content_frame()
    frame.get_by_role('button',name='Start rampage',exact=True).click()
    frame.locator('canvas').focus();page.keyboard.down('ArrowDown')
    frame.wait_for_function('__RunePixel.app.state.defending')
    page.keyboard.up('ArrowDown');frame.wait_for_function('!__RunePixel.app.state.defending')
    for width in [390,768,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        page.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
        assert frame.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert frame.get_by_role('button',name='Use skin special').evaluate('(b)=>b.getBoundingClientRect().bottom<innerHeight')
    page.screenshot(path='/private/tmp/monster-city-site.png',full_page=True)
    standalone=context.new_page();standalone.goto(base+'/assets/games/monster-city/index.html')
    standalone.wait_for_function('typeof __RunePixel !== "undefined"')
    assert standalone.evaluate('__RunePixel.app.state.profile.coins')==180
    assert standalone.evaluate('__RunePixel.app.state.profile.skin')=='ember'
    assert not errors,errors
    browser.close()
print('Monster City site: nav/card, embedded controls, recursive source, locale switching, standalone play and persistent shared profile pass')
