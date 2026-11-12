// Teaching-site navigation: keep focus, anchors, history and lazy routes in sync.
(() => {
  function setup() {
    const root = document.getElementById('app');
    if (!root) return;
    let pending = null;
    let queued = false;
    let focusMenu = null;
    const base = (document.querySelector('meta[name="rune-base-path"]')?.content || '').replace(/\/$/, '');
    history.scrollRestoration = 'manual';

    function savePosition() {
      if (!pending) history.replaceState({ ...history.state, sitePosition: [scrollX, scrollY] }, '', location.href);
    }
    function finish() {
      queued = false;
      const menu = root.querySelector('.navigation-toggle');
      if (focusMenu && menu && menu.getAttribute('aria-expanded') === focusMenu) {
        menu.focus({ preventScroll: true });
        focusMenu = null;
        if (menu.getAttribute('aria-expanded') === 'true') {
          const nav = root.querySelector('.sidebar');
          const active = nav?.querySelector('[aria-current="page"]');
          if (active) nav.scrollTop += active.getBoundingClientRect().top - nav.getBoundingClientRect().top - 12;
        }
      }
      const main = root.querySelector('main[data-route]');
      const recovery = main?.querySelector('.not-found a');
      if (recovery) {
        const locale = location.pathname.slice(base.length).split('/')[1];
        recovery.href = base + (locale === 'fr' || locale === 'es' ? `/${locale}/` : '/');
      }
      if (!pending || !main || main.dataset.route !== pending.route || main.querySelector('.rune-lazy-placeholder')) return;
      const navigation = pending;
      pending = null;
      let target = main.querySelector('h1') || main;
      if (navigation.anchor) {
        try { target = document.getElementById(decodeURIComponent(navigation.anchor.slice(1))) || target; } catch (_) { /* Use page title. */ }
        history.replaceState(history.state, '', location.pathname + location.search + navigation.anchor);
      }
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
      const toggle = event.target.closest('.navigation-toggle');
      if (toggle) { focusMenu = toggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'; schedule(); return; }
      const link = event.target.closest('a[data-on-click]');
      if (!link || link.target === '_blank') return;
      const action = link.getAttribute('data-on-click');
      const route = action.match(/^navigate\('([^']+)'\)/)?.[1] || (action.startsWith('openExample(') ? 'examples' : null);
      if (!route) return;
      savePosition();
      const anchor = new URL(link.href).hash;
      // Perform action anchors after the destination has actually rendered.
      if (anchor) event.preventDefault();
      if (anchor && window.runeWebApp?.state.activePage === route && location.hash !== anchor) {
        history.pushState(history.state, '', location.pathname + location.search + anchor);
      }
      pending = { route, anchor: anchor === '#app' ? '' : anchor };
      schedule();
    }, true);
    document.addEventListener('keydown', event => {
      const language = root.querySelector('.language-control[open]');
      if (event.key === 'Escape' && language) {
        language.open = false;
        language.querySelector('summary').focus();
        return;
      }
      if (event.key === 'Escape' && window.runeWebApp?.state.navigationOpen) {
        window.runeWebApp.state.navigationOpen = false;
        focusMenu = 'false';
        schedule();
      }
    });
    window.addEventListener('popstate', event => {
      // A new native fragment link has no saved position. Honor its anchor;
      // actual Back/Forward entries can restore their recorded position.
      pending = { route: window.runeWebApp?.state.activePage || 'home', position: event.state?.sitePosition || (location.hash ? null : [0, 0]), anchor: location.hash };
      schedule();
    });
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
