"""Verify opt-in rotation expansion in the site and standalone game exports."""
import argparse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from teaching_ux import preview

parser = argparse.ArgumentParser()
parser.add_argument("--site-dir", required=True)
args = parser.parse_args()

with preview(Path(args.site_dir)) as base, sync_playwright() as pw:
    browser = pw.chromium.launch()
    for game in ["neon-circuit", "marble-run", "dog-walker"]:
        for embedded in [True, False]:
            context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
            context.add_init_script(
                "HTMLElement.prototype.requestFullscreen = undefined; HTMLElement.prototype.webkitRequestFullscreen = undefined"
            )
            page = context.new_page()
            page.goto(f"{base}/{game}/" if embedded else f"{base}/assets/games/{game}/index.html")
            if embedded:
                expect(page.locator(".rotate-to-play")).to_be_visible()
                element = page.locator("iframe.example-preview")
                frame = element.element_handle().content_frame()
            else:
                frame = page.main_frame
            frame.wait_for_function("window.__RunePixel3D?.app.state")
            if not embedded:
                expect(page.locator(".rotate-to-play")).to_be_visible()
            expect(frame.locator(".toolbar [data-pixel-fullscreen]")).to_be_visible()
            if game != "dog-walker":
                expect(frame.locator(".toolbar-settings")).not_to_have_attribute("open", "")
                frame.locator(".toolbar-settings summary").click()
                expect(frame.locator(".toolbar-settings")).to_have_attribute("open", "")
                frame.locator(".toolbar-settings summary").click()
            if embedded:
                page.locator(".rotate-to-play").scroll_into_view_if_needed()
            else:
                frame.locator(".game-surface").scroll_into_view_if_needed()
            page.set_viewport_size({"width": 844, "height": 390})
            frame.wait_for_function('document.querySelector(".rune-pixel3d-expanded")')
            if embedded:
                expect(element).to_have_class("example-preview iframe-fullscreen")
            title = frame.locator({"neon-circuit": ".mobile-title-menu", "marble-run": ".title-actions", "dog-walker": ".launch:visible"}[game])
            title.get_by_role("button", name="Exit fullscreen").tap()
            frame.wait_for_function('!document.querySelector(".rune-pixel3d-expanded")')
            if game != "dog-walker":
                expect(frame.locator(".toolbar-settings summary")).to_be_visible()
                frame.locator(".toolbar-settings summary").click()
                expect(frame.locator(".toolbar-settings")).to_have_attribute("open", "")
            page.wait_for_timeout(200)
            assert not frame.locator(".rune-pixel3d-expanded").count()
            page.set_viewport_size({"width": 390, "height": 844})
            if embedded:
                page.locator(".rotate-to-play").scroll_into_view_if_needed()
            else:
                frame.locator(".game-surface").scroll_into_view_if_needed()
            page.set_viewport_size({"width": 844, "height": 390})
            frame.wait_for_function('document.querySelector(".rune-pixel3d-expanded")')
            context.close()

        context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        page = context.new_page()
        page.goto(f"{base}/{game}/")
        frame = page.locator("iframe.example-preview").element_handle().content_frame()
        frame.wait_for_function("window.__RunePixel3D?.app.state")
        page.get_by_role("tab", name="Source").click()
        page.set_viewport_size({"width": 844, "height": 390})
        page.wait_for_timeout(250)
        assert not frame.locator(".rune-pixel3d-expanded").count()
        context.close()
        for embedded in [True, False]:
            context = browser.new_context(**pw.devices["iPhone 13"])
            context.add_init_script(
                "HTMLElement.prototype.requestFullscreen = undefined; HTMLElement.prototype.webkitRequestFullscreen = undefined"
            )
            page = context.new_page()
            page.goto(f"{base}/{game}/" if embedded else f"{base}/assets/games/{game}/index.html")
            frame = page.locator("iframe.example-preview").element_handle().content_frame() if embedded else page.main_frame
            frame.wait_for_function("window.__RunePixel3D?.app.state")
            if embedded:
                page.locator(".rotate-to-play").scroll_into_view_if_needed()
            else:
                page.locator(".game-surface").scroll_into_view_if_needed()
            page.set_viewport_size({"width": 844, "height": 390})
            prompt = page.locator(".game-rotation-scroll-prompt")
            expect(prompt).to_be_visible()
            assert not frame.locator(".rune-pixel3d-expanded").count()
            page.set_viewport_size({"width": 390, "height": 844})
            expect(prompt).not_to_be_attached()
            if embedded:
                page.locator(".rotate-to-play").scroll_into_view_if_needed()
            else:
                page.locator(".game-surface").scroll_into_view_if_needed()
            page.set_viewport_size({"width": 844, "height": 390})
            expect(prompt).to_be_visible()
            cdp = context.new_cdp_session(page)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": 400, "y": 300}]})
            for y in [270, 230, 190, 150, 110]:
                cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": 400, "y": y}]})
                page.wait_for_timeout(40)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
            expect(prompt).not_to_be_attached()
            frame.wait_for_function('document.querySelector(".rune-pixel3d-expanded")')
            title = frame.locator({"neon-circuit": ".mobile-title-menu", "marble-run": ".title-actions", "dog-walker": ".launch:visible"}[game])
            title.get_by_role("button", name="Exit fullscreen").tap()
            frame.wait_for_function('!document.querySelector(".rune-pixel3d-expanded")')
            page.set_viewport_size({"width": 390, "height": 844})
            if embedded:
                page.locator(".rotate-to-play").scroll_into_view_if_needed()
            else:
                page.locator(".game-surface").scroll_into_view_if_needed()
            page.set_viewport_size({"width": 844, "height": 390})
            expect(prompt).to_be_visible()
            prompt.get_by_role("button", name="Play now").tap()
            frame.wait_for_function('document.querySelector(".rune-pixel3d-expanded")')
            context.close()
    browser.close()
print("Visible games expand on rotation, retain manual exit and ignore hidden previews")
