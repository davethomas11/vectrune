"""Browser input, ranged combat, directional rendering and switch regressions."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='vect-breach-') as folder, sync_playwright() as pw:
    html = subprocess.run([str(ROOT/'target/debug/vectrune'),
        str(ROOT/'examples/games/vect_breach/vect_breach.rune'), '-o', 'html'],
        capture_output=True, text=True, check=True).stdout
    game_file = Path(folder)/'game.html'
    game_file.write_text(html)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width': 1100, 'height': 950})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(game_file.as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    canvas = page.locator('canvas')
    canvas.click()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'story'
    canvas.click()
    assert page.evaluate('__RunePixel3D.app.state.status') == 'playing'
    # All combatants and supplies must spawn on traversable tiles in every sector.
    assert page.evaluate('''() => {
      const g=__RunePixel3D;
      for(let level=1;level<=3;level++) {
        g.invoke('setup_level_'+level);const s=g.app.state,m=g.config.maps[s.level_map];
        if([...s.enemies,...s.pickups].some(t=>m.grid[Math.floor(t.y)*m.width+Math.floor(t.x)]!==0))return false;
      }
      g.start();return true;
    }''')
    # Walk every authored layout from spawn to terminal to lift using real slide()
    # movement; no teleporting or unlock helpers can mask a disconnected wing.
    assert page.evaluate('''() => {
      const g=__RunePixel3D;
      function walkTo(point, radius) {
        const s=g.app.state,m=g.config.maps[s.level_map],w=m.width;
        const start=Math.floor(s.player.y)*w+Math.floor(s.player.x);
        const parent=new Map([[start,null]]),q=[start];let goal;
        for(let k=0;k<q.length;k++) {
          const i=q[k],x=i%w,y=Math.floor(i/w);
          if(Math.hypot(x+.5-point.x,y+.5-point.y)<radius){goal=i;break;}
          for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
            const n=ny*w+nx;
            if(nx>=0&&nx<w&&ny>=0&&ny<m.height&&m.grid[n]===0&&!parent.has(n)){parent.set(n,i);q.push(n);}
          }
        }
        if(goal===undefined)throw new Error('No walkable route to objective in '+s.level_map);
        const path=[];for(let i=goal;parent.get(i)!==null;i=parent.get(i))path.unshift(i);
        for(const i of path) {
          const tx=i%w+.5,ty=Math.floor(i/w)+.5;
          let attempts=0;
          while(Math.hypot(s.player.x-tx,s.player.y-ty)>.05) {
            if(++attempts>25)throw new Error('Collision blocks route in '+s.level_map+' at '+i);
            const angle=Math.atan2(ty-s.player.y,tx-s.player.x)*180/Math.PI;
            const delta=(angle-s.player.angle+540)%360-180;
            g.step({look_x:delta/.15,forward:true});
          }
        }
      }
      for(let level=1;level<=3;level++) {
        g.invoke('setup_level_'+level);const s=g.app.state;
        s.status='playing';s.enemies=[];s.pickups=[];s.projectiles=[];
        const spawn=g.config.maps[s.level_map].spawn;
        if(s.player.x!==spawn.x||s.player.y!==spawn.y||s.player.angle!==spawn.angle)return false;
        walkTo(s.switch_pos,1.1);g.step({});g.step({use:true});
        if(!s.switch_activated)throw new Error('Terminal did not activate in '+s.level_map);
        walkTo(s.exit_pos,.6);
        if(s.level!==level||s.status!=='playing')throw new Error('Elevator auto-activated');
        g.step({});g.step({use:true});
        if(level<3 ? s.level!==level+1 : s.status!=='won')throw new Error('Elevator did not advance');
      }
      // Map metadata controls position and heading, including a replay from another map.
      const spawn=g.config.maps.e1m2.spawn,original={...spawn};
      spawn.x=2.5;spawn.angle=180;g.invoke('setup_level_2');
      const authored=g.app.state.player.x===2.5&&g.app.state.player.angle===180;
      Object.assign(spawn,original);g.start();return authored;
    }''')
    # A rapid down/up between simulation ticks must still fire once.
    page.evaluate('''() => {
      const g=__RunePixel3D;g.muted=true;g.app.state.enemies=[];
      g.app.state.fire_cooldown=0;
      const c=document.querySelector('canvas');
      c.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));
      document.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true}));
    }''')
    page.wait_for_function('__RunePixel3D.app.state.ammo === 23')
    # Exercise a real held mouse button, including releasing outside the canvas.
    page.mouse.move(550, 420)
    page.mouse.down()
    page.wait_for_function('__RunePixel3D.app.state.ammo <= 21')
    page.mouse.move(5, 5)
    page.mouse.up()
    ammo = page.evaluate('__RunePixel3D.app.state.ammo')
    page.wait_for_timeout(500)
    assert page.evaluate('__RunePixel3D.app.state.ammo') == ammo

    page.evaluate('''() => {
      const g=__RunePixel3D;g.start();g.paused=true;
      const s=g.app.state;
      s.enemies=[{x:4.5,y:1.5,hp:4,visible:true,cooldown:8,angle:180,anim:0,pain:0,attack:0,sprite:'enemy/guard_walk1'}];
      g.paused=false;g.step();g.paused=true;
    }''')
    # Force deterministic simulation independently of requestAnimationFrame.
    def steps(n):
        page.evaluate('''n => {const g=__RunePixel3D;g.paused=false;for(let i=0;i<n;i++)g.step();g.paused=true;}''', n)
    steps(7)
    state = page.evaluate('__RunePixel3D.app.state')
    assert len(state['projectiles']) == 1
    assert state['health'] == 100, 'Shots must travel before damage'
    assert state['enemies'][0]['sprite'].startswith('guard3d/attack/')
    assert page.evaluate('''() => {
      const g=__RunePixel3D;g.app.state.weapon.sprite='';
      const withBolt=Array.from(g.frame());
      g.app.state.projectiles[0].visible=false;
      const withoutBolt=Array.from(g.frame());
      g.app.state.projectiles[0].visible=true;
      return withBolt.some((v,i)=>v!==withoutBolt[i]);
    }'''), 'Plasma must change the rendered frame'
    page.screenshot(path='/private/tmp/vect-breach-plasma.png')
    steps(24)
    assert page.evaluate('__RunePixel3D.app.state.health') == 92
    # Shots stop at walls and expire; dodging leaves health intact.
    page.evaluate('''() => {const s=__RunePixel3D.app.state;s.enemies=[];s.health=100;
      s.projectiles=[{x:2.8,y:2.5,vx:.14,vy:0,sprite:'projectile/plasma',scale:.18,visible:true,life:100}];}''')
    steps(5)
    assert page.evaluate('__RunePixel3D.app.state.projectiles.length') == 0
    page.evaluate('''() => {const s=__RunePixel3D.app.state;
      s.projectiles=[{x:4,y:1.5,vx:-.14,vy:0,sprite:'projectile/plasma',scale:.18,visible:true,life:100}];
      s.player.y=1.9;}''')
    steps(100)
    assert page.evaluate('__RunePixel3D.app.state.health') == 100
    assert page.evaluate('__RunePixel3D.app.state.projectiles.length') == 0
    # Compare view angles and strides using the actual assets and renderer.
    assert page.evaluate('''() => {
      const g=__RunePixel3D,s=g.app.state;s.player={x:1.5,y:1.5,angle:0};
      const e={x:3,y:1.5,sprite:'guard3d/walk0/0',visible:true};s.enemies=[e];
      const a=Array.from(g.frame());e.sprite='guard3d/walk1/0';const b=Array.from(g.frame());
      e.sprite='guard3d/walk0/2';const c=Array.from(g.frame());
      return a.some((v,i)=>v!==b[i]) && a.some((v,i)=>v!==c[i]);
    }''')
    # Production AI drives the stride; damage preserves a flinch, then a corpse.
    page.evaluate('''() => {
      const g=__RunePixel3D,s=g.app.state;
      s.enemies=[{x:5,y:1.5,hp:4,visible:true,cooldown:45,angle:180,anim:0,pain:0,attack:0,sprite:'guard3d/walk0/0'}];
      s.pickups=[];s.ammo=24;s.fire_cooldown=0;s.player.angle=359;
    }''')
    steps(7)
    assert page.evaluate('__RunePixel3D.app.state.enemies[0].sprite') == 'guard3d/walk1/0'
    page.evaluate('''() => {const g=__RunePixel3D;g.paused=false;g.step({fire:true});g.paused=true;}''')
    assert page.evaluate('__RunePixel3D.app.state.enemies[0].hp') == 2, 'Aim wraps across 0/360'
    assert page.evaluate('__RunePixel3D.app.state.enemies[0].sprite') == 'guard3d/pain/0'
    steps(12)
    page.evaluate('''() => {const g=__RunePixel3D;g.paused=false;g.step({fire:true});g.paused=true;}''')
    assert page.evaluate('__RunePixel3D.app.state.kills') == 1
    assert page.evaluate('__RunePixel3D.app.state.enemies[0].sprite') == 'guard3d/dead/0'
    page.screenshot(path='/private/tmp/vect-breach-combat.png')
    page.evaluate('''() => {const g=__RunePixel3D;g.app.state.enemies=[];g.app.state.player={x:6.5,y:4.5,angle:0};
      g.paused=false;g.step();g.step({fire:true});g.paused=true;}''')
    assert not page.evaluate('__RunePixel3D.app.state.switch_activated')
    page.evaluate("__RunePixel3D.app.state.player.angle=0")
    def wall_frame():
        return page.evaluate('''() => {const g=__RunePixel3D;return Array.from(g.raycaster.render(
          g.app.state.player,[],undefined,0,undefined,g.renderState().wall_overrides));}''')
    off = wall_frame()
    page.evaluate('''() => {const g=__RunePixel3D;g.paused=false;g.step({use:true});g.paused=true;}''')
    assert page.evaluate('__RunePixel3D.app.state.switch_activated')
    pressed = wall_frame()
    steps(6)
    verifying = wall_frame()
    steps(6)
    active = wall_frame()
    assert off != pressed and pressed != verifying and verifying != active
    steps(12)
    assert wall_frame() == active, 'Completed switch stays green'
    # Approach alone never ends the sector; a real keyboard E press does.
    page.evaluate('''() => {const g=__RunePixel3D;g.app.state.player={x:14.5,y:7.4,angle:0};g.paused=false;}''')
    page.wait_for_function('__RunePixel3D.app.state.message === "[E] USE ELEVATOR"')
    assert page.evaluate('__RunePixel3D.app.state.level') == 1
    canvas.focus()
    page.keyboard.press('KeyE')
    page.wait_for_function('__RunePixel3D.app.state.level === 2')
    assert page.evaluate('__RunePixel3D.app.state.status') == 'story'
    assert page.evaluate('__RunePixel3D.app.state.wall_overrides[0].texture') == 'wall/switch'
    assert page.evaluate('__RunePixel3D.app.state.switch_anim') == 0
    assert not errors, errors
    browser.close()
    print('Vect Breach: mouse firing/release, plasma rendering/travel/hits/walls/dodging/expiry, directional guards, animated wall switches and E-only elevators pass')
