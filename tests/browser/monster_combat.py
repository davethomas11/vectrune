"""Keyboard/touch defense, energy gating, and all skin-exclusive move renderers."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT=Path(__file__).resolve().parents[2]
QUIET="""const g=__RunePixel,s=g.app.state;g.start();s.soldiers=[];s.tanks=[];s.aircraft=[];s.next_drop=999999;for(const b of s.buildings)b.hp=1000;"""
with tempfile.TemporaryDirectory(prefix='monster-combat-') as folder, sync_playwright() as pw:
    game=Path(folder)/'game.html'
    result=subprocess.run([str(ROOT/'target/debug/vectrune'),str(ROOT/'examples/monster_city/monster_city.rune'),'-o','html'],capture_output=True,text=True,check=True)
    game.write_text(result.stdout,encoding='utf-8')
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1200,'height':1000})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(game.as_uri());page.get_by_role('button',name='Start rampage').click()
    page.get_by_role('button',name='Mute game audio',exact=True).click()
    page.evaluate(QUIET)
    page.locator('canvas').focus();page.keyboard.down('ArrowDown');page.keyboard.down('ArrowRight')
    page.wait_for_function('__RunePixel.app.state.defending')
    page.evaluate('const s=__RunePixel.app.state;s.shots=[{x:20,y:130,sprite:"bullet",vx:0,life:10,damage:7},{x:20,y:166,sprite:"bullet",vx:0,life:10,damage:7}]')
    page.wait_for_function('__RunePixel.app.state.health === 99')
    assert page.evaluate('__RunePixel.app.state.monster.x')==8
    assert page.evaluate('__RunePixel.app.state.monster.y')==142
    expect(page.get_by_role('button',name='Use skin special')).to_be_disabled()
    page.keyboard.press('Space');page.keyboard.press('x')
    assert page.evaluate('__RunePixel.app.state.energy')==100
    assert page.evaluate('__RunePixel.app.state.buildings[0].hp')==1000
    page.screenshot(path='/private/tmp/monster-defense.png',full_page=True)
    page.keyboard.up('ArrowDown');page.keyboard.up('ArrowRight')
    page.wait_for_function('!__RunePixel.app.state.defending')
    page.keyboard.down('KeyX')
    page.wait_for_function('__RunePixel.app.state.energy < 70')
    at=page.evaluate('__RunePixel.app.state.clock')
    page.wait_for_function(f'__RunePixel.app.state.clock > {at}+50')
    assert page.evaluate('__RunePixel.app.state.buildings[0].hp')==998,'Holding X must not recast after cooldown'
    page.keyboard.up('KeyX')
    page.evaluate('__RunePixel.app.state.energy=0;__RunePixel.app.state.special_cooldown=0')
    expect(page.get_by_role('button',name='Use skin special')).to_be_disabled()
    page.evaluate('for(let i=0;i<300;i++)__RunePixel.step({})')
    expect(page.get_by_role('button',name='Use skin special')).to_be_enabled()
    expect(page.locator('[data-pixel-energy]')).to_contain_text('VINE SNARE')
    ids=page.evaluate('__RunePixel.app.state.skins.map(s=>s.id)')
    assert len(ids)==17
    for id in ids:
        snapshot=page.evaluate('''id=>{const g=__RunePixel,s=g.app.state;s.profile.skin=id;g.start();s.soldiers=[];s.tanks=[];s.aircraft=[];s.next_drop=999999;for(const b of s.buildings)b.hp=1000;g.invoke('useSpecial');g.step({});return {energy:s.energy,cost:s.special_cost,name:s.special_name};}''',id)
        assert snapshot['energy']==100-snapshot['cost'],(id,snapshot)
        if id in ['thorn','obsidian','tide','nova','mecha']:
            page.screenshot(path=f'/private/tmp/monster-special-{id}.png',full_page=True)
    page.evaluate(QUIET+"g.invoke('grantPower',['giant']);g.step({defend:true});")
    assert page.evaluate('__RunePixel.app.state.monster.y')==126
    # Genuine touch input on both controls, including pointer release.
    phone_context=browser.new_context(is_mobile=True,has_touch=True,viewport={'width':390,'height':844})
    phone=phone_context.new_page();phone.on('pageerror',lambda e:errors.append(str(e)));phone.goto(game.as_uri())
    phone.get_by_role('button',name='Start rampage').tap();phone.evaluate(QUIET)
    block=phone.get_by_role('button',name='Duck and block')
    box=block.bounding_box();session=phone.context.new_cdp_session(phone)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1}]})
    phone.wait_for_function('__RunePixel.app.state.defending')
    expect(block).to_have_attribute('aria-pressed','true')
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    phone.wait_for_function('__RunePixel.app.state.defending === false')
    phone.get_by_role('button',name='Use skin special').tap()
    phone.wait_for_function('__RunePixel.app.state.energy < 70')
    phone.wait_for_function('document.documentElement.scrollWidth <= innerWidth')
    phone.screenshot(path='/private/tmp/monster-combat-mobile.png',full_page=True)
    phone_context.close()
    page.reload()
    assert page.evaluate('__RunePixel.app.state.energy')==100
    assert page.evaluate('__RunePixel.app.state.defending') is False
    assert not errors,errors
    browser.close()
print('Monster combat: keyboard/touch defense, chip damage, no attack while blocking, energy recharge/gating, all 17 specials, giant duck and temporary reload state pass')
