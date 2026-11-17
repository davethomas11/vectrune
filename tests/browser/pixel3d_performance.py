"""Repeatable CPU camera-orbit benchmark. Timings are reports, never CI thresholds.

Build/export Skybound 2, then pass --html and --output to compare engine builds.
Use --profile to include Chromium CPU samples. Frame hashes check visual parity.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--html', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--profile', action='store_true')
parser.add_argument('--compare', type=Path, help='Check sampled pixel/depth hashes against a report from the same game export')
args = parser.parse_args()
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    page.goto(args.html.resolve().as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    session = page.context.new_cdp_session(page)
    if args.profile:
        session.send('Profiler.enable')
        session.send('Profiler.setSamplingInterval', {'interval': 500})
        session.send('Profiler.start')
    results = []
    for stage, name, center in [(0, 'Reedwake start', [7, 9, 3]), (3, 'Canopy trees', [7, 31, 3]),
                                 (6, 'Storm arena', [39, 31, 8])]:
        result = page.evaluate('''({stage,name,center}) => {
          const g=__RunePixel3D,s=g.app.state;
          g.paused=true;g.invoke('show_map');s.saga.unlocked=7;g.invoke('select_stage',[stage]);g.start();
          g.step=()=>{};
          const times=[], hashes=[];
          function hash(values){let h=2166136261;for(const v of values)h=Math.imul(h^v,16777619);return h>>>0;}
          for(let sample=-8;sample<80;sample++){
            const angle=((sample+80)%40)*9, a=angle*Math.PI/180;
            Object.assign(s.camera,{x:Math.max(.3,Math.min(s.world.width-.3,center[0]-Math.cos(a)*7)),
              y:Math.max(.3,Math.min(s.world.height-.3,center[1]-Math.sin(a)*7)),z:center[2]+3.3,angle,pitch:-21});
            const start=performance.now();const frame=g.frame();const elapsed=performance.now()-start;
            if(sample>=0)times.push(elapsed);
            if(sample>=0&&sample<40&&sample%5===0)hashes.push({angle,pixels:hash(frame),depth:hash(new Uint32Array(g.raycaster.pixelDepth.buffer))});
          }
          const sorted=[...times].sort((a,b)=>a-b);
          return {name,median_ms:sorted[Math.floor(sorted.length*.5)],p95_ms:sorted[Math.floor(sorted.length*.95)],
            worst_ms:sorted.at(-1),hashes,samples:times};
        }''', {'stage': stage, 'name': name, 'center': center})
        results.append(result)
        print(json.dumps({key: result[key] for key in ['name', 'median_ms', 'p95_ms', 'worst_ms']}), flush=True)
    report = {'browser': browser.version, 'resolution': [432, 270], 'scenarios': results}
    if args.profile:
        profile = session.send('Profiler.stop')['profile']
        hits = {}
        for node in profile['nodes']:
            name = node['callFrame']['functionName'] or '(anonymous)'
            hits[name] = hits.get(name, 0) + node.get('hitCount', 0)
        report['cpu_samples'] = sorted(hits.items(), key=lambda item: -item[1])[:20]
        print(json.dumps({'cpu_samples': report['cpu_samples']}), flush=True)
    if args.compare:
        previous = json.loads(args.compare.read_text())
        baseline = {scenario['name']: scenario for scenario in previous['scenarios']}
        assert previous['resolution'] == report['resolution'], 'Benchmark resolutions differ'
        assert set(baseline) == {scenario['name'] for scenario in results}, 'Benchmark scenarios differ'
        for scenario in results:
            before = baseline[scenario['name']]
            assert before['hashes'] == scenario['hashes'], f"Pixel/depth hashes changed: {scenario['name']}"
            scenario['p95_speedup'] = before['p95_ms'] / scenario['p95_ms']
        report['sampled_buffers_match'] = True
    args.output.write_text(json.dumps(report, indent=2))
    browser.close()
