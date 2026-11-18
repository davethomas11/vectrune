"""Starfall CPU frame timings and exact color/depth comparisons, including the dock descent.

Export before/after HTML files, then run with --html, --output and optionally --compare.
Timings are local reports, not CI thresholds; comparisons require the same game content.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--html', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--compare', type=Path)
args = parser.parse_args()
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    page.goto(args.html.resolve().as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    page.evaluate((Path(__file__).parent / 'starfall_launch.js').read_text())
    results = []
    for scenario in ['dock descent', 'cargo', 'hydroponics', 'foundry', 'warden', 'explosion', 'camera rotation']:
        result = page.evaluate('''scenario => {
          const g=__RunePixel3D,s=g.app.state;__starfallLaunch();
          s.jets=true;s.plasma=true;s.dash_unlocked=true;s.garden_cleared=true;s.invulnerable=100000;
          if(scenario==='hydroponics'||scenario==='foundry'){
            s.player.x=scenario==='foundry'?69:52;g.step({use:true});s.invulnerable=100000;
          }
          const position={cargo:[35,19,5],hydroponics:[61,20,5.5],foundry:[87.5,20.6,5.5],
            warden:[108,20.6,6],explosion:[108,20.6,6],'dock descent':[22,19,14.5],
            'camera rotation':[35,19,5]}[scenario];
          s.player.x=scenario==='dock descent'?20.3:scenario==='hydroponics'?58:scenario==='foundry'?82:position[0];
          s.player.z=scenario==='dock descent'?13:3;s.player.vz=0;s.grounded=scenario!=='dock descent';
          Object.assign(s.camera,{x:position[0],y:position[1],z:position[2]});
          if(scenario==='warden')s.boss.model='sf/warden_leap';
          if(scenario==='explosion'){s.boss.visible=false;g.invoke('burst',[110,5,44]);g.invoke('burst',[109,4,44]);}
          const times=[],stepTimes=[],hashes=[];
          function hash(values){let h=2166136261;for(const v of values)h=Math.imul(h^v,16777619);return h>>>0;}
          for(let i=0;i<8;i++)g.frame();
          const frames=scenario==='dock descent'?75:40;
          for(let i=0;i<frames;i++){
            if(scenario==='dock descent'){
              const at=performance.now();g.step({});stepTimes.push(performance.now()-at);
            }
            if(scenario==='camera rotation')s.camera.angle=i*9;
            const at=performance.now(),frame=g.frame();times.push(performance.now()-at);
            if(i%5===0)hashes.push({sample:i,pixels:hash(frame),depth:hash(new Uint32Array(g.raycaster.pixelDepth.buffer))});
          }
          const stats=values=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b);
            return {median_ms:a[Math.floor(a.length*.5)],p95_ms:a[Math.floor(a.length*.95)],worst_ms:a.at(-1)};};
          return {name:scenario,render:stats(times),simulation:stats(stepTimes),hashes};
        }''', scenario)
        results.append(result)
        print(json.dumps({key: result[key] for key in ['name', 'render', 'simulation']}), flush=True)
    report = {'browser': browser.version, 'resolution': [432, 270], 'scenarios': results}
    if args.compare:
        previous = json.loads(args.compare.read_text())
        assert previous['resolution'] == report['resolution'], 'Benchmark resolutions differ'
        baseline = {row['name']: row for row in previous['scenarios']}
        assert set(baseline) == {row['name'] for row in results}, 'Benchmark scenarios differ'
        for row in results:
            before = baseline[row['name']]
            assert before['hashes'] == row['hashes'], f"Color/depth output changed: {row['name']}"
            row['p95_speedup'] = before['render']['p95_ms'] / row['render']['p95_ms']
        report['sampled_buffers_match'] = True
    args.output.write_text(json.dumps(report, indent=2))
    browser.close()
