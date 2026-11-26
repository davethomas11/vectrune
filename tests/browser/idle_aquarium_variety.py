"""Eight persisted fish varieties and atomic per-living-resident feeding prices."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))

with tempfile.TemporaryDirectory(prefix="aquarium-variety-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "aquarium.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/idle_aquarium/idle_aquarium.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    page = browser.new_page()
    page.add_init_script("window.requestAnimationFrame=()=>0")
    page.goto(preview.as_uri())
    page.wait_for_function("Boolean(window.__RunePixel3D)", polling=50)
    assert page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state;
      s.progress.pearls=3;g.invoke('update_labels');
      if(!s.feed_locked || s.feed_cost!==4) throw Error('Starter price');
      const revision=s.save_revision;
      g.invoke('feed');
      if(s.progress.pearls!==3 || s.fed_ticks || s.feed_cooldown || s.food.length ||
        s.save_revision!==revision || !s.notice.includes('4 pearls')) throw Error('Unaffordable feed changed state');
      s.progress.pearls=4;g.invoke('feed');
      if(s.progress.pearls!==0 || s.fed_ticks!==900 || s.save_revision!==revision+1) throw Error('Exact affordable feed');
      g.invoke('feed');
      if(s.progress.pearls!==0 || s.feed_cooldown!==1200) throw Error('Cooldown charged twice');
      s.progress.pearls=100000;s.progress.fish=8;g.invoke('initialize');
      if(new Set(s.fish.map(f=>f.model)).size!==8) throw Error('Missing variety');
      g.raycaster.setEnhancedLighting(true);g.frame();
      for(const model of s.species){
        const ray=g.raycaster;
        const pixels=ray.render({x:20,y:24,z:3,angle:90},[{x:20,y:28,z:4,model}]);
        if(!ray.pixelDepth.some(Number.isFinite) || !pixels.every(c=>c>>>24===255))
          throw Error('Fish model failed to render: '+model);
      }
      for(let i=0;i<8;i++){
        g.invoke('inspect_fish',[i]);
        if(s.profile_species!==s.species_names[i]) throw Error('Species profile mismatch');
        g.invoke('close_profile');
      }
      const saved=JSON.stringify(s.progress.buddies.map(b=>({kind:b.kind,name:b.name,life:b.lifespan,id:b.care.id})));
      g.invoke('initialize');
      if(saved!==JSON.stringify(s.progress.buddies.map(b=>({kind:b.kind,name:b.name,life:b.lifespan,id:b.care.id}))))
        throw Error('Species rebuild changed care');
      s.progress.buddies[0].dead=true;s.progress.critters[0].dead=true;
      g.invoke('update_labels');
      if(s.feed_cost!==7) throw Error('Dead residents charged');
      g.invoke('feed');
      if(s.progress.pearls!==99993) throw Error('Actual charged price');
      s.feed_cooldown=0;s.fed_ticks=0;s.progress.pearls=1;
      for(const buddy of s.progress.buddies) buddy.dead=true;
      g.invoke('update_labels');g.invoke('feed');
      if(s.feed_cost!==1 || s.progress.pearls!==0) throw Error('Minimum price');
      g.frame();
      return true;
    }""")
    browser.close()
