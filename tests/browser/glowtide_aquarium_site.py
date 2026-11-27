"""Verify Glowtide's localized showcase, gameplay and shared browser save."""
import argparse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from site_menu import menu_link
from teaching_ux import preview

parser = argparse.ArgumentParser()
parser.add_argument("--site-dir", required=True)
args = parser.parse_args()
game_path = "/assets/games/glowtide-aquarium/index.html"

with preview(Path(args.site_dir)) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    context = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    for locale, source_label in [("", "Source code"), ("es/", "Código fuente"), ("fr/", "Code source")]:
        page.goto(f"{base}/{locale}glowtide-aquarium/")
        expect(page.locator("h1")).to_have_text("Glowtide Aquarium")
        assert "%i18n." not in page.locator("body").inner_text()
        assert "Glowtide Aquarium" in page.title()
        assert page.locator('meta[name="description"]').get_attribute("content")
        assert page.locator('meta[property="og:image"]').get_attribute("content") == "/assets/glowtide-aquarium-cover.png"
        iframe = page.locator(".example-preview")
        expect(iframe).to_have_attribute("src", game_path)
        assert page.locator(f'a[href="{game_path}"]').count() >= 1
        frame = iframe.element_handle().content_frame()
        frame.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
        page.get_by_role("tab", name=source_label, exact=True).click()
        expect(page.locator(".source-file code").first).to_be_visible()
        assert page.locator(".source-file").count() > 1

    page.goto(base + "/glowtide-aquarium/")
    frame = page.locator(".example-preview").element_handle().content_frame()
    frame.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    frame.locator('[data-pixel-action="collect_treasure"]').click()
    frame.locator('[data-pixel-action="buy_fish"]').click()
    assert frame.evaluate("__RunePixel3D.app.state.progress.fish") == 4
    page.goto(base + game_path)
    page.wait_for_function("window.__RunePixel3D?.app.state.ticks >= 2")
    assert page.evaluate("__RunePixel3D.app.state.progress.fish") == 4
    assert page.evaluate("__RunePixel3D.config.persistence.key") == "glowtide-aquarium-v1"
    guide = page.locator(".aquarium-guide")
    expect(guide.locator("details")).to_have_count(5)
    expect(guide.locator("details[open]")).to_have_count(0)
    guide.get_by_text("Feeding and caring for friends", exact=True).click()
    expect(guide.locator("details[open]")).to_have_count(1)
    expect(guide.get_by_text("Feed scatters pellets", exact=False)).to_be_visible()

    for width in [320, 390, 1280]:
        page.set_viewport_size({"width": width, "height": 900})
        for locale in ["", "es/", "fr/"]:
            page.goto(f"{base}/{locale}")
            tile = page.locator('.showcase-tile[href$="glowtide-aquarium"]')
            expect(tile).to_be_visible()
            assert tile.locator("img").evaluate("(image) => image.complete && image.naturalWidth > 0")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            assert page.locator("#quickstart").evaluate(
                "(element) => !!(element.compareDocumentPosition(document.querySelector('#sandbox')) & Node.DOCUMENT_POSITION_FOLLOWING)"
            )
            menu_link(page, 'a.nav-link[href$="glowtide-aquarium"]').click()
            expect(page.locator("h1")).to_have_text("Glowtide Aquarium")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert not errors, errors
    browser.close()
print("Glowtide: localized routes, gameplay, shared save, source and responsive navigation passed")
