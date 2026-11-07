// ============================================================================
// Rune-Web Navigator — Two-way URL and Reactive State Synchronization
//
// Taps into browser URL navigation state:
// - Parses URL query / hash on boot or refresh to initialize state
// - Pushes URL history entries when bound state changes
// - Listens to popstate / hashchange for browser Back / Forward buttons
// ============================================================================

import { ctx } from './context';
import { interpolate } from './interpolation';
import type { NavigatorConfig, RuneApp, Scope } from './types';

let isNavigatingFromUrl = false;
let lastKnownRoute: string | null = null;

/**
 * Read the current route from the browser's URL.
 * Checks query parameters (e.g. ?page=documents) and hash (e.g. #/documents or #documents).
 */
export function readNavigatorUrl(config: NavigatorConfig): string | null {
  if (typeof window === 'undefined' || !window.location) return null;

  const param = config.param || 'page';
  const mode = config.mode || 'auto';

  // 1. Query parameter check (preferred for query / auto modes)
  if (mode === 'query' || mode === 'auto') {
    try {
      const url = new URL(window.location.href);
      const val = url.searchParams.get(param) || url.searchParams.get('p') || url.searchParams.get(config.bind);
      if (val && val.trim()) {
        return val.trim();
      }
    } catch (_err) {
      // Ignore URL parsing errors
    }
  }

  // 2. Hash check (for hash mode, or fallback in auto mode)
  if (mode === 'hash' || mode === 'auto') {
    const rawHash = window.location.hash || '';
    if (rawHash) {
      let slug = '';
      if (rawHash.startsWith('#/')) {
        slug = rawHash.slice(2);
      } else if (rawHash.startsWith('#!/')) {
        slug = rawHash.slice(3);
      } else if (rawHash.startsWith('#!') || rawHash.startsWith('#?')) {
        slug = rawHash.slice(2);
      } else if (mode === 'hash' && rawHash.startsWith('#') && rawHash !== '#app' && rawHash !== '#') {
        // Only treat bare single hash as a route when explicitly in hash mode;
        // in auto mode, bare #anchor hashes (e.g. #quickstart, #tour) are in-page section anchors.
        slug = rawHash.slice(1);
      }
      slug = decodeURIComponent(slug.trim());
      if (slug && slug !== 'app') {
        return slug;
      }
    }
  }

  return null;
}

/**
 * Helper to update or create a `<meta>` element.
 */
function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Synchronize document title, meta description, OpenGraph, and Twitter tags
 * based on current route and @SEO configuration.
 */
export function updateSeoMetadata(route: string): void {
  if (typeof document === 'undefined') return;
  let context: ReturnType<typeof ctx>;
  try {
    context = ctx();
  } catch (_err) {
    return;
  }
  const seo = context.seo;
  if (!seo) return;

  const rawRoute = (route || '').trim();
  const cleanRoute = rawRoute.toLowerCase();
  const routeConfig =
    seo.routes?.[rawRoute] ||
    seo.routes?.[cleanRoute] ||
    seo.routes?.[cleanRoute.replace(/[-_]/g, '')];

  const rawTitle = routeConfig?.title || (cleanRoute && cleanRoute !== 'home' ? `${rawRoute.charAt(0).toUpperCase() + rawRoute.slice(1)} — ${seo.title || 'Vectrune'}` : seo.title);
  const rawDescription = routeConfig?.description || seo.description;
  const rawImage = routeConfig?.image || seo.image;

  const scope: Scope = { i18n: context.i18nData || {} };

  if (rawTitle) {
    const title = interpolate(rawTitle, scope);
    document.title = title;
    setMetaTag('property', 'og:title', title);
    setMetaTag('name', 'twitter:title', title);
  }

  if (rawDescription) {
    const description = interpolate(rawDescription, scope);
    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:description', description);
    setMetaTag('name', 'twitter:description', description);
  }

  if (rawImage) {
    const image = interpolate(rawImage, scope);
    setMetaTag('property', 'og:image', image);
    setMetaTag('name', 'twitter:image', image);
  }

  if (typeof window !== 'undefined' && window.location) {
    setMetaTag('property', 'og:url', window.location.href);
  }
}

/**
 * Update the browser URL to reflect the new state value.
 */
export function updateNavigatorUrl(route: string, replace = false): void {
  if (typeof window === 'undefined' || isNavigatingFromUrl) return;
  const context = ctx();
  const config = context.navigator;
  if (!config) {
    updateSeoMetadata(route);
    return;
  }

  const cleanRoute = String(route || '').trim();
  if (cleanRoute === lastKnownRoute) return;
  lastKnownRoute = cleanRoute;

  const mode = config.mode || 'auto';
  const param = config.param || 'page';

  if (mode === 'hash') {
    const targetHash = cleanRoute ? '#/' + encodeURIComponent(cleanRoute) : '';
    if (window.location.hash !== targetHash) {
      if (replace) {
        window.location.replace(targetHash || '#/');
      } else {
        window.location.hash = targetHash || '#/';
      }
    }
    updateSeoMetadata(cleanRoute);
    return;
  }

  // 'query' or 'auto' mode:
  try {
    const url = new URL(window.location.href);
    if (!cleanRoute || cleanRoute === 'home') {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, cleanRoute);
    }

    // Clean up temporary in-page anchor hash (e.g. #app, #quickstart) when navigating
    if (url.hash && !url.hash.startsWith('#/')) {
      url.hash = '';
    }

    const newUrl = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
    const stateObj = { [config.bind]: cleanRoute };

    if (replace) {
      window.history.replaceState(stateObj, '', newUrl);
    } else {
      window.history.pushState(stateObj, '', newUrl);
    }
  } catch (_err) {
    // History API fallback
  }

  updateSeoMetadata(cleanRoute);
}

/**
 * Handle state mutation trap from Proxy in scope.ts.
 */
export function handleNavigatorStateChange(prop: string, value: unknown): void {
  if (isNavigatingFromUrl) return;
  const context = ctx();
  const config = context.navigator;
  if (!config || prop !== config.bind) return;

  updateNavigatorUrl(String(value ?? ''));
}

/**
 * Initialize the navigator during application boot.
 */
export function setupNavigator(config: NavigatorConfig, app: RuneApp): void {
  if (typeof window === 'undefined') return;

  const boundVar = config.bind;
  if (!boundVar) return;

  // 1. Initial route read from URL (on page load or refresh)
  const initialUrlRoute = readNavigatorUrl(config);
  if (initialUrlRoute) {
    app.state[boundVar] = initialUrlRoute;
    lastKnownRoute = initialUrlRoute;
  } else {
    lastKnownRoute = String(app.state[boundVar] || 'home');
  }
  updateSeoMetadata(lastKnownRoute);

  // 2. Global helper `navigate(target)` fallback if not defined in @Logic
  (window as any).navigate = function (target: string) {
    if (typeof (app.state as any)[boundVar] !== 'undefined') {
      app.state[boundVar] = target;
      if (app.render) app.render();
      updateSeoMetadata(target);
    }
  };

  // 3. Listen to browser Back / Forward events (popstate & hashchange)
  window.addEventListener('popstate', (_event: PopStateEvent) => {
    const currentRoute = readNavigatorUrl(config) || 'home';
    if (currentRoute !== app.state[boundVar]) {
      isNavigatingFromUrl = true;
      try {
        lastKnownRoute = currentRoute;
        app.state[boundVar] = currentRoute;
        if (app.render) app.render();
        updateSeoMetadata(currentRoute);
      } finally {
        isNavigatingFromUrl = false;
      }
    }
  });

  window.addEventListener('hashchange', (_event: HashChangeEvent) => {
    const currentRoute = readNavigatorUrl(config);
    if (currentRoute && currentRoute !== app.state[boundVar]) {
      isNavigatingFromUrl = true;
      try {
        lastKnownRoute = currentRoute;
        app.state[boundVar] = currentRoute;
        if (app.render) app.render();
        updateSeoMetadata(currentRoute);
      } finally {
        isNavigatingFromUrl = false;
      }
    }
  });
}
