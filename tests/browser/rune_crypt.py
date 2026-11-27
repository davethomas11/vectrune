"""Rune Crypt browser gameplay, navigation, environment and persistence regressions."""
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="rune-crypt-") as folder, sync_playwright() as pw:
    html = subprocess.run(
        [str(ROOT / "target/debug/vectrune"), str(ROOT / "examples/games/rune_crypt/rune_crypt.rune"), "-o", "html"],
        capture_output=True, text=True, check=True,
    ).stdout
    game_file = Path(folder) / "game.html"
    game_file.write_text(html)
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    page.add_init_script("""(() => {
      window.cryptAudioStarts=0;
      const create=AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator=function(...args) {
        const oscillator=create.apply(this,args),start=oscillator.start;
        oscillator.start=function(...values) { window.cryptAudioStarts++;return start.apply(this,values); };
        return oscillator;
      };
    })()""")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(game_file.as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    assert page.evaluate("__RunePixel3D.app.state.status") == "title"
    assert page.evaluate("__RunePixel3D.app.state.ui.heading") == "RUNE CRYPT"
    assert page.evaluate("__RunePixel3D.app.state.music_track") == "crypt_title"
    assert page.evaluate("cryptAudioStarts") == 0
    expect(page.locator("[data-pixel-action=confirm_choice]")).to_be_disabled()
    page.locator("canvas").focus()
    page.keyboard.press("2")
    page.wait_for_function("__RunePixel3D.app.state.ui.panel.selected === 1")
    page.wait_for_function("cryptAudioStarts > 0")
    expect(page.locator('[data-pixel-args="[1]"]')).to_have_attribute("aria-pressed", "true")
    page.locator('[data-pixel-args="[0]"]').click()
    # New save fields must restore defaults while keeping saves from the first version.
    assert page.evaluate("""() => {
      const g=__RunePixel3D;
      const old={version:1,data:{shards:7,rank:0,runs:2,wins:1}};
      localStorage.setItem('rune-pixel-rune-crypt',JSON.stringify(old));
      return true;
    }""")
    page.reload()
    page.wait_for_function('__RunePixel3D.app.state.legacy.shards === 7')
    assert page.evaluate("__RunePixel3D.app.state.legacy.class") == 0
    page.locator("canvas").click()
    assert page.evaluate("__RunePixel3D.app.state.status") == "title"
    page.keyboard.press("Enter")
    page.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    assert page.evaluate("__RunePixel3D.app.state.music_track") == "crypt_dungeon"
    assert "HP 100/100" in page.evaluate("__RunePixel3D.renderState().hud_text")
    page.evaluate("__RunePixel3D.paused = true")
    expect(page.locator(".pause-menu")).to_be_visible()
    expect(page.locator(".pause-menu")).to_contain_text("Health 100/100")
    expect(page.locator(".pause-menu")).to_contain_text("RPG level 1")
    assert page.evaluate("__RunePixel3D.renderState().ui.heading") == "PAUSED"
    page.locator(".toolbar [data-pixel-fullscreen]").click()
    page.wait_for_function("document.fullscreenElement === document.querySelector('.game-surface')")
    expect(page.locator("[data-pixel-restart]")).to_be_visible()
    page.evaluate("document.exitFullscreen()")
    page.wait_for_function("document.fullscreenElement === null")
    expect(page.locator(".choices")).to_be_hidden()
    expect(page.locator(".game-info")).to_contain_text("Health 100/100")
    assert page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      s.player={...s.player,...s.shrine_pos};g.invoke('refresh_ui');
      return g.paused && s.ui.panel.choices.length===3 && s.ui.prompt.includes('ENEMIES STILL MOVE');
    }""")
    page.locator('[data-pixel-args="[2]"]').click()
    assert page.evaluate("__RunePixel3D.paused && __RunePixel3D.app.state.ui.panel.selected === 2")
    clock = page.evaluate("__RunePixel3D.app.state.clock")
    page.locator("[data-pixel-action=confirm_choice]").click()
    assert page.evaluate("__RunePixel3D.app.state.shrine_used && __RunePixel3D.app.state.max_health === 125")
    assert page.evaluate("__RunePixel3D.app.state.clock") == clock
    page.once("dialog", lambda dialog: dialog.dismiss())
    page.locator("[data-pixel-start]").click()
    assert page.evaluate("__RunePixel3D.app.state.shrine_used")
    page.evaluate("__RunePixel3D.start();__RunePixel3D.paused=true")
    assert page.evaluate("""() => {
      const g=__RunePixel3D;
      g.invoke('play_score',['crypt_dungeon']);
      return g.paused && g.audioState.isPaused;
    }""")
    page.evaluate("__RunePixel3D.muted=true;__RunePixel3D.paused=false")
    assert page.evaluate("__RunePixel3D.muted && !__RunePixel3D.audioState.isPaused")
    page.evaluate("__RunePixel3D.muted=false;__RunePixel3D.paused=true")
    # Restart ends the run, preserves progression, and does not silently pick Knight.
    saved = page.evaluate("JSON.stringify(__RunePixel3D.app.state.legacy)")
    page.locator("[data-pixel-restart]").click()
    page.wait_for_function("__RunePixel3D.app.state.status === 'title' && !__RunePixel3D.paused")
    assert page.evaluate("JSON.stringify(__RunePixel3D.app.state.legacy)") == saved
    page.locator('[data-pixel-args="[2]"]').click()
    page.locator("canvas").click()
    assert page.evaluate("__RunePixel3D.app.state.status === 'title' && __RunePixel3D.app.state.hero_class === 2")
    page.keyboard.press("Enter")
    page.wait_for_function("__RunePixel3D.app.state.max_health === 90")
    page.keyboard.press("KeyT")
    assert page.evaluate("__RunePixel3D.app.state.status") == "playing"
    page.keyboard.press("KeyP")
    clock = page.evaluate("__RunePixel3D.app.state.clock")
    page.wait_for_timeout(150)
    assert page.evaluate("__RunePixel3D.app.state.clock") == clock
    page.keyboard.press("KeyT")
    page.wait_for_function("__RunePixel3D.app.state.status === 'title' && !__RunePixel3D.paused")
    page.locator('[data-pixel-args="[0]"]').click()
    page.locator("[data-pixel-start]").click()
    page.evaluate("__RunePixel3D.paused=true")
    assert page.evaluate("""() => {
      const g=__RunePixel3D;g.start();const s=g.app.state;
      s.enemies=[];s.hazards=[];s.pickups=[];
      const frame=()=>Array.from(g.raycaster.render(s.player,[],s.weapon));
      const idle=frame();g.invoke('attack',[false]);const windup=frame();
      g.step({});g.step({});const sweep=frame();
      for(let i=0;i<4;i++)g.step({});
      const recovery=frame();g.start();s.enemies=[];g.invoke('attack',[true]);const cast=frame();
      const signatures=new Set([idle,windup,sweep,recovery,cast].map(pixels=>pixels.join(',')));
      if(signatures.size!==5)throw new Error('Weapon phases do not have distinct rendered frames');
      g.start();g.paused=true;return true;
    }""")

    # Reach both landmarks through real collision-aware movement in every variant.
    assert page.evaluate("""() => {
      const g = __RunePixel3D, seen = new Set();
      function walk(point) {
        const s=g.app.state,m=g.config.maps[s.level_map],w=m.width;
        const start=Math.floor(s.player.y)*w+Math.floor(s.player.x);
        const parents=new Map([[start,null]]), queue=[start];let goal;
        for(let k=0;k<queue.length;k++) {
          const i=queue[k],x=i%w,y=Math.floor(i/w);
          if(Math.hypot(x+.5-point.x,y+.5-point.y)<.6){goal=i;break;}
          for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
            const n=ny*w+nx;
            if(nx>=0&&nx<w&&ny>=0&&ny<m.height&&m.grid[n]===0&&!parents.has(n)) {
              parents.set(n,i);queue.push(n);
            }
          }
        }
        if(goal===undefined)throw new Error('Unreachable landmark in '+s.level_map);
        const path=[];for(let i=goal;parents.get(i)!==null;i=parents.get(i))path.unshift(i);
        for(const i of path) {
          const x=i%w+.5,y=Math.floor(i/w)+.5;let attempts=0;
          while(Math.hypot(s.player.x-x,s.player.y-y)>.06) {
            if(++attempts>30)throw new Error('Blocked route in '+s.level_map);
            const angle=Math.atan2(y-s.player.y,x-s.player.x)*180/Math.PI;
            g.step({forward:true,look_x:((angle-s.player.angle+540)%360-180)/.15});
          }
        }
      }
      for(let trial=0;trial<40;trial++) {
        const level=trial%5+1;
        g.app.state.level=level;g.app.state.run_seed=trial*19;
        g.invoke('setup_depth');g.paused=false;const s=g.app.state,m=g.config.maps[s.level_map];
        seen.add(s.level_map);
        const heights={courtyard:1,crypt_a:1.5,crypt_b:1.5,ossuary:2,approach:2.5,vault:3};
        if(m.ceilingHeight!==heights[s.level_map])throw new Error('Wrong depth ceiling height');
        const textures=Object.values(g.config.textures);
        const used=[...new Set(m.grid.filter(n=>n>0))].map(n=>textures[n-1]);
        if(used.length<2||used.some(t=>![32,64].includes(t.width)||t.height!==t.width||t.pixels.length!==t.width*t.height))
          throw new Error('Detailed wall varieties are not wired into the map');
        for(const t of g.renderState().things) {
          if(!t.model||t.sprite||!g.config.models[t.model])throw new Error('World entity is not a full model');
        }
        if(g.frame().some(p=>(p>>>24)!==255))throw new Error('Model world left unrendered pixels');
        for(const t of [...s.enemies,...s.pickups,...s.landmarks,...s.hazards]) {
          if(m.grid[Math.floor(t.y)*m.width+Math.floor(t.x)]!==0)throw new Error('Solid spawn: '+s.level_map);
        }
        s.status='playing';s.enemies=[];s.pickups=[];s.hazards=[];
        walk(s.lore_pos);g.step({});g.step({use:true});
        if(!s.lore_read)throw new Error('Tablet unreachable');
        walk(s.secret_pos);g.step({});g.step({use:true});
        if(!s.secret_found)throw new Error('Secret unreachable');
        walk(s.chest_pos);g.step({});g.step({use:true});
        if(!s.chest_opened)throw new Error('Equipment chest unreachable');
        walk(s.shrine_pos);g.step({});g.step({use:true});
        if(!s.shrine_used)throw new Error('Shrine did not activate');
        walk(s.exit_pos);g.step({});
        if(s.level!==level)throw new Error('Automatic descent');
        g.step({use:true});
        if(level<5 ? s.level!==level+1 : s.status!=='won')throw new Error('Descent failed');
      }
      if(seen.size!==6)throw new Error('Did not cover all six authored layouts');
      g.start();g.app.state.enemies=[];g.app.state.pickups=[];
      const stairs=g.app.state.landmarks[1];
      if(stairs.model!=='world/stairs'||stairs.sprite)throw new Error('Stairs are still a billboard');
      if(g.config.models['world/stairs'].blocks.length!==4)throw new Error('Stair model was not compiled');
      g.app.state.player={x:10,y:10.5,angle:34};
      const first=Array.from(g.frame()),wallDepth=Array.from(g.raycaster.zBuffer);
      stairs.angle=90;
      const rotated=Array.from(g.frame());
      if(first.every((p,i)=>p===rotated[i]))throw new Error('Model rotation did not change its faces');
      if(wallDepth.some((d,i)=>d!==g.raycaster.zBuffer[i]))throw new Error('Visual model changed wall depth');
      stairs.angle=0;
      g.app.state.player={x:11.5,y:11.25,angle:90};
      if(g.frame().some(p=>(p>>>24)!==255))throw new Error('Close-up model left unrendered pixels');
      stairs.model='missing';
      let rejected=false;try{g.renderState();}catch(e){rejected=String(e).includes('Unknown pixel-3d model');}
      if(!rejected)throw new Error('Unknown models must report an error');
      stairs.model='world/stairs';
      g.start();g.paused=true;
      const c=g.app.state.player;
      const sky0=Array.from(g.raycaster.render(c));
      const sky1=Array.from(g.raycaster.render(c,[],undefined,0,undefined,[],12));
      if(sky0.every((p,i)=>p===sky1[i]))throw new Error('Sky did not animate');
      const depth=Array.from(g.raycaster.zBuffer);
      g.raycaster.render(c,[],undefined,0,undefined,[],24);
      if(depth.some((d,i)=>d!==g.raycaster.zBuffer[i]))throw new Error('Sky altered collision/depth');
      const time=g.renderState().time;g.step({});
      if(g.renderState().time!==time)throw new Error('Paused sky advanced');
      return true;
    }""")

    assert page.evaluate("""() => {
      const g=__RunePixel3D;g.start();g.paused=true;const s=g.app.state;
      s.enemies=[];s.pickups=[];s.landmarks=[];s.hazards=[];s.warnings=[];s.notice_ticks=0;
      s.player={x:1.5,y:1.5,angle:0};
      const foe={x:3.5,y:1.5,model:'enemy/skeleton',kind:'skeleton',angle:180,visible:true,hp:7,cooldown:0,scale:.8};
      s.enemies=[foe];g.invoke('refresh_ui');
      const first=Array.from(g.frame()),depth=Array.from(g.raycaster.zBuffer);
      foe.angle=90;const side=Array.from(g.frame());
      if(first.every((p,i)=>p===side[i]))throw new Error('Creature remains a billboard');
      g.invoke('update_combat');foe.cooldown=0;s.player.x=2.5;g.invoke('update_combat');
      if(foe.model!=='enemy/skeleton_warn')throw new Error('Model windup not visible');
      if(!s.warnings.every(t=>t.model&&!t.sprite))throw new Error('Target markers remain sprites');
      if(depth.some((d,i)=>d!==g.raycaster.zBuffer[i]))throw new Error('Creature changed wall collision');
      const caster={x:3.5,y:1.5,aim:180};g.invoke('spawn_bolt',[caster,0]);
      if(s.projectiles[0].model!=='enemy/bolt'||s.projectiles[0].z!==.5)throw new Error('Projectile is not a 3D model at eye height');
      const start=performance.now();for(let i=0;i<30;i++)g.frame();
      console.log('Close model frame average ms:',(performance.now()-start)/30);
      g.start();g.paused=true;return true;
    }""")

    # Walls block attacks, melee has limited reach, and rune casts hit only one foe.
    assert page.evaluate("""() => {
      const g=__RunePixel3D;g.start();g.paused=true;const s=g.app.state;
      s.player={x:1.5,y:1.5,angle:0};s.pickups=[];s.landmarks=[];s.hazards=[];
      s.enemies=[{x:2.5,y:1.5,kind:'skeleton',model:'enemy/skeleton_warn',hp:1,visible:true,scale:.8}];
      const shards=s.legacy.shards;g.invoke('attack',[false]);
      if(s.enemies[0].visible||s.kills!==1||s.legacy.shards!==shards+1)throw new Error('Death rewards changed');
      if(s.death_effects.length!==1||s.death_effects[0].model!=='enemy/skeleton')throw new Error('Death model missing');
      const effect=s.death_effects[0];
      const draw=()=>Array.from(g.raycaster.render(s.player,[effect]));
      const solid=draw();g.step({});
      if(effect.age!==0)throw new Error('Paused death animation advanced');
      g.paused=false;
      for(let i=0;i<17;i++)g.step({});
      if(s.remaining!==0||effect.age!==17||effect.dissolve!==.5)throw new Error('Death timing or remaining foes changed');
      const half=draw();if(solid.every((p,i)=>p===half[i]))throw new Error('Death dissolve not visible');
      g.paused=true;g.step({});if(effect.age!==17)throw new Error('Paused dissolve progressed');
      g.paused=false;for(let i=0;i<13;i++)g.step({});
      if(s.death_effects.length!==0||s.kills!==1||s.legacy.shards!==shards+1)throw new Error('Death cleanup or duplicate rewards');
      for(const kind of ['wraith','warden'])g.invoke('enemy_death',[{x:2.5,y:1.5,kind,scale:.8}]);
      for(const effect of s.death_effects) {
        effect.dissolve=1;
        const gone=Array.from(g.raycaster.render(s.player,[effect]));
        const background=Array.from(g.raycaster.render(s.player));
        if(gone.some((p,i)=>p!==background[i]))throw new Error('Fully dissolved model still occludes scene');
      }
      g.start();if(s.death_effects.length)throw new Error('Restart kept death effects');
      g.paused=true;return true;
    }""")

    assert page.evaluate("""() => {
      const g=__RunePixel3D;g.start();g.paused=true;const s=g.app.state;
      s.enemies=[{x:9.5,y:1.5,model:'enemy/skeleton',hp:7,visible:true,cooldown:100}];
      g.invoke('attack',[false]);if(s.enemies[0].hp!==7)throw new Error('Sword exceeded reach');
      s.cooldown=0;s.player={x:4.5,y:4.5,angle:0};
      s.enemies=[{x:8.5,y:4.5,model:'enemy/skeleton',hp:7,visible:true,cooldown:100}];
      g.invoke('attack',[true]);if(s.enemies[0].hp!==7)throw new Error('Spell crossed a wall');
      s.cooldown=0;s.player={x:1.5,y:1.5,angle:0};
      s.enemies=[{x:3.5,y:1.5,model:'enemy/skeleton',hp:6,visible:true,cooldown:100},
        {x:4.5,y:1.5,model:'enemy/skeleton',hp:6,visible:true,cooldown:100}];
      g.invoke('attack',[true]);
      if(s.enemies[0].visible||s.enemies[1].hp!==6)throw new Error('Spell target ordering failed');
      s.ammo=0;s.cooldown=0;g.invoke('attack',[true]);
      if(s.enemies[1].hp!==6||s.ammo!==0)throw new Error('Cast with no mana');
      g.paused=false;s.clock=89;s.enemies=[];g.step({});g.paused=true;
      if(s.ammo!==1)throw new Error('Mana did not regenerate');
      s.legacy.shards=8;s.status='gameover';g.invoke('train');g.paused=true;
      if(s.legacy.rank!==1||s.legacy.shards!==3)throw new Error('Training failed');
      return true;
    }""")
    page.reload()
    page.wait_for_function('__RunePixel3D.app.state.legacy.rank === 1')
    assert page.evaluate("__RunePixel3D.app.state.legacy.shards") == 3
    assert page.evaluate("__RunePixel3D.app.state.status") == "title"
    page.locator("[data-pixel-start]").click()
    page.wait_for_function("__RunePixel3D.app.state.health === 110")
    assert "Vect Breach" not in page.locator("[data-pixel-status]").inner_text()
    assert not errors, errors

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.goto(game_file.as_uri())
    mobile.wait_for_function('typeof __RunePixel3D !== "undefined"')
    mobile.locator("canvas").tap()
    assert mobile.evaluate("__RunePixel3D.app.state.status") == "title"
    mobile.locator("[data-pixel-start]").tap()
    mobile.wait_for_function('__RunePixel3D.app.state.status === "playing"')
    expect(mobile.get_by_role("button", name="RUNE", exact=True)).to_be_visible()
    expect(mobile.get_by_role("button", name="SWORD", exact=True)).to_be_visible()
    expect(mobile.get_by_role("button", name="DODGE", exact=True)).to_be_visible()
    expect(mobile.get_by_role("button", name="BUILD", exact=True)).to_be_visible()
    mobile.evaluate("__RunePixel3D.app.state.enemies=[];__RunePixel3D.app.state.hazards=[]")
    mobile.get_by_role("button", name="DODGE", exact=True).tap()
    mobile.wait_for_function("__RunePixel3D.app.state.dodge_cooldown > 0")
    mobile.get_by_role("button", name="BUILD", exact=True).tap()
    mobile.wait_for_function("__RunePixel3D.app.state.reward_choice === 1")
    mobile.evaluate("__RunePixel3D.app.state.status='gameover';__RunePixel3D.invoke('refresh_ui')")
    mobile.locator('[data-pixel-args="[1]"]').tap()
    mobile.wait_for_function("__RunePixel3D.app.state.legacy.class === 1")
    mobile.reload()
    mobile.wait_for_function("__RunePixel3D.app.state.hero_class === 1")
    mobile.locator("[data-pixel-start]").tap()
    mobile.wait_for_function("__RunePixel3D.app.state.max_health === 80")
    mobile.get_by_role("button", name="PAUSE", exact=True).tap()
    expect(mobile.locator(".pause-menu")).to_be_visible()
    mobile.locator("[data-pixel-restart]").tap()
    mobile.wait_for_function("__RunePixel3D.app.state.status === 'title' && !__RunePixel3D.paused")
    assert mobile.evaluate("__RunePixel3D.app.state.hero_class") == 1
    assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert mobile.locator(".game-info p").first.evaluate("el => parseFloat(getComputedStyle(el).fontSize)") >= 14
    assert mobile.locator("[data-pixel-start]").evaluate("el => el.getBoundingClientRect().height") >= 44
    assert not errors, errors
    browser.close()
print("Rune Crypt browser regressions passed")
