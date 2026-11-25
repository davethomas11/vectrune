"""Benchmark the Neon Circuit CPU renderer at its authored resolution."""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--html", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--compare", type=Path, help="Require matching color and depth hashes from the same game export")
parser.add_argument("--profile", action="store_true")
parser.add_argument("--lighting", choices=("standard", "enhanced"), default="standard")
args = parser.parse_args()

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 900})
    page.goto(args.html.resolve().as_uri())
    page.wait_for_function('typeof __RunePixel3D !== "undefined"')
    lighting = page.locator("select[data-pixel-lighting]")
    if lighting.count():
        lighting.select_option(args.lighting)
    elif args.lighting == "enhanced":
        raise RuntimeError("This export has no lighting selector")
    session = page.context.new_cdp_session(page)
    if args.profile:
        session.send("Profiler.enable")
        session.send("Profiler.setSamplingInterval", {"interval": 500})
        session.send("Profiler.start")

    results = page.evaluate("""() => {
      const g = __RunePixel3D, s = g.app.state;
      if (g.raycaster.width !== 576 || g.raycaster.height !== 360) throw Error('Expected 576×360');
      const scenarios = [];
      function hash(values) {
        let h = 2166136261;
        for (const v of values) h = Math.imul(h ^ v, 16777619);
        return h >>> 0;
      }
      function frameHashes() {
        const pixels = g.frame();
        return [hash(pixels), hash(new Uint32Array(g.raycaster.pixelDepth.buffer))];
      }
      function measure(name, views) {
        const times = [];
        const hashes = views.map(view => {
          Object.assign(s.camera, view);
          return frameHashes();
        });
        for (let i = -24; i < 96; i++) {
          Object.assign(s.camera, views[((i % views.length) + views.length) % views.length]);
          const start = performance.now();
          g.frame();
          if (i >= 0) times.push(performance.now() - start);
        }
        const sorted = [...times].sort((a, b) => a - b);
        const percentile = p => +sorted[Math.ceil(sorted.length * p) - 1].toFixed(2);
        scenarios.push({name, median_ms: percentile(.5), p95_ms: percentile(.95), hashes, samples: times});
      }
      g.invoke('load_stage', [0]);
      g.ticks = 0;
      s.ticks = 0;
      const startX = s.camera.x;
      measure('Volt Viper entrance', Array.from({length: 8}, (_, i) => ({x: startX + i * .12})));

      // Set up the flip in the boss room. Capture real animation frames and
      // camera poses, including the authored backdrop and pivot.
      s.player.x = 106;
      s.camera.x = 110;
      g.invoke('on_boss_defeated', []);
      for (let i = 0; i < 100 && s.status !== 'escape_flip'; i++) g.step({});
      if (s.status !== 'escape_flip') throw Error('Expected escape transition');
      const views = [];
      const animationHashes = [frameHashes()];
      for (let i = 1; i <= 45; i++) {
        g.step({});
        if (i % 5 === 0 || i === 22) animationHashes.push(frameHashes());
        if (i >= 18 && i <= 25) {
          views.push({...s.camera, terrainPose: {...s.camera.terrainPose, position: [...s.camera.terrainPose.position]}});
        }
      }
      if (!s.escape_active) throw Error('Expected escape deck');
      // Restore mid-flip visibility and object/light poses for the timed samples.
      g.invoke('load_stage', [0]);
      g.ticks = 0;
      s.ticks = 0;
      s.player.x = 106;
      s.camera.x = 110;
      g.invoke('on_boss_defeated', []);
      for (let i = 0; i < 100 && s.status !== 'escape_flip'; i++) g.step({});
      for (let i = 0; i < 22; i++) g.step({});
      measure('Mid-flip', views);
      return {scenarios, animationHashes};
    }""")
    scenarios = results["scenarios"]
    report = {
        "browser": browser.version,
        "resolution": [576, 360],
        "lighting": args.lighting,
        "scenarios": scenarios,
        "animation_hashes": results["animationHashes"],
    }
    if args.profile:
        counts = {}
        for node in session.send("Profiler.stop")["profile"]["nodes"]:
            name = node["callFrame"]["functionName"] or "(anonymous)"
            counts[name] = counts.get(name, 0) + node.get("hitCount", 0)
        report["cpu_samples"] = sorted(counts.items(), key=lambda item: -item[1])[:20]
    browser.close()

for case in scenarios:
    print(f"{case['name']} — median {case['median_ms']} ms, p95 {case['p95_ms']} ms")
if args.profile:
    print(report["cpu_samples"])

if args.compare:
    baseline = json.loads(args.compare.read_text())
    assert baseline["browser"] == report["browser"], "Benchmark browser versions differ"
    assert baseline["resolution"] == report["resolution"]
    expected = {case["name"]: case for case in baseline["scenarios"]}
    assert set(expected) == {case["name"] for case in scenarios}
    for case in scenarios:
        before = expected[case["name"]]
        for i, (reference, candidate) in enumerate(zip(before["hashes"], case["hashes"], strict=True)):
            assert reference == candidate, (case["name"], i, reference, candidate)
        case["p95_speedup"] = round(before["p95_ms"] / case["p95_ms"], 3)
    assert baseline["animation_hashes"] == report["animation_hashes"], "Colors or depths changed during the flip"
    report["sampled_buffers_match"] = True

args.output.write_text(json.dumps(report, indent=2) + "\n")
