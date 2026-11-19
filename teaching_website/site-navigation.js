// Teaching-site navigation: keep focus, anchors, history and lazy routes in sync.
(() => {
  function setup() {
    const root = document.getElementById('app');
    if (!root) return;
    let pending = null;
    let queued = false;
    const narrow = matchMedia('(max-width: 900px)');
    const base = (document.querySelector('meta[name="rune-base-path"]')?.content || '').replace(/\/$/, '');
    history.scrollRestoration = 'manual';

    function setMobileMenu(open) {
      const header = root.querySelector('.site-header');
      const toggle = header?.querySelector('.navigation-toggle');
      if (!header || !toggle) return;
      header.dataset.mobileMenu = String(open);
      toggle.setAttribute('aria-expanded', String(open));
      if (!open) closeCategory();
    }

    function closeCategory() {
      const category = root.querySelector('#site-navigation .menu-category[open]');
      if (category) category.open = false;
      return category;
    }

    function closeMenu() {
      setMobileMenu(false);
    }

    // Rune-Web can replace the header when it renders a route. Delegate events
    // and look up the current elements when handling navigation.
    root.addEventListener('click', event => {
      const toggle = event.target.closest('.navigation-toggle');
      if (toggle) setMobileMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    function dismissOutsideMenu(event) {
      if (!event.target.closest('#site-navigation, .navigation-toggle')) closeMenu();
    }
    document.addEventListener('pointerdown', dismissOutsideMenu);
    document.addEventListener('focusin', dismissOutsideMenu);
    narrow.addEventListener('change', closeMenu);

    function savePosition() {
      if (!pending) history.replaceState({ ...history.state, sitePosition: [scrollX, scrollY] }, '', location.href);
    }
    function updateHomeSelection(main) {
      const home = main?.dataset.route === 'home';
      const menu = root.querySelector('#site-navigation');
      if (!menu) return;
      let sectionSelected = false;
      for (const link of menu.querySelectorAll('.nav-link[href*="#"]')) {
        if (home && link.hash === location.hash) {
          sectionSelected = true;
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      }
      menu.querySelector('[data-home-overview]')?.setAttribute('aria-current', home && !sectionSelected ? 'page' : 'false');
    }
    function finish() {
      queued = false;
      const main = root.querySelector('main[data-route]');
      const recovery = main?.querySelector('.not-found a');
      if (recovery) {
        const locale = location.pathname.slice(base.length).split('/')[1];
        recovery.href = base + (locale === 'fr' || locale === 'es' ? `/${locale}/` : '/');
      }
      if (!pending || !main || main.dataset.route !== pending.route || main.querySelector('.rune-lazy-placeholder')) {
        updateHomeSelection(main);
        return;
      }
      const navigation = pending;
      pending = null;
      let target = main.querySelector('h1') || main;
      if (navigation.anchor) {
        try { target = document.getElementById(decodeURIComponent(navigation.anchor.slice(1))) || target; } catch (_) { /* Use page title. */ }
        history.replaceState(history.state, '', location.pathname + location.search + navigation.anchor);
      }
      updateHomeSelection(main);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (navigation.position) {
        window.scrollTo({ left: navigation.position[0], top: navigation.position[1], behavior: 'instant' });
      } else {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      savePosition();
    }
    function schedule() {
      if (!queued) { queued = true; requestAnimationFrame(finish); }
    }
    document.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const link = event.target.closest('a');
      if (!link || link.target === '_blank') return;
      if (link.closest('#site-navigation')) closeMenu();
      const action = link.getAttribute('data-on-click');
      if (!action) return;
      const route = action.match(/^navigate\('([^']+)'\)/)?.[1] || (action.startsWith('openExample(') ? 'examples' : null);
      if (!route) return;
      savePosition();
      const anchor = new URL(link.href).hash;
      if (route === 'home' && root.querySelector('main[data-route="home"]')) {
        // The homepage is already rendered. Keep the fragment navigation
        // independent of the Rune-Web route action.
        event.preventDefault();
        event.stopPropagation();
        if (location.hash !== anchor) {
          history.pushState({ ...history.state, sitePosition: null }, '', location.pathname + location.search + anchor);
        }
      } else if (anchor) {
        // Wait for the destination route to render before jumping to its section.
        event.preventDefault();
      }
      pending = { route, anchor: anchor === '#app' ? '' : anchor };
      schedule();
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const language = root.querySelector('.language-control[open]');
      if (language) {
        language.open = false;
        language.querySelector('summary').focus();
        return;
      }
      const category = closeCategory();
      if (category) {
        category.querySelector('summary').focus({ preventScroll: true });
      } else {
        const toggle = root.querySelector('.navigation-toggle[aria-expanded="true"]');
        if (toggle) {
          closeMenu();
          toggle.focus({ preventScroll: true });
        }
      }
    });
    window.addEventListener('popstate', event => {
      closeMenu();
      // A new native fragment link has no saved position. Honor its anchor;
      // actual Back/Forward entries can restore their recorded position.
      pending = { route: window.runeWebApp?.state.activePage || 'home', position: event.state?.sitePosition || (location.hash ? null : [0, 0]), anchor: location.hash };
      schedule();
    });
    window.addEventListener('hashchange', schedule);
    let saving = false;
    window.addEventListener('scroll', () => {
      if (!saving) requestAnimationFrame(() => { saving = false; savePosition(); });
      saving = true;
    }, { passive: true });
    window.addEventListener('pagehide', savePosition);
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    const route = window.runeWebApp?.state.activePage || 'home';
    if (history.state?.sitePosition) pending = { route, position: history.state.sitePosition, anchor: location.hash };
    else if (location.hash) pending = { route, anchor: location.hash };
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
