"""Select links in the teaching header on desktop or mobile."""


def menu_link(page, selector, **filters):
    link = page.locator(f'#site-navigation {selector}', **filters)
    toggle = page.locator('.navigation-toggle')
    if toggle.is_visible() and toggle.get_attribute('aria-expanded') != 'true':
        toggle.click()
    category = link.locator('xpath=ancestor::details[1]')
    if category.get_attribute('open') is None:
        category.locator('summary').click()
    return link
