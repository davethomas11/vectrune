"""Browser scaling report: fixed nearby terrain/actors, increasing world/population.

Run from the repository root. Timings are reports, not CI performance thresholds.
"""
import json
import subprocess
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='rune-chunks-') as folder:
    bundle = Path(folder) / 'chunks.js'
    subprocess.run([
        str(ROOT / 'runtime/rune-web/node_modules/.bin/esbuild'),
        str(ROOT / 'tests/browser/chunks.ts'), '--bundle', '--format=iife',
        '--global-name=ChunkBench', f'--outfile={bundle}',
    ], check=True, capture_output=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page()
        page.add_script_tag(path=str(bundle))
        report = page.evaluate('ChunkBench.benchmark()')
        terrain = report['terrain']
        assert len({row['resident_chunks'] for row in terrain}) == 1
        assert len({(row['pixels'], row['depth']) for row in terrain}) == 1
        assert all(row['render_cache_cells'] == 0 for row in terrain)
        assert all(row['max_active'] == 15 for row in report['entities'])
        print(json.dumps(report, indent=2))
        browser.close()
