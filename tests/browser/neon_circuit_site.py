"""Verify the localized Neon Circuit showcase and shared save origin."""
import argparse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from site_menu import menu_link
from teaching_ux import preview

parser = argparse.ArgumentParser()
parser.add_argument("--site-dir", required=True)
args = parser.parse_args()

with preview(Path(args.site_dir)) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    for locale, source_label in [("", "Source code"), ("es/", "Código fuente"), ("fr/", "Code source")]:
        page.goto(f"{base}/{locale}neon-circuit/")
        expect(page.locator("h1")).to_have_text("Neon Circuit")
        assert "%i18n." not in page.locator("body").inner_text()
        assert "Neon Circuit" in page.title()
        assert page.locator('meta[name="description"]').get_attribute("content")
        assert page.locator('meta[property="og:image"]').get_attribute("content") == "/assets/neon-circuit-cover.png"
        iframe = page.locator(".example-preview")
        expect(iframe).to_have_attribute("src", "/assets/games/neon-circuit/index.html")
        frame = iframe.element_handle().content_frame()
        frame.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
        assert frame.url == f"{base}/assets/games/neon-circuit/index.html"
        frame.evaluate("localStorage.setItem('neon-site-origin-test', 'shared')")
        page.get_by_role("tab", name=source_label, exact=True).click()
        expect(page.locator(".source-file code").first).to_be_visible()
        assert page.locator(".source-file").count() == 46
    page.goto(f"{base}/assets/games/neon-circuit/index.html")
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert page.evaluate("localStorage.getItem('neon-site-origin-test')") == "shared"
    assert page.evaluate("__RunePixel3D.config.persistence.key") == "neon-circuit-save-v1"
    page.evaluate("localStorage.removeItem('neon-site-origin-test')")
    page.goto(base + "/")
    expect(page.locator('.showcase-tile[href$="neon-circuit"]')).to_be_visible()
    image = page.locator('.showcase-tile[href$="neon-circuit"] img')
    expect(image).to_be_visible()
    assert image.evaluate("(image) => image.complete && image.naturalWidth > 0")
    menu_link(page, 'a.nav-link[href$="neon-circuit"]').click()
    expect(page.locator("h1")).to_have_text("Neon Circuit")
    expect(page.locator(".example-preview")).to_have_attribute("src", "/assets/games/neon-circuit/index.html")
    for locale in ["", "es/", "fr/"]:
        page.goto(f"{base}/{locale}releases/")
        assert "0.3.12" in page.locator("body").inner_text()
        assert page.locator('a[href$="/releases/tag/v0.3.12"]').count() == 0
    assert not errors, errors
    browser.close()
print("Neon Circuit: localized showcase, source, cover, lazy navigation and shared save origin passed")
