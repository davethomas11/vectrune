"""Exercise the early Yule Log scene and fullscreen controls."""
import math
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))

with tempfile.TemporaryDirectory(prefix="yule-log-") as directory, sync_playwright() as pw:
    preview = Path(directory) / "yule.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/yule_log/yule_log.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    for fallback in (False, True):
        context = browser.new_context(viewport={"width": 844, "height": 390}, has_touch=True, is_mobile=True)
        if fallback:
            context.add_init_script(
                "HTMLElement.prototype.requestFullscreen = undefined; HTMLElement.prototype.webkitRequestFullscreen = undefined"
            )
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(preview.as_uri())
        page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
        assert page.evaluate("""() => {
          const s=__RunePixel3D.app.state;
          return s.camera.y === s.scenery.find(item=>item.model==='yule/hearth').y;
        }""")
        remote = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, nav=__RunePixel3DRuntime.createTvNavigation(g);
          const initial={scene:s.settings.scene,track:s.settings.track,objective:s.ui.objective,detail:s.ui.detail};
          nav.input('left'); nav.input('select');
          const track={index:s.settings.track,label:s.track_label,detail:s.ui.detail};
          nav.input('left'); nav.input('select'); const muted=g.muted;
          nav.input('select'); const unmuted=!g.muted;
          nav.input('back'); nav.input('select');
          const scene={index:s.settings.scene,objective:s.ui.objective};
          for(let i=0;i<5;i++) nav.input('left');
          g.activate('next_track'); g.activate('next_track'); g.activate('next_track'); g.activate('next_track');
          g.activate('switch_scene');
          for(let i=0;i<12;i++) g.step({});
          const workshop={scene:s.settings.scene,objective:s.ui.objective};
          g.activate('switch_scene');
          const creek={scene:s.settings.scene,objective:s.ui.objective};
          g.activate('switch_scene');
          const reset={scene:s.settings.scene,track:s.settings.track};
          nav.input('back');
          for(let i=0;i<4;i++) nav.input('left');
          nav.input('select');
          const beach={scene:s.settings.scene,objective:s.ui.objective};
          g.activate('switch_scene');
          return {initial,track,muted,unmuted,scene,workshop,creek,beach,reset};
        }""")
        assert remote["initial"] == {"scene": 0, "track": 0, "objective": "Fireplace", "detail": "Jingle Bells"}, remote
        assert remote["track"] == {"index": 1, "label": "Winter Glow", "detail": "Winter Glow"}, remote
        assert remote["muted"] and remote["unmuted"] and remote["scene"] == {"index": 1, "objective": "Snowman"}, remote
        assert remote["workshop"] == {"scene": 2, "objective": "Workshop"}, remote
        assert remote["creek"] == {"scene": 3, "objective": "Snowball Fight"}, remote
        assert remote["beach"] == {"scene": 4, "objective": "Santa Holiday"}, remote
        assert remote["reset"] == {"scene": 0, "track": 0}, remote
        widescreen = page.evaluate("""() => {
          const g=__RunePixel3D;
          g.resizeViewport(720,405,405/400);
          const frame=g.frame(), nav=__RunePixel3DRuntime.createTvNavigation(g);
          const before=g.app.state.settings.track;
          nav.input('left'); nav.input('select');
          const after=g.app.state.settings.track;
          const dimensions=[g.raycaster.width,g.raycaster.height,frame.length];
          g.activate('next_track'); g.activate('next_track'); g.activate('next_track'); g.activate('next_track');
          g.resizeViewport(640,400,1);
          return {dimensions,before,after};
        }""")
        assert widescreen == {"dimensions": [720,405,720*405], "before": 0, "after": 1}, widescreen
        animation = page.evaluate("""() => {
          const g = __RunePixel3D, s = g.app.state;
          const savedTicks = s.ticks;
          const hidden = s.snow.every(flake => flake.visible === false);
          const still = s.snow[0].z;
          for(let i=0;i<3;i++) g.step({});
          const frozen = s.snow[0].z === still;
          g.activate('switch_scene');
          const before = {
            flame: s.flames[0].scale, spark: s.sparks[0].z,
            snow: s.snow[0].z, child: s.players[0].y, dog: s.players[1].y
          };
          for (let i=0; i<10; i++) g.step({});
          const after = {
            flame: s.flames[0].scale, spark: s.sparks[0].z,
            snow: s.snow[0].z, child: s.players[0].y, dog: s.players[1].y
          };
          s.snow[0].z = 0.001;
          for(let i=0;i<3;i++) g.step({});
          const wrapped = s.snow[0].z;
          const shown = s.snow.every(flake => flake.visible === true);
          g.activate('switch_scene');
          for(let i=0;i<12;i++) g.step({});
          g.activate('switch_scene');
          g.activate('switch_scene');
          s.ticks = savedTicks + 11;
          return {before, after, wrapped, flakes: s.snow.length, sparks: s.sparks.length, hidden, frozen, shown};
        }""")
        assert animation["flakes"] == 120 and animation["sparks"] == 15
        assert animation["hidden"] and animation["frozen"] and animation["shown"], animation
        for item in ("flame", "spark", "snow", "child", "dog"):
            assert animation["before"][item] != animation["after"][item], (item, animation)
        assert animation["wrapped"] == 6.5
        snow_speeds = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, ticks=s.ticks;
          const saved=s.snow.map(flake=>({...flake}));
          g.activate('switch_scene');
          s.reveal_ticks=0;
          for(const flake of s.snow) flake.z=5;
          for(let i=0;i<30;i++) g.step({});
          const distances=[0,12,52].map(i=>5-s.snow[i].z);
          g.activate('switch_scene');
          for(let i=0;i<12;i++) g.step({});
          g.activate('switch_scene');
          g.activate('switch_scene');
          s.ticks=ticks;
          s.snow.forEach((flake,i)=>Object.assign(flake,saved[i]));
          return distances;
        }""")
        for actual, expected in zip(snow_speeds, (0.24, 0.42, 0.60)):
            assert abs(actual - expected) < 1e-8, snow_speeds
        def visible_pixels(group):
            return page.evaluate("""group => {
              const g=__RunePixel3D, s=g.app.state, paused=g.paused;
              g.paused=true;
              const visible=g.frame().slice();
              for (const item of s[group]) item.visible=false;
              const hidden=g.frame().slice();
              for (const item of s[group]) item.visible=true;
              g.paused=paused;
              return visible.reduce((n,p,i)=>n+(p!==hidden[i]),0);
            }""", group)
        assert visible_pixels("flames") > 1000
        assert visible_pixels("sparks") > 50
        details = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, paused=g.paused, result={};
          g.paused=true;
          for(const name of ['yule/window','yule/wreath','yule/logs','yule/tree-crown','yule/wall-molding']) {
            const items=s.scenery.filter(item=>item.model===name);
            if(name==='yule/logs') s.flames.forEach(item=>item.visible=false);
            const before=g.frame().slice();
            items.forEach(item=>item.visible=false);
            const after=g.frame().slice();
            items.forEach(item=>item.visible=true);
            if(name==='yule/logs') s.flames.forEach(item=>item.visible=true);
            result[name]={count:items.length,pixels:before.reduce((n,p,i)=>n+(p!==after[i]),0)};
          }
          g.paused=paused;
          return result;
        }""")
        assert details["yule/window"]["count"] == 2
        for item in details.values():
            assert item["pixels"] > 50, details
        molding = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, saved=s.ticks;
          function at(t) {s.ticks=t-1; g.step({}); return s.molding_glow[0].model;}
          const low=at(1500), high=at(500);
          const before=g.frame().slice(); s.molding_glow.forEach(item=>item.visible=false);
          const after=g.frame().slice(); s.molding_glow.forEach(item=>item.visible=true);
          s.ticks=saved-1; g.step({});
          return {low,high,pixels:before.reduce((n,p,i)=>n+(p!==after[i]),0)};
        }""")
        assert molding["high"] == "yule/molding-glow2" and molding["low"] == "yule/molding-glow0", molding
        assert molding["pixels"] > 20, molding
        lighting = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, before=g.frame().slice();
          const intensity=s.lights[0].intensity;
          s.lights[0].intensity=0;
          const unlit=g.frame().slice();
          s.lights[0].intensity=intensity;
          const samples=[];
          for(let i=0;i<60;i++) { g.step({}); samples.push(s.lights[0].intensity); }
          return {pixels:before.reduce((n,p,i)=>n+(p!==unlit[i]),0),
            range:Math.max(...samples)-Math.min(...samples),
            steps:new Set(samples.map((v,i)=>i ? (v-samples[i-1]).toFixed(4) : '0')).size};
        }""")
        assert lighting["pixels"] > 10000 and lighting["range"] > 0.06
        assert lighting["steps"] > 10
        tree_lighting = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, paused=g.paused;
          g.paused=true;
          const tree=s.scenery.filter(item=>item.model==='yule/tree' || item.model==='yule/tree-crown');
          const intensities=s.lights.slice(1,3).map(light=>light.intensity);
          const lit=g.frame().slice();
          s.lights.slice(1,3).forEach(light=>light.intensity=0);
          const unlit=g.frame().slice();
          tree.forEach(item=>item.visible=false);
          const noTree=g.frame().slice();
          tree.forEach(item=>item.visible=true);
          s.lights.slice(1,3).forEach((light,i)=>light.intensity=intensities[i]);
          g.paused=paused;
          const samples=[];
          for(let i=0;i<400;i++) { g.step({}); samples.push(s.lights.map(light=>light.intensity)); }
          return {
            pixels:lit.reduce((n,p,i)=>n+(p!==unlit[i] && unlit[i]!==noTree[i]),0),
            ranges:[1,2].map(j=>Math.max(...samples.map(v=>v[j]))-Math.min(...samples.map(v=>v[j]))),
            hearthMinimum:Math.min(...samples.map(v=>v[0])),
            treeMaximum:Math.max(...samples.flatMap(v=>v.slice(1,3)))
          };
        }""")
        assert tree_lighting["pixels"] > 100, tree_lighting
        assert min(tree_lighting["ranges"]) > 0.01, tree_lighting
        assert tree_lighting["hearthMinimum"] > tree_lighting["treeMaximum"], tree_lighting
        santa_windows = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, saved=s.ticks, samples=[];
          for(let t=1800;t<=2220;t+=5) {
            s.ticks=t-1; g.step({});
            const santa=s.santa[1], before=g.frame().slice();
            santa.visible=false;
            const after=g.frame().slice(), xs=[];
            for(let i=0;i<before.length;i++) if(before[i]!==after[i]) xs.push(i%640);
            samples.push({t,x:santa.x,y:santa.y,count:xs.length,min:Math.min(...xs),max:Math.max(...xs)});
          }
          s.ticks=1884; g.step({});
          const frame=s.scenery.find(x=>x.model==='yule/window' && x.y===-5);
          function santaPixels() {
            const before=g.frame().slice(); s.santa[1].visible=false;
            const after=g.frame().slice(); s.santa[1].visible=true;
            return before.reduce((n,p,i)=>n+(p!==after[i]),0);
          }
          const framed=santaPixels(); frame.visible=false;
          const unframed=santaPixels(); frame.visible=true;
          s.ticks=saved-1; g.step({});
          return {samples,framed,unframed};
        }""")
        visible = [s for s in santa_windows["samples"] if s["count"]]
        assert santa_windows["samples"][0]["count"] == santa_windows["samples"][-1]["count"] == 0
        assert all((104 <= s["min"] <= s["max"] <= 169) or
                   (471 <= s["min"] <= s["max"] <= 541) for s in visible), visible
        assert max(s["count"] for s in visible if s["max"] < 320) > 50
        assert max(s["count"] for s in visible if s["min"] > 320) > 50
        assert santa_windows["unframed"] > santa_windows["framed"] > 10, santa_windows
        assert all(s["x"] == 10.1 for s in santa_windows["samples"])
        orbit = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, frames=[];
          const positions=[];
          for (let i=0;i<10;i++) {
            for(let j=0;j<40;j++) {
              g.step({});
              positions.push(s.train.map(car=>({x:car.x,y:car.y,scale:car.scale})));
            }
            const engine=s.train[0];
            const visible=g.frame().slice();
            for(const car of s.train) car.visible=false;
            const hidden=g.frame().slice();
            for(const car of s.train) car.visible=true;
            frames.push({x:engine.x,y:engine.y,angle:engine.angle,
              pixels:visible.reduce((n,p,k)=>n+(p!==hidden[k]),0)});
          }
          for(let i=0;i<8;i++) {
            for(let j=0;j<90;j++) g.step({});
          }
          const tree=s.scenery.find(item=>item.model==='yule/tree');
          const present=s.scenery.find(item=>item.model==='yule/present');
          return {frames, positions, tree, present};
        }""")
        tree, present = orbit["tree"], orbit["present"]
        def distance_to_box(x, y, xmin, xmax, ymin, ymax):
            return math.hypot(max(xmin - x, 0, x - xmax), max(ymin - y, 0, y - ymax))
        for cars in orbit["positions"]:
            for car in cars:
                # The engine's furthest corner bounds every rotated engine and carriage.
                radius = math.hypot(0.5, 0.35) * car["scale"]
                x, y = car["x"], car["y"]
                assert distance_to_box(x, y, tree["x"] - 0.9, tree["x"] + 0.8,
                                       tree["y"] - 1, tree["y"] + 1) > radius
                assert distance_to_box(x, y, present["x"] - 0.3, present["x"] + 0.3,
                                       present["y"] - 0.3, present["y"] + 0.3) > radius
                assert distance_to_box(x, y, 7.52, 8.64, -2.56, 2.56) > radius
                assert x + radius < 9.5
        assert min(frame["x"] for frame in orbit["frames"]) < tree["x"] - 1.8
        assert max(frame["x"] for frame in orbit["frames"]) > tree["x"] + 1.8
        assert min(frame["y"] for frame in orbit["frames"]) < tree["y"] - 1.8
        assert max(frame["y"] for frame in orbit["frames"]) > tree["y"] + 1.8
        assert sum(frame["pixels"] > 20 for frame in orbit["frames"]) >= 8
        assert max(frame["pixels"] for frame in orbit["frames"]) > 1000
        pets = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, saved=s.ticks;
          function at(t) {s.ticks=t-1; g.step({}); return s.pets.map(p=>({...p}));}
          function pixels(index) {
            const before=g.frame().slice();
            s.pets[index].visible=false;
            const after=g.frame().slice();
            s.pets[index].visible=true;
            return before.reduce((n,p,i)=>n+(p!==after[i]),0);
          }
          const floor=at(200), floorPixels=pixels(2), dogPixels=pixels(0), yarnPixels=pixels(3);
          const table=at(324), tablePixels=pixels(2);
          const mantel=at(482), mantelPixels=pixels(2);
          const window=at(604), windowPixels=pixels(2);
          const sleeping=at(200)[1].z, awake=at(50)[1].z, headPixels=pixels(1);
          const near=at(12)[3].y, moved=at(42)[3].y;
          const phases=[300,306,312,450,459,468,580,586,592,1020,1026,1032,1080,1089,1098,1160,1166,1172]
            .map(t=>({t,cat:at(t)[2]}));
          const bat=at(5), roll=at(42), returned=at(100);
          const leap=at(306), leapPixels=pixels(2);
          s.ticks=1879; g.step({});
          const fly={active:s.santa[1].visible, x:s.santa[1].x, y:s.santa[1].y};
          const withSanta=g.frame().slice();
          s.santa[1].visible=false;
          const withoutSanta=g.frame().slice();
          fly.pixels=withSanta.reduce((n,p,i)=>n+(p!==withoutSanta[i]),0);
          s.ticks=2220; g.step({}); fly.ended=!s.santa[1].visible && !s.santa[0].visible;
          s.ticks=saved; g.step({});
          return {floor,table,mantel,window,floorPixels,tablePixels,mantelPixels,windowPixels,
            dogPixels,headPixels,yarnPixels,sleeping,awake,near,moved,fly,phases,bat,roll,returned,leap,leapPixels};
        }""")
        for key in ("floorPixels", "tablePixels", "mantelPixels", "windowPixels", "dogPixels", "headPixels", "yarnPixels"):
            assert pets[key] > 20, pets
        assert pets["floor"][2]["z"] == 0.1 and pets["table"][2]["z"] == 1.3, pets
        assert pets["mantel"][2]["z"] == 3.52 and pets["window"][2]["z"] == 2.8, pets
        assert pets["window"][2]["angle"] == -90, pets
        assert pets["awake"] > pets["sleeping"] + 0.1 and pets["near"] != pets["moved"], pets
        assert pets["bat"][2]["model"] == "yule/cat-bat"
        assert pets["roll"][3]["y"] > pets["bat"][3]["y"] + 0.35
        assert abs(pets["returned"][3]["y"] - pets["bat"][3]["y"]) < 1e-8
        assert pets["roll"][2]["y"] > pets["bat"][2]["y"]
        assert pets["leapPixels"] > 20, pets
        phases = {entry["t"]: entry["cat"] for entry in pets["phases"]}
        for start, mid, end in ((300,306,312),(450,459,468),(580,586,592),
                                (1020,1026,1032),(1080,1089,1098),(1160,1166,1172)):
            assert phases[mid]["model"] == "yule/cat-leap", (start, phases)
            assert phases[end]["model"] != "yule/cat-leap", (end, phases)
            linear_z = (phases[start]["z"] + phases[end]["z"]) / 2
            assert phases[mid]["z"] > linear_z + 0.6, (mid, phases)
            assert end - start <= 18
        assert pets["fly"]["active"] and pets["fly"]["ended"] and pets["fly"]["pixels"] > 10, pets
        story = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, saved=s.ticks;
          function at(t) {
            s.ticks=3600+t-1; g.step({});
            return {dog:{...s.pets[0]}, head:{...s.pets[1]}, cat:{...s.pets[2]},
                    tail:{...s.pets[4]}, stocking:{...s.story[0]}, fairy:{...s.story[1]},
                    sparkle:{...s.story[2]}, particles:s.story.slice(3).map(x=>({...x})),
                    train:s.train.map(x=>({...x}))};
          }
          function pixels(item) {
            const before=g.frame().slice(), visible=item.visible;
            item.visible=false;
            const after=g.frame().slice(); item.visible=visible;
            return before.reduce((n,p,i)=>n+(p!==after[i]),0);
          }
          const samples={};
          for(const t of [0,47,48,70,85,100,115,130,160,180,240,300,355,364,373,400,410,450,480,510,550,600,625,640,655,679,680,700,820,865,910,960,980,1000,1010,1055,1500,1518,1560,1799,1800])
            samples[t]=at(t);
          const chasePixels=[120,180,240,300,330].map(t=>{
            at(t); return {t,cat:pixels(s.pets[2]),dog:pixels(s.pets[0])};
          });
          at(480); const waitingDogPixels=pixels(s.pets[0]);
          at(700); const fairyPixels=pixels(s.story[1]);
          at(865); const magicPixels=pixels(s.story[2]);
          at(1000);
          const particleFrame=g.frame().slice();
          for(const p of s.story.slice(3)) p.visible=false;
          const particleHidden=g.frame().slice();
          const particlePixels=particleFrame.reduce((n,p,i)=>n+(p!==particleHidden[i]),0);
          let minClearance=Infinity, catClearance=Infinity, minHeading=1, catHeading=1, maxDogStep=0, maxCatStep=0, maxWallX=0;
          let previous=at(47);
          for(let t=48;t<680;t++) {
            const x=at(t);
            maxWallX=Math.max(maxWallX,x.dog.x,x.cat.x);
            for(const car of x.train) {
              const distance=Math.hypot(x.dog.x-car.x,x.dog.y-car.y);
              minClearance=Math.min(minClearance,distance);
              if (t<400) catClearance=Math.min(catClearance,Math.hypot(x.cat.x-car.x,x.cat.y-car.y));
            }
            const dx=x.dog.x-previous.dog.x, dy=x.dog.y-previous.dog.y;
            maxDogStep=Math.max(maxDogStep,Math.hypot(dx,dy,x.dog.z-previous.dog.z));
            if ((t>=111 && t<170) || (t>=171 && t<410) || (t>=426 && t<465) || (t>=551 && t<625)) {
              const a=x.dog.angle*Math.PI/180, distance=Math.hypot(dx,dy);
              minHeading=Math.min(minHeading,(-Math.sin(a)*dx+Math.cos(a)*dy)/distance);
            }
            const cx=x.cat.x-previous.cat.x, cy=x.cat.y-previous.cat.y;
            maxCatStep=Math.max(maxCatStep,Math.hypot(cx,cy,x.cat.z-previous.cat.z));
            if ((t>=48 && t<115) || (t>=116 && t<355) || (t>=356 && t<373)) {
              const a=x.cat.angle*Math.PI/180, distance=Math.hypot(cx,cy);
              catHeading=Math.min(catHeading,(-Math.sin(a)*cx+Math.cos(a)*cy)/distance);
            }
            previous=x;
          }
          s.ticks=saved; g.step({});
          return {samples,chasePixels,waitingDogPixels,fairyPixels,magicPixels,particlePixels,
                  minClearance,catClearance,minHeading,catHeading,maxDogStep,maxCatStep,maxWallX};
        }""")
        phases = story["samples"]
        assert phases["0"]["head"]["visible"] and not phases["0"]["tail"]["visible"], story
        assert phases["47"]["head"]["visible"] and not phases["48"]["head"]["visible"]
        assert phases["48"]["tail"]["visible"]
        assert phases["85"]["dog"]["model"] == "yule/dachshund-leap"
        assert phases["85"]["dog"]["z"] > 0.56
        assert phases["100"]["dog"]["z"] == 0
        assert phases["180"]["dog"]["model"] in ("yule/dachshund-running", "yule/dachshund-running-alt")
        assert phases["364"]["cat"]["model"] == "yule/cat-leap"
        assert phases["373"]["cat"]["z"] == 3.52
        assert phases["400"]["cat"]["z"] == 3.52
        assert phases["450"]["stocking"]["z"] < 0.11
        assert phases["480"]["tail"]["angle"] != phases["510"]["tail"]["angle"]
        assert phases["640"]["dog"]["model"] == "yule/dachshund-leap" and phases["640"]["dog"]["z"] > 0.56
        assert phases["680"]["head"]["visible"] and not phases["680"]["tail"]["visible"]
        assert phases["700"]["fairy"]["visible"] and not phases["700"]["sparkle"]["visible"]
        assert phases["865"]["sparkle"]["visible"] and 0.1 < phases["865"]["stocking"]["z"] < 2.45
        assert phases["910"]["stocking"]["z"] == 2.45 and not phases["910"]["sparkle"]["visible"]
        assert 0 < phases["980"]["fairy"]["dissolve"] < 1
        assert not phases["1000"]["fairy"]["visible"] and any(p["visible"] for p in phases["1000"]["particles"])
        assert not any(p["visible"] for p in phases["1055"]["particles"])
        assert phases["1560"]["cat"]["z"] == 0.1
        yarn = page.evaluate("""() => {
          const g=__RunePixel3D,s=g.app.state,saved=s.ticks, values=[];
          for(let t=3600;t<5118;t+=10) {
            s.ticks=t-1; g.step({}); values.push(s.pets[3].y);
          }
          s.ticks=saved-1; g.step({});
          return values;
        }""")
        assert all(y == 1.55 for y in yarn), yarn
        assert story["minClearance"] > 0.8, story["minClearance"]
        assert story["catClearance"] > 0.8, story["catClearance"]
        assert story["maxWallX"] + 0.6 < 9.5, story["maxWallX"]
        assert story["minHeading"] > 0.99, story["minHeading"]
        assert story["catHeading"] > 0.99, story["catHeading"]
        assert story["maxDogStep"] < 0.15, story["maxDogStep"]
        assert story["maxCatStep"] < 0.4, story["maxCatStep"]
        assert sum(p["cat"] > 10 for p in story["chasePixels"]) >= 2, story["chasePixels"]
        assert sum(p["dog"] > 10 for p in story["chasePixels"]) >= 2, story["chasePixels"]
        assert story["waitingDogPixels"] > 10, story["waitingDogPixels"]
        assert story["fairyPixels"] > 10 and story["magicPixels"] > 5 and story["particlePixels"] > 5, story
        page.locator(".toolbar [data-pixel-action=switch_scene]").tap()
        assert page.evaluate("__RunePixel3D.app.state.settings.scene") == 1
        reveal = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state;
          for(let i=0;i<35;i++) g.step({});
          const grown=s.reveal[0].scale, active=s.reveal[0].visible;
          const visible=g.frame().slice();
          s.reveal[0].visible=false;
          const hidden=g.frame().slice();
          s.reveal[0].visible=active;
          for(let i=0;i<120;i++) g.step({});
          return {grown, active, expired:!s.reveal[0].visible,
            pixels:visible.reduce((n,p,i)=>n+(p!==hidden[i]),0)};
        }""")
        assert reveal["active"] and reveal["grown"] > 0.9 and reveal["pixels"] > 100, reveal
        assert reveal["expired"]
        assert visible_pixels("snow") > 100
        assert visible_pixels("players") > 1000
        assert visible_pixels("limbs") > 20
        outdoor = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, paused=g.paused, result={};
          g.paused=true;
          for(const name of ['yule/cabin','yule/hill','yule/footprints','yule/winter-sky']) {
            const items=s.scenery.filter(item=>item.model===name);
            const before=g.frame().slice();
            items.forEach(item=>item.visible=false);
            const after=g.frame().slice();
            items.forEach(item=>item.visible=true);
            result[name]=before.reduce((n,p,i)=>n+(p!==after[i]),0);
          }
          const intensity=s.lights[3].intensity;
          const lit=g.frame().slice();
          s.lights[3].intensity=0;
          const unlit=g.frame().slice();
          s.lights[3].intensity=intensity;
          result.glow=lit.reduce((n,p,i)=>n+(p!==unlit[i]),0);
          const sled=s.winter_details[1];
          const sledVisible=sled.visible;
          sled.visible=true;
          const withSled=g.frame().slice();
          sled.visible=false;
          const withoutSled=g.frame().slice();
          sled.visible=sledVisible;
          result.sled=withSled.reduce((n,p,i)=>n+(p!==withoutSled[i]),0);
          result.layers=[s.snow[0],s.snow[12],s.snow[52]].map(f=>({x:f.x,scale:f.scale,z:f.z,y:f.y}));
          result.people=s.players.map(p=>p.model);
          g.paused=paused;
          const drift=[[],[],[]];
          for(let i=0;i<10;i++) {
            g.step({});
            [0,12,52].forEach((index,j)=>drift[j].push(s.snow[index].y));
          }
          result.drift=drift.map(samples=>Math.max(...samples)-Math.min(...samples));
          result.after=[s.snow[0],s.snow[12],s.snow[52]].map(f=>({z:f.z,y:f.y}));
          return result;
        }""")
        for name in ("yule/cabin", "yule/hill", "yule/footprints", "yule/winter-sky"):
            assert outdoor[name] > 20, outdoor
        assert outdoor["glow"] > 100, outdoor
        assert outdoor["sled"] > 20, outdoor
        assert outdoor["people"] == ["yule/child", "yule/outdoor-dog", "yule/ball"]
        layers = outdoor["layers"]
        assert layers[0]["x"] < layers[1]["x"] < layers[2]["x"]
        assert layers[0]["scale"] > layers[1]["scale"] > layers[2]["scale"]
        assert all(amount > 0.00001 for amount in outdoor["drift"]), outdoor
        for before, after in zip(layers, outdoor["after"]):
            assert before["z"] != after["z"], outdoor
        outdoor_motion = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, saved=s.ticks, sleds=[], legs=[];
          for(let t=420;t<840;t+=10) {
            s.ticks=t-1; g.step({});
            sleds.push({...s.winter_details[1]});
            const dog=s.players[1], direction=dog.angle===90 ? 1 : -1;
            legs.push(s.limbs.slice(2,4).map(leg=>({
              rear:(leg.y-dog.y)*direction, dx:leg.x-dog.x, z:leg.z-dog.z
            })));
          }
          s.ticks=1919; g.step({});
          const fly={active:s.santa[0].visible, y:s.santa[0].y};
          const before=g.frame().slice();
          s.santa[0].visible=false;
          const after=g.frame().slice();
          fly.pixels=before.reduce((n,p,i)=>n+(p!==after[i]),0);
          s.ticks=1949; g.step({}); fly.moved=s.santa[0].y;
          s.ticks=saved; g.step({});
          return {sleds,legs,fly};
        }""")
        for sled in outdoor_motion["sleds"]:
            expected = 1.7 - math.floor((sled["y"] - 23.2) / 0.8) * 0.1
            assert abs(sled["z"] - expected) < 1e-8, sled
        assert max(s["z"] for s in outdoor_motion["sleds"]) - min(s["z"] for s in outdoor_motion["sleds"]) >= 0.3
        for pair in outdoor_motion["legs"]:
            for leg in pair:
                assert -0.52 < leg["rear"] < -0.34 and 0 <= leg["z"] <= 0.061, leg
                assert abs(abs(leg["dx"]) - 0.12) < 1e-8, leg
        assert outdoor_motion["fly"]["active"] and outdoor_motion["fly"]["pixels"] > 100, outdoor_motion["fly"]
        assert outdoor_motion["fly"]["moved"] > outdoor_motion["fly"]["y"], outdoor_motion["fly"]
        motions = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state;
          const before={leg:s.limbs[0].y,tail:s.limbs[4].angle,ball:s.players[2].y,
            sled:s.winter_details[1].y,scarf:s.winter_details[0].angle};
          for(let i=0;i<10;i++) g.step({});
          return {before,after:{leg:s.limbs[0].y,tail:s.limbs[4].angle,ball:s.players[2].y,
            sled:s.winter_details[1].y,scarf:s.winter_details[0].angle}};
        }""")
        for item in ("leg", "tail", "ball", "sled", "scarf"):
            assert motions["before"][item] != motions["after"][item], (item, motions)
        puff = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state;
          s.ticks=899; g.step({}); const rare=s.winter_details[3].scale;
          s.ticks=1019; g.step({}); const normal=s.winter_details[3].scale;
          return {rare,normal};
        }""")
        assert puff["rare"] > puff["normal"] * 2, puff
        page.locator(".toolbar [data-pixel-action=next_track]").tap()
        assert page.evaluate("__RunePixel3D.audioState.track") == "yule_winter"
        for expected, label in (
            ("yule_silent_night", "Silent Night"),
            ("yule_deck", "Deck the Halls"),
            ("yule_tree", "O Christmas Tree"),
            ("yule_bells", "Jingle Bells"),
            ("yule_winter", "Winter Glow"),
        ):
            page.locator(".toolbar [data-pixel-action=next_track]").tap()
            assert page.evaluate("__RunePixel3D.audioState.track") == expected
            assert page.evaluate("__RunePixel3D.app.state.track_label") == label
            assert page.evaluate("__RunePixel3D.app.state.ui.detail") == label
        page.locator(".toolbar [data-pixel-fullscreen]").tap()
        page.wait_for_function('document.fullscreenElement || document.querySelector(".rune-pixel3d-expanded")')
        controls = page.locator(".fullscreen-controls")
        expect(controls).to_be_visible()
        controls.get_by_role("button", name="Change scene").tap()
        glance = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state;
          const initial={scene:s.settings.scene, pending:s.departure_ticks, face:s.snowman_head[2].y, head:s.snowman_head[0].y};
          g.activate('switch_scene');
          for(let i=0;i<4;i++) g.step({});
          const turned={scene:s.settings.scene, face:s.snowman_head[2].y, head:s.snowman_head[0].y};
          const faceFrame=g.frame().slice();
          s.snowman_head[2].visible=false;
          const noFace=g.frame().slice();
          s.snowman_head[2].visible=true;
          turned.pixels=faceFrame.reduce((n,p,i)=>n+(p!==noFace[i]),0);
          for(let i=0;i<12;i++) g.step({});
          return {initial,turned,scene:s.settings.scene,face:s.snowman_head[2].y,head:s.snowman_head[0].y};
        }""")
        assert glance["initial"]["scene"] == 1 and glance["initial"]["pending"] > 0, glance
        assert glance["turned"]["scene"] == 1 and glance["turned"]["face"] < glance["initial"]["face"] and glance["turned"]["pixels"] > 20, glance
        assert glance["turned"]["head"] < glance["initial"]["head"], glance
        assert glance["scene"] == 2 and glance["face"] == 30.18 and glance["head"] == 30.08, glance
        assert page.evaluate("__RunePixel3D.app.state.camera.y") == -30
        assert page.evaluate("__RunePixel3D.app.state.reveal_ticks") > 0
        workshop = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, savedTicks=s.ticks;
          const hiddenSnow=s.snow.every(flake=>!flake.visible), snowZ=s.snow[0].z;
          const visible=s.workshop.every(item=>item.visible) &&
            s.workshop_arms.every(item=>item.visible) && s.workshop_gifts.every(item=>item.visible);
          const frames=[];
          for(const [width,height] of [[640,400],[720,405]]) {
            g.resizeViewport(width,height,height/400);
            const full=g.frame().slice();
            for(const item of [s.workshop[7],s.workshop[8]]) item.visible=false;
            const noElves=g.frame().slice();
            for(const item of [s.workshop[7],s.workshop[8]]) item.visible=true;
            frames.push(full.reduce((n,p,i)=>n+(p!==noElves[i]),0));
          }
          g.resizeViewport(640,400,1);
          s.ticks=40; g.step({});
          const before={y:s.workshop_arms[0].y,z:s.workshop_arms[0].z,model:s.workshop_gifts[0].model};
          for(let i=0;i<20;i++) g.step({});
          const after={y:s.workshop_arms[0].y,z:s.workshop_arms[0].z};
          s.ticks=160; g.step({});
          const wrapped=s.workshop_gifts[0].model;
          const frozen=s.snow[0].z===snowZ;
          s.ticks=savedTicks;
          return {hiddenSnow,visible,frames,before,after,wrapped,frozen};
        }""")
        assert workshop["hiddenSnow"] and workshop["frozen"] and workshop["visible"], workshop
        assert min(workshop["frames"]) > 50, workshop
        assert workshop["before"]["y"] != workshop["after"]["y"] or workshop["before"]["z"] != workshop["after"]["z"], workshop
        assert workshop["before"]["model"] == "yule/wrapping-box" and workshop["wrapped"] == "yule/present", workshop
        visitors = page.evaluate("""() => {
          const g=__RunePixel3D, s=g.app.state, saved=s.workshop_ticks;
          function sample(t) {
            s.workshop_ticks=t-1; g.step({});
            return s.workshop_visitors.map(v=>({visible:v.visible,y:v.y,z:v.z,angle:v.angle || 0}));
          }
          function visiblePixels(items) {
            const full=g.frame().slice();
            for(const item of items) item.visible=false;
            const without=g.frame().slice();
            for(const item of items) item.visible=true;
            return full.reduce((n,p,i)=>n+(p!==without[i]),0);
          }
          const before=sample(449), santaEntry=sample(500);
          sample(620); const preLaugh=s.santa_extras.map(v=>v.visible);
          sample(625); const firstHo=s.santa_extras.map(v=>v.visible);
          sample(645); const secondHo=s.santa_extras.map(v=>v.visible);
          const santaPause=sample(675);
          const allHo=s.santa_extras.map(v=>v.visible), belly=s.santa_extras[0].z;
          const bubblePixels=visiblePixels(s.santa_extras.slice(1));
          sample(678); const bellyLater=s.santa_extras[0].z;
          const santaPixels=visiblePixels(s.workshop_visitors.slice(0,3));
          const santaExit=sample(1000), afterSanta=sample(1090);
          const deerEntry=sample(1850), deerEat=sample(2000);
          const deerPixels=visiblePixels(s.workshop_visitors.slice(3));
          const flecks=s.hay_flecks.map(v=>({visible:v.visible,y:v.y,z:v.z}));
          const fleckPixels=visiblePixels(s.hay_flecks.filter(v=>v.visible));
          const glowing=g.frame().slice(), noseLight={...s.lights[7]};
          s.lights[7].intensity=0;
          const unlit=g.frame().slice();
          const glowPixels=glowing.reduce((n,p,i)=>n+(p!==unlit[i]),0);
          const deerChew=sample(2010), flecksLater=s.hay_flecks.map(v=>({visible:v.visible,y:v.y,z:v.z}));
          const deerExit=sample(2350), flecksExit=s.hay_flecks.map(v=>v.visible), afterDeer=sample(2450);
          const lightAfterExit=s.lights[7].intensity;
          const roof=visiblePixels([s.workshop.find(item=>item.model==='yule/workshop-roof')]);
          const candles=visiblePixels(s.workshop_flames);
          const firstLight=s.lights[5].intensity, firstFlame=s.workshop_flames[0].scale;
          for(let i=0;i<5;i++) g.step({});
          const flicker=firstLight!==s.lights[5].intensity && firstFlame!==s.workshop_flames[0].scale;
          s.workshop_ticks=saved; g.step({});
          return {before,santaEntry,santaPause,santaPixels,santaExit,afterSanta,
                  deerEntry,deerEat,deerPixels,deerChew,deerExit,afterDeer,roof,candles,flicker,
                  noseLight,glowPixels,lightAfterExit,preLaugh,firstHo,secondHo,allHo,belly,bellyLater,
                  bubblePixels,flecks,flecksLater,fleckPixels,flecksExit};
        }""")
        assert not any(v["visible"] for v in visitors["before"]), visitors
        assert all(v["visible"] for v in visitors["santaPause"][:3]) and visitors["santaPixels"] > 100, visitors
        assert visitors["santaEntry"][0]["y"] < visitors["santaPause"][0]["y"] < visitors["santaExit"][0]["y"], visitors
        assert visitors["santaEntry"][0]["angle"] == visitors["santaExit"][0]["angle"] == 270 and visitors["santaPause"][0]["angle"] == 0, visitors
        assert visitors["preLaugh"] == [True, True, False, False, False], visitors
        assert visitors["firstHo"] == [True, True, True, False, False], visitors
        assert visitors["secondHo"] == [True, True, True, True, False], visitors
        assert all(visitors["allHo"]) and visitors["bubblePixels"] > 100 and visitors["belly"] != visitors["bellyLater"], visitors
        assert not any(v["visible"] for v in visitors["afterSanta"]), visitors
        assert all(v["visible"] for v in visitors["deerEat"][3:]) and visitors["deerPixels"] > 100, visitors
        assert visitors["deerEntry"][3]["y"] > visitors["deerEat"][3]["y"] < visitors["deerExit"][3]["y"], visitors
        assert visitors["deerEat"][4]["z"] != visitors["deerChew"][4]["z"] and visitors["deerExit"][3]["angle"] == 180, visitors
        assert any(v["visible"] for v in visitors["flecks"]) and visitors["flecks"] != visitors["flecksLater"], visitors
        assert visitors["fleckPixels"] > 0 and not any(visitors["flecksExit"]), visitors
        assert not any(v["visible"] for v in visitors["afterDeer"]), visitors
        assert visitors["noseLight"]["intensity"] > 0.5 and visitors["glowPixels"] > 5 and visitors["lightAfterExit"] == 0, visitors
        assert abs(visitors["noseLight"]["y"] - (visitors["deerEat"][4]["y"] - 0.75)) < 0.001, visitors
        assert visitors["roof"] > 100 and visitors["candles"] > 5 and visitors["flicker"], visitors
        controls.get_by_role("button", name="Change music").tap()
        assert page.evaluate("__RunePixel3D.audioState.track") == "yule_silent_night"
        controls.get_by_role("button", name="Exit fullscreen").tap()
        page.wait_for_function('!document.fullscreenElement && !document.querySelector(".rune-pixel3d-expanded")')
        page.reload()
        page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
        assert page.evaluate("__RunePixel3D.app.state.settings.scene") == 2
        assert page.evaluate("__RunePixel3D.app.state.camera.y") == -30
        page.evaluate("""() => {
          const g=__RunePixel3D;
          g.app.state.workshop_ticks=1999;
          g.step({});
        }""")
        assert page.evaluate("__RunePixel3D.app.state.workshop_visitors[3].visible")
        page.locator(".toolbar [data-pixel-action=switch_scene]").tap()
        assert page.evaluate("__RunePixel3D.app.state.workshop.every(item => !item.visible)")
        assert page.evaluate("""() => {
          const g=__RunePixel3D,s=g.app.state,t=s.workshop_ticks;
          for(let i=0;i<3;i++) g.step({});
          return s.workshop_ticks===t && s.workshop_visitors.every(v=>!v.visible) &&
            s.workshop_flames.every(v=>!v.visible) && s.santa_extras.every(v=>!v.visible) &&
            s.hay_flecks.every(v=>!v.visible);
        }""")
        creek = page.evaluate("""() => {
          const g=__RunePixel3D,s=g.app.state, saved=s.creek_ticks;
          function sample(t) {s.creek_ticks=t-1; g.step({});}
          function pixels(items) {
            const full=g.frame().slice();
            const visibility=items.map(v=>v.visible);
            for(const item of items) item.visible=false;
            const without=g.frame().slice();
            items.forEach((v,i)=>v.visible=visibility[i]);
            return full.reduce((n,p,i)=>n+(p!==without[i]),0);
          }
          sample(50);
          const first={...s.creek_balls[0]}, leftArm=s.creek_arms[0].angle;
          const ballsPixels=pixels([s.creek_balls[0]]);
          sample(70); const later={...s.creek_balls[0]};
          sample(100); const impact=s.creek_splashes.slice(0,4).map(v=>v.visible);
          const splashPixels=pixels(s.creek_splashes.slice(0,4));
          const duck=s.creek[16].z;
          sample(170); const second={...s.creek_balls[1]};
          sample(449); const beforeOwl=s.creek_owl.map(v=>v.visible);
          sample(500); const flight={y:s.creek_owl[0].y,wing:s.creek_owl[1].visible};
          sample(600); const perched={y:s.creek_owl[0].y,wing:s.creek_owl[1].visible};
          const owlPixels=pixels([s.creek_owl[0]]);
          const images=[];
          for(const [w,h] of [[640,400],[720,405]]) {
            g.resizeViewport(w,h,h/400);
            images.push({
              bridge:pixels([s.creek.find(v=>v.model==='yule/creek-bridge')]),
              moon:pixels([s.creek.find(v=>v.model==='yule/moon')]),
              snowmen:pixels([s.creek[10],s.creek[15]])
            });
          }
          g.resizeViewport(640,400,1);
          const lit=g.frame().slice(), moonlight=s.lights[7].intensity;
          s.lights[7].intensity=0;
          const dark=g.frame().slice();
          const lightPixels=lit.reduce((n,p,i)=>n+(p!==dark[i]),0);
          s.lights[7].intensity=moonlight;
          sample(1050); const afterOwl=s.creek_owl.map(v=>v.visible);
          const camera={...s.camera}, snowVisible=s.creek_snow.every(v=>v.visible);
          const characters=[];
          for(let t=0;t<240;t++) {
            sample(t);
            characters.push({
              heads:[{...s.creek[11]},{...s.creek[16]}],
              hats:[{...s.creek[12]},{...s.creek[17]}],
              faces:[{...s.creek[13]},{...s.creek[18]}],
              arms:s.creek_arms.map(v=>({...v})),
              balls:s.creek_balls.map(v=>({...v}))
            });
          }
          s.creek_ticks=saved; g.step({});
          return {first,later,leftArm,ballsPixels,impact,splashPixels,duck,second,beforeOwl,
                  flight,perched,owlPixels,images,moonlight,lightPixels,afterOwl,camera,snowVisible,characters};
        }""")
        assert creek["camera"]["x"] == -2 and creek["camera"]["y"] == 65 and creek["snowVisible"], creek
        assert creek["first"]["visible"] and creek["later"]["y"] > creek["first"]["y"] and creek["ballsPixels"] > 5, creek
        assert creek["second"]["visible"] and all(creek["impact"]) and creek["splashPixels"] > 0 and creek["duck"] < 2.2, creek
        assert not any(creek["beforeOwl"]) and not any(creek["afterOwl"]), creek
        assert creek["flight"]["wing"] and not creek["perched"]["wing"] and creek["flight"]["y"] > creek["perched"]["y"] and creek["owlPixels"] > 10, creek
        assert all(min(image.values()) > 25 for image in creek["images"]), creek
        assert creek["moonlight"] > 0 and creek["lightPixels"] > 100, creek
        poses = creek["characters"]
        for i, expected_angle in enumerate((300, 60)):
            assert min(p["heads"][i]["z"] for p in poses) < 1.75
            assert max(p["heads"][i]["z"] for p in poses) == 2.2
            assert max(p["arms"][i]["z"] for p in poses) - min(p["arms"][i]["z"] for p in poses) > 0.2
            assert all(p["faces"][i]["angle"] == expected_angle for p in poses)
            assert all(abs(p["hats"][i]["z"] - p["heads"][i]["z"] - 0.32) < 1e-8 for p in poses)
            assert max(abs(poses[j+1]["heads"][i]["z"] - poses[j]["heads"][i]["z"]) for j in range(239)) < 0.03
            assert any(p["balls"][i]["visible"] for p in poses)
        assert poses[0]["hats"][0]["model"] != poses[0]["hats"][1]["model"]
        optimized = page.evaluate("""() => {
          const g=__RunePixel3D,s=g.app.state, saved=s.creek_ticks, tick=s.ticks;
          const savedSnow=s.creek_snow.map(v=>({...v}));
          const oldTrain={...s.train[0]}, oldPet={...s.pets[2]};
          for(const flake of s.creek_snow) flake.z=5;
          for(let i=0;i<30;i++) g.step({});
          const falls=s.creek_snow.map(v=>5-v.z);
          const frozen=s.train[0].x===oldTrain.x && s.pets[2].x===oldPet.x &&
            s.lights.slice(0,7).every(light=>light.intensity===0);
          s.creek_ticks=saved; s.ticks=tick;
          s.creek_snow.forEach((v,i)=>Object.assign(v,savedSnow[i]));
          return {falls,frozen};
        }""")
        assert optimized["frozen"] and all(abs(fall-0.45)<1e-8 for fall in optimized["falls"]), optimized
        ice = page.evaluate("""() => {
          const g=__RunePixel3D,s=g.app.state, saved=s.creek_ticks;
          function sample(t) {s.creek_ticks=t-1; g.step({});}
          function bounds(instance, block) {
            const a=(instance.angle||0)*Math.PI/180, c=Math.cos(a), n=Math.sin(a);
            const scale=instance.scale||1, points=[];
            for(const x of [block.from[0],block.from[0]+block.size[0]])
              for(const y of [block.from[1],block.from[1]+block.size[1]])
                points.push([instance.x+scale*(x*c-y*n),instance.y+scale*(x*n+y*c)]);
            return {min:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),
                         instance.z+block.from[2]*scale],
                    max:[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1])),
                         instance.z+(block.from[2]+block.size[2])*scale]};
          }
          const bridge=s.creek.find(v=>v.model==='yule/creek-bridge');
          const bridgeBoxes=g.config.models[bridge.model].blocks.map(b=>bounds(bridge,b));
          function collides(instance) {
            return g.config.models[instance.model].blocks.some(block => {
              const box=bounds(instance,block);
              return bridgeBoxes.some(b=>[0,1,2].every(k=>box.min[k]<b.max[k]-1e-8 && box.max[k]>b.min[k]+1e-8));
            });
          }
          function visiblePixels(items) {
            const frame=g.frame().slice(), visible=items.map(v=>v.visible);
            for(const item of items) item.visible=false;
            const hidden=g.frame().slice();
            items.forEach((v,i)=>v.visible=visible[i]);
            return frame.reduce((n,p,i)=>n+(p!==hidden[i]),0);
          }
          sample(600); const entrance={...s.creek_ice[1]};
          sample(750); const upstream={ice:{...s.creek_ice[1]},elf:{...s.creek_rider[0]}};
          const riderPixels=visiblePixels(s.creek_rider);
          const floePixels=visiblePixels(s.creek_ice);
          sample(1025); const downstream={ice:{...s.creek_ice[1]},elf:{...s.creek_rider[0]}};
          const collisions=[];
          for(let t=750;t<=1000;t++) {
            sample(t);
            if(collides(s.creek_ice[1]) || collides(s.creek_rider[0])) collisions.push(t);
          }
          sample(1500); const after=s.creek_rider[0].visible;
          sample(2400); const emptyCycle=s.creek_rider[0].visible;
          sample(4200); const nextVisit=s.creek_rider[0].visible;
          s.creek_ticks=saved; g.step({});
          return {entrance,upstream,downstream,riderPixels,floePixels,collisions,after,emptyCycle,nextVisit};
        }""")
        assert ice["upstream"]["elf"]["visible"] and ice["downstream"]["elf"]["visible"], ice
        assert ice["upstream"]["ice"]["x"] > 11.3 and ice["downstream"]["ice"]["x"] < 9.7, ice
        assert ice["upstream"]["elf"]["x"] == ice["upstream"]["ice"]["x"]
        assert ice["downstream"]["elf"]["x"] == ice["downstream"]["ice"]["x"]
        assert ice["riderPixels"] > 10 and ice["floePixels"] > 10 and not ice["collisions"], ice
        assert not ice["after"] and not ice["emptyCycle"] and ice["nextVisit"], ice
        page.reload()
        page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
        assert page.evaluate("__RunePixel3D.app.state.settings.scene") == 3
        assert page.evaluate("__RunePixel3D.app.state.camera.y") == 65
        page.locator(".toolbar [data-pixel-action=santa_holiday]").tap()
        assert page.evaluate("__RunePixel3D.app.state.settings.scene") == 4
        assert page.evaluate("__RunePixel3D.app.state.camera.y") == -65
        beach = page.evaluate("""() => {
          const g=__RunePixel3D,s=g.app.state;
          function pixels(items) {
            const full=g.frame().slice(), visible=items.map(v=>v.visible);
            for(const item of items) item.visible=false;
            const without=g.frame().slice();
            items.forEach((v,i)=>v.visible=visible[i]);
            return full.reduce((n,p,i)=>n+(p!==without[i]),0);
          }
          const frames=[];
          for(const [w,h] of [[640,400],[720,405]]) {
            g.resizeViewport(w,h,h/400);
            frames.push({
              santa:pixels([s.beach_dancers[0]]),
              banana:pixels([s.beach_dancers[5]]),
              monkeys:pixels(s.beach_dancers.slice(6,8)),
              palms:pixels(s.beach.slice(3,5)),
              sun:pixels([s.beach[2]])
            });
          }
          g.resizeViewport(640,400,1);
          const before=s.beach_dancers.map(v=>({y:v.y,z:v.z,angle:v.angle||0}));
          for(let i=0;i<15;i++) g.step({});
          const after=s.beach_dancers.map(v=>({y:v.y,z:v.z,angle:v.angle||0}));
          return {frames,before,after,track:s.track_label,scene:s.settings.scene};
        }""")
        assert beach["track"] == "Santa's Beach Party" and beach["scene"] == 4, beach
        assert all(min(frame.values()) > 10 for frame in beach["frames"]), beach
        assert all(beach["before"][i] != beach["after"][i] for i in (0,1,2,3,4,5,6,7,8)), beach
        assert page.evaluate("__RunePixel3D.audioState.track") == "yule_beach"
        assert page.evaluate("__RunePixel3D.audioState.tempo") == 132
        page.reload()
        page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
        assert page.evaluate("__RunePixel3D.app.state.settings.scene") == 4
        assert page.evaluate("__RunePixel3D.app.state.camera.y") == -65
        page.locator(".toolbar [data-pixel-action=switch_scene]").tap()
        assert page.evaluate("""() => {
          const g=__RunePixel3D,s=g.app.state,t=s.creek_ticks,z=s.creek_snow[0].z;
          for(let i=0;i<3;i++) g.step({});
          return s.settings.scene===0 && s.creek_ticks===t && s.creek_snow[0].z===z &&
            [s.creek,s.creek_arms,s.creek_balls,s.creek_splashes,s.creek_snow,s.creek_owl,s.creek_ice,s.creek_rider]
              .every(group=>group.every(item=>!item.visible)) && s.lights[7].intensity===0 &&
            [s.beach,s.beach_dancers].every(group=>group.every(item=>!item.visible)) &&
            s.lights.slice(0,7).every(light=>light.intensity>0) &&
            Math.abs(s.train[0].x-(7.05+Math.cos(s.ticks*0.9*Math.PI/180)*2))<1e-8;
        }""")
        page.locator(".toolbar [data-pixel-action=switch_scene]").tap()
        page.locator(".toolbar [data-pixel-action=next_track]").tap()
        page.reload()
        page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
        assert page.evaluate("__RunePixel3D.app.state.settings.scene") == 1
        assert page.evaluate("__RunePixel3D.app.state.settings.track") == 3
        assert not errors, errors
        context.close()
    context = browser.new_context()
    page = context.new_page()
    page.goto(preview.as_uri())
    page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
    page.evaluate("""() => localStorage.setItem('rune-pixel-yule-log-v1',
      JSON.stringify({version:1,data:{scene:0,track:0}}))""")
    page.reload()
    page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
    assert page.evaluate("__RunePixel3D.app.state.settings.auto_scene") is True
    rotation = page.evaluate("""() => {
      const g=__RunePixel3D,s=g.app.state, nav=__RunePixel3DRuntime.createTvNavigation(g);
      s.scene_ticks=8998; g.step({});
      const before={scene:s.settings.scene,ticks:s.scene_ticks};
      g.step({});
      const automatic={scene:s.settings.scene,ticks:s.scene_ticks};
      nav.input('left'); nav.input('left'); nav.input('left'); nav.input('select');
      const off={enabled:s.settings.auto_scene,label:s.auto_scene_label,selected:s.ui.buttons[3].selected};
      s.scene_ticks=8999; g.step({});
      const disabled={scene:s.settings.scene,ticks:s.scene_ticks};
      nav.input('select');
      const on={enabled:s.settings.auto_scene,ticks:s.scene_ticks,label:s.auto_scene_label};
      s.scene_ticks=500; g.activate('switch_scene');
      const manual={ticks:s.scene_ticks,departure:s.departure_ticks};
      g.activate('santa_holiday');
      const interrupt={scene:s.settings.scene,departure:s.departure_ticks,ticks:s.scene_ticks};
      s.scene_ticks=8999; g.step({}); g.step({});
      const holiday={scene:s.settings.scene,ticks:s.scene_ticks};
      g.activate('switch_scene');
      s.settings.scene=3; s.scene_ticks=8999; g.step({});
      const wrap={scene:s.settings.scene,ticks:s.scene_ticks};
      return {before,automatic,off,disabled,on,manual,interrupt,holiday,wrap};
    }""")
    assert rotation["before"] == {"scene": 0, "ticks": 8999}, rotation
    assert rotation["automatic"] == {"scene": 1, "ticks": 0}, rotation
    assert rotation["off"] == {"enabled": False, "label": "Auto scenes: off", "selected": False}, rotation
    assert rotation["disabled"] == {"scene": 1, "ticks": 8999}, rotation
    assert rotation["on"] == {"enabled": True, "ticks": 0, "label": "Auto scenes: on"}, rotation
    assert rotation["manual"] == {"ticks": 0, "departure": 12}, rotation
    assert rotation["interrupt"] == {"scene": 4, "departure": 0, "ticks": 0}, rotation
    assert rotation["holiday"] == {"scene": 4, "ticks": 8999}, rotation
    assert rotation["wrap"] == {"scene": 0, "ticks": 0}, rotation
    page.locator(".toolbar [data-pixel-action=toggle_auto_scene]").click()
    page.reload()
    page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
    assert page.evaluate("__RunePixel3D.app.state.settings.auto_scene") is False
    assert page.locator(".toolbar [data-pixel-action=toggle_auto_scene]").inner_text() == "Auto scenes: off"
    context.close()
    context = browser.new_context()
    context.add_init_script("""(() => {
      const connect=AudioNode.prototype.connect;
      window.beachAudioProbe={analyser:null};
      AudioNode.prototype.connect=function(destination,...args) {
        if(destination instanceof AudioDestinationNode) {
          const analyser=this.context.createAnalyser();
          analyser.fftSize=1024;
          window.beachAudioProbe.analyser=analyser;
          connect.call(this,analyser);
          connect.call(analyser,destination);
          return destination;
        }
        return connect.call(this,destination,...args);
      };
      window.beachAudioProbe.rms=() => {
        const analyser=window.beachAudioProbe.analyser;
        if(!analyser) return 0;
        const samples=new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length);
      };
    })()""")
    page = context.new_page()
    page.goto(preview.as_uri())
    page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
    page.locator("canvas").click()
    page.evaluate("""() => {
      const g=__RunePixel3D;
      g.activate('santa_holiday');
    }""")
    page.wait_for_function("__RunePixel3D.audioState.track === 'yule_beach' && beachAudioProbe.rms() > 0.0001")
    assert page.evaluate("__RunePixel3D.audioState.tempo") == 132
    page.evaluate("__RunePixel3D.activate('switch_scene')")
    page.wait_for_function("__RunePixel3D.audioState.track === 'yule_bells' && beachAudioProbe.rms() > 0.0001")
    context.close()
    context = browser.new_context()
    context.add_init_script("""(() => {
      window.__musicClockOffset = 0;
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        get currentTime() { return super.currentTime + window.__musicClockOffset; }
      };
    })()""")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(preview.as_uri())
    page.wait_for_function("__RunePixel3D?.app.state.ticks > 3")
    assert page.evaluate("__RunePixel3D.audioState.track") is None
    page.locator("canvas").click()
    page.wait_for_function("__RunePixel3D.audioState.track === 'yule_bells'")
    for current, beats, following in (
        ("yule_bells", 128, "yule_winter"),
        ("yule_winter", 64, "yule_silent_night"),
        ("yule_silent_night", 72, "yule_deck"),
        ("yule_deck", 64, "yule_tree"),
        ("yule_tree", 72, "yule_bells"),
    ):
        page.wait_for_function("__RunePixel3D.app.state.music_started")
        state = page.evaluate("__RunePixel3D.audioState")
        assert state["track"] == current and state["totalBeats"] == beats, state
        page.evaluate("seconds => window.__musicClockOffset += seconds",
                      beats * 60 / state["tempo"] + 1)
        page.wait_for_function("track => __RunePixel3D.audioState.track === track", arg=following)
        assert page.evaluate("__RunePixel3D.app.state.track_ids[__RunePixel3D.app.state.settings.track]") == following
    tv_script = (ROOT / "native/tvos/runtime/src/tv_input.js").read_text()
    visibility = page.evaluate("""script => {
      const now = Date.now, g = __RunePixel3D;
      let time = 100000;
      Date.now = () => time;
      try {
        (0, eval)(script);
        const nav = __RuneTVInput, before = g.app.state.settings.scene;
        const initially = nav.visible();
        nav.input('right');
        const revealed = nav.visible(), afterReveal = g.app.state.settings.scene;
        time += 5999;
        const stillVisible = nav.visible();
        time += 2;
        const hidden = !nav.visible();
        nav.input('select');
        return {initially, revealed, stillVisible, hidden,
          afterReveal, before, afterHiddenSelect:g.app.state.settings.scene, visibleAgain:nav.visible()};
      } finally { Date.now = now; }
    }""", tv_script)
    assert not visibility["initially"] and visibility["revealed"] and visibility["stillVisible"]
    assert visibility["hidden"] and visibility["visibleAgain"]
    assert visibility["before"] == visibility["afterReveal"] == visibility["afterHiddenSelect"]
    volume = page.evaluate("""() => {
      const nav = __RunePixel3DRuntime.createTvNavigation(__RunePixel3D);
      const initial = nav.volume();
      nav.input('down'); nav.input('select');
      nav.input('left');
      const lower = nav.volume();
      nav.input('right'); nav.input('right');
      const higher = nav.volume();
      for (let i=0; i<40; i++) nav.input('right');
      const maximum = nav.volume();
      for (let i=0; i<40; i++) nav.input('left');
      const minimum = nav.volume();
      nav.input('back');
      return {initial,lower,higher,maximum,minimum};
    }""")
    assert volume == {"initial":3,"lower":2.75,"higher":3.25,"maximum":4,"minimum":0}, volume
    assert not errors, errors
    context.close()
    browser.close()
print("Yule Log prototype: scenes, music and fullscreen controls passed")
