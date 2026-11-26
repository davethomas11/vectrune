"""Measure CPU feeding frames; optionally compare an older generated HTML renderer."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--baseline", type=Path)
args = parser.parse_args()

MEASURE = """async crowded => {
    const g = __RunePixel3D, s = g.app.state;
    if (crowded) {
        s.progress.tank = 2;
        s.progress.fish = 30;
        s.progress.critters = Array.from({length:12}, (_,i) => ({kind:i%4}));
        s.progress.florals = Array.from({length:12}, (_,i) => ({kind:i%3, slot:i}));
    }
    g.invoke('initialize');
    s.progress.pearls = 100;
    g.invoke('feed');
    g.raycaster.setEnhancedLighting(true);
    const simulation = [], frames = [];
    const stringify = JSON.stringify;
    const residents = s.residents;
    let serializations = 0;
    JSON.stringify = function(value, ...rest) {
        if (value?.version === 1 && value.data === s.progress) serializations++;
        return stringify.call(JSON, value, ...rest);
    };
    for (let i = 0; i < 150; i++) {
        const begin = performance.now();
        g.step({});
        const middle = performance.now();
        g.frame();
        if (i >= 30) {
            simulation.push(middle-begin);
            frames.push(performance.now()-middle);
        }
    }
    JSON.stringify = stringify;
    const stats = values => {
        values.sort((a,b) => a-b);
        return {median:values[values.length>>1], p95:values[Math.floor(values.length*.95)]};
    };
    const digest = async buffer => Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256', buffer))).map(b => b.toString(16).padStart(2,'0')).join('');
    const enhanced = await digest(g.frame().buffer);
    const depth = await digest(g.raycaster.pixelDepth.buffer);
    g.raycaster.setEnhancedLighting(false);
    const standard = await digest(g.frame().buffer);
    return {fish:s.fish.length, critters:s.crabs.length,
        simulation:stats(simulation), frame:stats(frames), enhanced, standard, depth,
        serializations, residentArrayReused:residents===s.residents,
        saveBytes:new TextEncoder().encode(JSON.stringify({version:1,data:s.progress})).length};
}"""

with tempfile.TemporaryDirectory(prefix="glowtide-cpu-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "aquarium.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/idle_aquarium/idle_aquarium.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    runs = {}
    for label, source in [("current", preview)] + ([("baseline", args.baseline.resolve())] if args.baseline else []):
        results = []
        for crowded in [False, True]:
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.add_init_script("window.requestAnimationFrame=()=>0")
            page.goto(source.as_uri())
            page.wait_for_function("window.__RunePixel3D")
            result = page.evaluate(MEASURE, crowded)
            assert result["fish"] == (30 if crowded else 3), result
            assert result["critters"] == (12 if crowded else 1), result
            if label == "current":
                assert result["serializations"] == 1, result
                assert result["residentArrayReused"], result
            assert not errors, errors
            results.append(result)
            page.close()
        runs[label] = results
    if args.baseline:
        for current, baseline in zip(runs["current"], runs["baseline"]):
            for key in ["enhanced", "standard", "depth"]:
                assert current[key] == baseline[key], f"{current['fish']} fish: {key} changed"
    print(json.dumps(runs, indent=2))
    browser.close()
