"""Batched idle saves retain immediate purchases and browser lifecycle flushes."""
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))

with tempfile.TemporaryDirectory(prefix="glowtide-saving-") as folder, sync_playwright() as pw:
    preview = Path(folder) / "aquarium.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/idle_aquarium/idle_aquarium.rune"), "-o", "html",
    ]))
    browser = pw.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script("window.requestAnimationFrame=()=>0")
    page.goto(preview.as_uri())
    page.wait_for_function("window.__RunePixel3D")
    result = page.evaluate("""() => {
        const g=__RunePixel3D, s=g.app.state, residents=s.residents;
        const key='rune-pixel-'+g.config.persistence.key;
        const saved=()=>JSON.parse(localStorage.getItem(key)).data;
        const stringify=JSON.stringify;
        let serializations=0;
        JSON.stringify=function(value,...rest) {
            if(value?.version===1 && value.data===s.progress) serializations++;
            return stringify.call(JSON,value,...rest);
        };
        for(let i=0;i<149;i++) g.step({});
        const before={serializations,age:saved().buddies[0].age};
        g.step({});
        const interval={serializations,age:saved().buddies[0].age};
        for(let i=0;i<30;i++) g.step({});
        Object.defineProperty(document,'hidden',{configurable:true,value:true});
        document.dispatchEvent(new Event('visibilitychange'));
        const hidden={serializations,age:saved().buddies[0].age,paused:g.paused};
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
        g.paused=false;
        const reused=residents===s.residents;
        s.progress.pearls=2000;s.save_revision++;
        g.invoke('buy_fish');
        const purchase={serializations,fish:saved().fish,residents:s.residents.length};
        for(let i=0;i<30;i++) g.step({});
        window.dispatchEvent(new Event('pagehide'));
        const closing={serializations,age:saved().buddies[0].age,paused:g.paused};
        JSON.stringify=stringify;
        return {before,interval,hidden,purchase,closing,reused};
    }""")
    assert result["before"] == {"serializations": 0, "age": 0}, result
    assert result["interval"] == {"serializations": 1, "age": 5}, result
    assert result["hidden"] == {"serializations": 2, "age": 6, "paused": True}, result
    assert result["purchase"] == {"serializations": 3, "fish": 4, "residents": 5}, result
    assert result["closing"] == {"serializations": 4, "age": 7, "paused": True}, result
    assert result["reused"], result
    page.reload()
    page.wait_for_function("window.__RunePixel3D")
    assert page.evaluate("__RunePixel3D.app.state.progress.buddies[0].age") == 7
    assert page.evaluate("__RunePixel3D.app.state.progress.fish") == 4
    assert not errors, errors
    browser.close()
