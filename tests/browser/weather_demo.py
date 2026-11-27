"""Exercise the Rune-Web weather example with deterministic browser APIs."""
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
BINARY = ROOT / "target/debug/vectrune"
SOURCE = ROOT / "examples/rune-web/weather_web.rune"
CORS = {"access-control-allow-origin": "*"}


def main():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    process = subprocess.Popen(
        [str(BINARY), str(SOURCE), "--port", str(port)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise AssertionError("weather demo exited before becoming ready")
            try:
                with urlopen(base, timeout=1):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise AssertionError("weather demo did not start")

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for width in [320, 1280]:
                context = browser.new_context(viewport={"width": width, "height": 900}, permissions=[])
                page = context.new_page()
                errors = []
                requests = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.route("https://tile.openstreetmap.org/**", lambda route: route.abort())

                def search(route):
                    requests.append(route.request.url)
                    route.fulfill(status=200, headers=CORS, json={"results": [
                        {"name": "Paris", "admin1": "Île-de-France", "country": "France", "latitude": 48.8566, "longitude": 2.3522},
                        {"name": "Paris", "admin1": "Texas", "country": "United States", "latitude": 33.66, "longitude": -95.55},
                    ]})

                def weather(route):
                    requests.append(route.request.url)
                    route.fulfill(status=200, headers=CORS, json={
                        "current": {"temperature_2m": 12.5, "time": "2026-11-27T09:00"},
                        "timezone": "Europe/Paris",
                    })

                page.route("https://geocoding-api.open-meteo.com/**", search)
                page.route("https://api.open-meteo.com/**", weather)
                page.goto(base)
                expect(page.locator(".card-label")).to_have_text("Vancouver, British Columbia")
                expect(page.locator(".leaflet-container")).to_be_visible()
                expect(page.get_by_text("OpenStreetMap", exact=True)).to_be_visible()
                assert not requests
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                page.get_by_role("button", name="Check weather").click()
                expect(page.locator(".temperature")).to_have_text("12.5°C")
                expect(page.locator(".reading-note")).to_contain_text("Europe/Paris")
                query = parse_qs(urlparse(requests[-1]).query)
                assert query["latitude"] == ["49.28"] and query["timezone"] == ["auto"]

                page.get_by_label("Place name").fill("Paris & Lyon")
                page.evaluate("window.runeWebApp.render()")
                expect(page.get_by_label("Place name")).to_have_value("Paris & Lyon")
                expect(page.get_by_label("Place name")).to_be_focused()
                page.get_by_role("button", name="Search", exact=True).click()
                expect(page.get_by_role("button", name="Paris, Île-de-France, France")).to_be_visible()
                assert parse_qs(urlparse(requests[-1]).query)["name"] == ["Paris & Lyon"]
                page.get_by_role("button", name="Paris, Île-de-France, France").click()
                expect(page.locator(".card-label")).to_have_text("Paris, France")
                expect(page.locator(".temperature")).to_have_text("—")
                page.get_by_role("button", name="Check weather").click()
                expect(page.locator(".temperature")).to_have_text("12.5°C")
                assert parse_qs(urlparse(requests[-1]).query)["latitude"] == ["48.8566"]

                page.locator(".leaflet-container").click(position={"x": 180, "y": 150})
                expect(page.locator(".card-label")).to_have_text("Map point")
                expect(page.locator(".temperature")).to_have_text("—")
                version = page.evaluate("window.runeWebApp.state.location_version")
                page.locator(".leaflet-container").focus()
                page.keyboard.press("Enter")
                page.wait_for_function("(version) => window.runeWebApp.state.location_version > version", arg=version)
                page.route("https://tiles.example.org/**", lambda route: route.abort())
                page.evaluate("""() => {
                    function find(node) {
                        if (node.Element?.attrs?.['data-rune-map'] === 'weather') return node.Element;
                        for (const child of node.Element?.children ?? []) {
                            const match = find(child);
                            if (match) return match;
                        }
                        return null;
                    }
                    const map = find(window.__RuneWeb.ctx().pageTree);
                    map.attrs['data-map-tiles'] = 'https://tiles.example.org/$z/$x/$y.png';
                    map.attrs['data-map-attribution'] = '<Tile provider>';
                    window.runeWebApp.render();
                }""")
                expect(page.locator(".leaflet-control-attribution")).to_contain_text("<Tile provider>")
                expect(page.locator(".leaflet-control-attribution tile")).to_have_count(0)
                assert not errors, errors
                context.close()

            context = browser.new_context(
                geolocation={"latitude": 51.5072, "longitude": -0.1276},
                permissions=["geolocation"],
            )
            page = context.new_page()
            page.route("https://tile.openstreetmap.org/**", lambda route: route.abort())
            page.goto(base)
            expect(page.locator(".card-label")).to_have_text("Your location")
            expect(page.get_by_text("Selected: 51.5072, -0.1276")).to_be_visible()
            context.close()

            context = browser.new_context()
            page = context.new_page()
            page.route("https://tile.openstreetmap.org/**", lambda route: route.abort())
            page.add_init_script("""(() => {
                window.pendingRequests = [];
                window.fetch = url => new Promise(resolve => window.pendingRequests.push({ url: String(url), resolve }));
                navigator.permissions.query = async () => ({ state: 'granted' });
                navigator.geolocation.getCurrentPosition = success => { window.locationSuccess = success; };
            })()""")
            page.goto(base)
            page.wait_for_function("typeof window.locationSuccess === 'function'")
            expect(page.locator(".leaflet-container")).to_be_visible()
            page.locator(".leaflet-container").click(position={"x": 180, "y": 150})
            expect(page.locator(".card-label")).to_have_text("Map point")
            page.evaluate("""() => window.locationSuccess({
                coords: {latitude: 10, longitude: 20, accuracy: 10}, timestamp: Date.now()
            })""")
            expect(page.locator(".card-label")).to_have_text("Map point")

            page.evaluate("""() => {
                window.runeWebApp.invokeAction('searchPlace', ['first']);
                window.runeWebApp.invokeAction('searchPlace', ['second']);
            }""")
            page.wait_for_function("window.pendingRequests.length === 2")
            page.evaluate("""() => {
                const result = name => new Response(JSON.stringify({results: [
                    {name, admin1:'Region', country:'Country', latitude: 12, longitude: 34}
                ]}), {status:200, headers:{'content-type':'application/json'}});
                window.pendingRequests[1].resolve(result('Second'));
            }""")
            expect(page.get_by_role("button", name="Second, Region, Country")).to_be_visible()
            page.evaluate("""() => window.pendingRequests[0].resolve(new Response(JSON.stringify({
                results:[{name:'First',admin1:'Region',country:'Country',latitude:1,longitude:2}]
            }), {status:200}))""")
            page.wait_for_timeout(100)
            expect(page.get_by_role("button", name="Second, Region, Country")).to_be_visible()
            expect(page.get_by_role("button", name="First, Region, Country")).to_have_count(0)
            page.get_by_role("button", name="Second, Region, Country").click()
            page.get_by_role("button", name="Check weather").click()
            page.wait_for_function("window.pendingRequests.length === 3")
            page.locator(".leaflet-container").click(position={"x": 180, "y": 150})
            page.evaluate("""() => window.pendingRequests[2].resolve(new Response(JSON.stringify({
                current:{temperature_2m:99,time:'old'},timezone:'old'
            }), {status:200}))""")
            page.wait_for_timeout(100)
            expect(page.locator(".card-label")).to_have_text("Map point")
            expect(page.locator(".temperature")).to_have_text("—")
            page.get_by_role("button", name="Check weather").click()
            page.wait_for_function("window.pendingRequests.length === 4")
            page.evaluate("window.pendingRequests[3].resolve(new Response('failed', {status:503}))")
            expect(page.get_by_role("alert")).to_contain_text("Could not load")
            page.get_by_role("button", name="Check weather").click()
            page.wait_for_function("window.pendingRequests.length === 5")
            page.evaluate("""() => window.pendingRequests[4].resolve(new Response(JSON.stringify({
                current:{temperature_2m:0,time:'now'},timezone:'UTC'
            }), {status:200}))""")
            expect(page.locator(".temperature")).to_have_text("0°C")
            expect(page.get_by_role("alert")).to_have_count(0)
            page.get_by_role("button", name="Check weather").click()
            page.wait_for_function("window.pendingRequests.length === 6")
            page.locator(".leaflet-container").click(position={"x": 180, "y": 150})
            page.get_by_role("button", name="Check weather").click()
            page.wait_for_function("window.pendingRequests.length === 7")
            page.evaluate("window.pendingRequests[5].resolve(new Response('old failure', {status:503}))")
            page.wait_for_timeout(100)
            expect(page.get_by_role("button", name="Check weather")).to_be_disabled()
            expect(page.get_by_role("alert")).to_have_count(0)
            page.evaluate("""() => window.pendingRequests[6].resolve(new Response(JSON.stringify({
                current:{temperature_2m:7,time:'new'},timezone:'UTC'
            }), {status:200}))""")
            expect(page.locator(".temperature")).to_have_text("7°C")
            page.evaluate("window.runeWebApp.invokeAction('searchPlace', ['nowhere'])")
            page.wait_for_function("window.pendingRequests.length === 8")
            page.evaluate("window.pendingRequests[7].resolve(new Response('{\"results\":[]}', {status:200}))")
            expect(page.get_by_text("No matching places found.")).to_be_visible()
            page.evaluate("window.runeWebApp.invokeAction('searchPlace', ['unavailable'])")
            page.wait_for_function("window.pendingRequests.length === 9")
            page.evaluate("window.pendingRequests[8].resolve(new Response('failed', {status:503}))")
            expect(page.get_by_text("Could not search for places. Please try again.")).to_be_visible()
            context.close()
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=10)


if __name__ == "__main__":
    main()
