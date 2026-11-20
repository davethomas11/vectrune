// ============================================================================
// Rune-Web Navigator — Two-way URL and Reactive State Synchronization
//
// Taps into browser URL navigation state:
// - Parses URL query / hash on boot or refresh to initialize state
// - Pushes URL history entries when bound state changes
// - Listens to popstate / hashchange for browser Back / Forward buttons
// ============================================================================

import { ctx, withContext } from './context';
import { interpolate } from './interpolation';
import { hostingPrefix, hostedUrl } from './utils';
import type { NavigatorConfig, RuneApp, Scope } from './types';

let isNavigatingFromUrl = false;
let lastKnownRoute: string | null = null;
const pendingUrlUpdates = new WeakSet<RuneApp>();

function readFragment(): string {
  const fragment = window.location.hash.slice(1);
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function updateFragment(url: URL, config: NavigatorConfig, state: RuneApp['state']): void {
  if (config.fragment) {
    url.hash = encodeURIComponent(String(state[config.fragment] ?? ''));
  } else if (url.hash && !url.hash.startsWith('#/')) {
    url.hash = '';
  }
}

/**
 * Read the current route from the browser's URL.
 * Checks query parameters (e.g. ?page=documents) and hash (e.g. #/documents or #documents).
 */
export function readNavigatorUrl(config: NavigatorConfig): string | null {
  if (typeof window === 'undefined' || !window.location) return null;

  const param = config.param || 'page';
  const mode = config.mode || 'auto';

  // 1. Path check (for path mode, or auto mode when pathname is non-root)
  if (mode === 'path' || mode === 'auto') {
    try {
      const url = new URL(window.location.href);
      const prefix = hostingPrefix();
      const pathname = prefix && (url.pathname === prefix || url.pathname.startsWith(prefix + '/'))
        ? url.pathname.slice(prefix.length) : url.pathname;
      const cleanPath = pathname.replace(/^\/+|\/+$/g, '');
      const parts = cleanPath.split('/').filter(Boolean);
      // A locale root is the home page, not a route named after the locale.
      if (parts[0] === 'es' || parts[0] === 'fr') parts.shift();
      if (parts.length > 0) {
        const route = decodeURIComponent(parts.join('/'));
        if (route && route !== 'index.html') {
          return route;
        }
      }
    } catch (_err) {}
  }

  // 2. Query parameter check (preferred for query, fallback for auto / path)
  if (mode === 'query' || mode === 'auto' || mode === 'path') {
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
    const image = hostedUrl(interpolate(rawImage, scope));
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

  if (mode === 'path') {
    try {
      const url = new URL(window.location.href);
      const base = hostingPrefix();
      const pathname = url.pathname.slice(base.length);
      let prefix = base;
      if (pathname.startsWith('/es/') || pathname === '/es') prefix += '/es';
      if (pathname.startsWith('/fr/') || pathname === '/fr') prefix += '/fr';

      let newPath = '';
      if (!cleanRoute || cleanRoute === 'home') {
        newPath = prefix ? `${prefix}/` : '/';
      } else {
        newPath = prefix ? `${prefix}/${encodeURIComponent(cleanRoute)}` : `/${encodeURIComponent(cleanRoute)}`;
      }

      url.searchParams.delete(param);
      url.searchParams.delete('p');
      url.searchParams.delete(config.bind);

      updateFragment(url, config, context.app.state);

      const finalUrl = newPath + (url.search ? url.search : '') + (url.hash ? url.hash : '');
      const stateObj = { [config.bind]: cleanRoute };

      if (replace) {
        window.history.replaceState(stateObj, '', finalUrl);
      } else {
        window.history.pushState(stateObj, '', finalUrl);
      }
    } catch (_err) {
      // History API fallback
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

    updateFragment(url, config, context.app.state);

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
  if (!config) return;
  if (!config.fragment) {
    if (prop === config.bind) updateNavigatorUrl(String(value ?? ''));
    return;
  }

  // Coalesce route and fragment assignments in one action into one entry.
  const app = context.app;
  if (pendingUrlUpdates.has(app) || typeof window === 'undefined') return;
  pendingUrlUpdates.add(app);
  queueMicrotask(() => {
    pendingUrlUpdates.delete(app);
    const route = String(app.state[config.bind] ?? '').trim();
    if (route !== lastKnownRoute) {
      withContext(context, () => updateNavigatorUrl(route));
      return;
    }
    const url = new URL(window.location.href);
    const previousHash = url.hash;
    updateFragment(url, config, app.state);
    if (url.hash !== previousHash) {
      window.history.pushState({ [config.bind]: route }, '', url.pathname + url.search + url.hash);
    }
  });
}

/**
 * Initialize the navigator during application boot.
 */
export function setupNavigator(config: NavigatorConfig, app: RuneApp): void {
  if (typeof window === 'undefined') return;

  const boundVar = config.bind;
  if (!boundVar) return;

  const fragmentVar = config.fragment;
  // Read the initial URL without writing a browser history entry.
  const initialUrlRoute = readNavigatorUrl(config);
  isNavigatingFromUrl = true;
  try {
    if (initialUrlRoute) app.state[boundVar] = initialUrlRoute;
    if (fragmentVar) app.state[fragmentVar] = readFragment();
  } finally {
    isNavigatingFromUrl = false;
  }
  lastKnownRoute = String(app.state[boundVar] || 'home');
  updateSeoMetadata(lastKnownRoute);

  // 2. Global helper `navigate(target)` fallback if not defined in @Logic
  (window as any).navigate = function (target: string) {
    if (typeof (app.state as any)[boundVar] !== 'undefined') {
      app.state[boundVar] = target;
      if (app.render) app.render();
      updateSeoMetadata(target);
    }
  };

  function syncFromUrl(routeFallback: string | null): void {
    const currentRoute = readNavigatorUrl(config) || routeFallback;
    const routeChanged = currentRoute !== null && currentRoute !== app.state[boundVar];
    const fragment = fragmentVar ? readFragment() : '';
    if (!routeChanged && (!fragmentVar || fragment === app.state[fragmentVar])) return;
    isNavigatingFromUrl = true;
    try {
      if (routeChanged) {
        lastKnownRoute = currentRoute;
        app.state[boundVar] = currentRoute;
        updateSeoMetadata(currentRoute);
      }
      if (fragmentVar) app.state[fragmentVar] = fragment;
      // Fragment bindings update reactive state. Let the queued render run
      // once so a native anchor's focus is not lost to a second render.
      if (!fragmentVar && app.render) app.render();
    } finally {
      isNavigatingFromUrl = false;
    }
  }

  window.addEventListener('popstate', () => syncFromUrl('home'));
  window.addEventListener('hashchange', () => syncFromUrl(null));
}
