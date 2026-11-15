"""Exercise profile remapping through real game exports and browser device adapters."""
from pathlib import Path
import shutil
import subprocess
import tempfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='rune-controls-') as folder, sync_playwright() as pw:
    browser = pw.chromium.launch()
    for example, profile, action in [('vect_breach', 'breach', 'fire'), ('monster_city', 'monster', 'smash')]:
        game_dir = Path(folder)/example
        shutil.copytree(ROOT/'examples'/example, game_dir)
        controls = game_dir/'controls.rune'
        original = controls.read_text().replace('@Controls/'+profile, '@Controls/defaults', 1)
        controls.write_text(original + f'\n@Controls/{profile}\nextends = defaults\nkeys:\n    Space -> null\n    KeyZ -> {action}\nmouse:\n    Left -> null\n    Right -> {action}\n')
        html = subprocess.run([str(ROOT/'target/debug/vectrune'), str(game_dir/(example+'.rune')), '-o', 'html'], capture_output=True, text=True, check=True).stdout
        page = browser.new_page(viewport={'width':1100,'height':800})
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        (game_dir/'game.html').write_text(html)
        page.goto((game_dir/'game.html').as_uri())
        page.wait_for_function('typeof __RunePixel !== "undefined"')
        canvas = page.locator('canvas'); canvas.focus()
        # Capture the actual simulation input after each browser adapter sample.
        page.evaluate('''() => {
          const g=__RunePixel, step=g.step.bind(g); window.__inputs=[];
          g.step=input=>{__inputs.push({...input});if(__inputs.length>100)__inputs.shift();step(input);};
          g.start();g.app.state.enemies=[];g.muted=true;
        }''')
        page.keyboard.down('Space'); page.wait_for_timeout(120); page.keyboard.up('Space')
        assert not page.evaluate(f'__inputs.some(i=>i.{action})'), 'Unbound Space still acts'
        page.keyboard.down('KeyZ')
        page.wait_for_function(f'__inputs.some(i=>i.{action})')
        page.keyboard.up('KeyZ'); page.wait_for_function(f'__inputs.length>0 && !__inputs.at(-1).{action}')
        page.evaluate('__inputs=[]')
        box = canvas.bounding_box(); page.mouse.move(box['x']+box['width']/2, max(30,box['y']+box['height']/2))
        # A down/up uses a real mouse, including right-click prevention.
        page.mouse.down(button='right'); page.wait_for_function(f'__inputs.some(i=>i.{action})')
        page.keyboard.down('KeyZ'); page.wait_for_timeout(80)
        page.mouse.up(button='right'); page.wait_for_timeout(100)
        assert page.evaluate(f'Boolean(__inputs.at(-1).{action})'), 'Mouse release cancelled keyboard hold'
        page.keyboard.up('KeyZ'); page.wait_for_function(f'!__inputs.at(-1).{action}')
        # Poll a standard-layout pad through the real browser adapter.
        page.evaluate('''() => {
          window.__pad={index:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false,touched:false}))};
          Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[__pad]});
          __pad.axes[0]=.8;
        }''')
        channel = 'move_x' if example == 'vect_breach' else 'right'
        page.wait_for_function(f'Boolean(__inputs.at(-1).{channel})')
        page.evaluate('Object.defineProperty(navigator,"getGamepads",{configurable:true,value:()=>[]})')
        page.wait_for_function(f'!__inputs.at(-1).{channel}')
        # Pause uses a profile command, including repeat suppression.
        page.keyboard.down('KeyP'); page.keyboard.down('KeyP'); assert page.evaluate('__RunePixel.paused')
        page.keyboard.up('KeyP'); page.keyboard.press('KeyP'); assert not page.evaluate('__RunePixel.paused')
        if example == 'monster_city':
            page.evaluate('__RunePixel.app.state.profile.coins=300')
            page.keyboard.press('KeyB')
            assert page.evaluate('__RunePixel.app.state.status') == 'store'
            expected = page.evaluate('__RunePixel.app.state.menu.cards[1].args[0]')
            page.keyboard.press('ArrowRight'); page.keyboard.press('Enter')
            assert page.evaluate('__RunePixel.app.state.status') == 'store'
            assert page.evaluate('__RunePixel.app.state.profile.skin') == expected, 'Enter must confirm the selected shop card'
        assert not errors, errors
        page.close()
    browser.close()
print('Game controls: 2D/3D profile inheritance, unbinding, keyboard/mouse remapping, simultaneous sources, gamepad polling/disconnect and pause commands pass')
