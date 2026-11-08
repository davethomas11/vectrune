import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readNavigatorUrl, updateNavigatorUrl, setupNavigator, updateSeoMetadata } from '../src/navigator';
import { initContext } from '../src/context';
import type { NavigatorConfig, RuneApp, SeoConfig } from '../src/types';

describe('Rune-Web Navigator', () => {
  let mockWindow: any;

  beforeEach(() => {
    mockWindow = {
      location: new URL('https://vectrune.com/'),
      history: {
        pushState: vi.fn(),
        replaceState: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('window', mockWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads route from query parameter (?page=documents)', () => {
    mockWindow.location = new URL('https://vectrune.com/?page=documents');
    const config: NavigatorConfig = { bind: 'activePage', mode: 'auto', param: 'page' };
    const route = readNavigatorUrl(config);
    expect(route).toBe('documents');
  });

  it('reads route from query parameter fallback (?p=games)', () => {
    mockWindow.location = new URL('https://vectrune.com/?p=games');
    const config: NavigatorConfig = { bind: 'activePage', mode: 'auto', param: 'page' };
    const route = readNavigatorUrl(config);
    expect(route).toBe('games');
  });

  it('reads route from hash (#/vectraiders)', () => {
    mockWindow.location = new URL('https://vectrune.com/#/vectraiders');
    const config: NavigatorConfig = { bind: 'activePage', mode: 'auto', param: 'page' };
    const route = readNavigatorUrl(config);
    expect(route).toBe('vectraiders');
  });

  it('ignores #app and in-page section anchors (#quickstart) in auto mode', () => {
    mockWindow.location = new URL('https://vectrune.com/#app');
    const config: NavigatorConfig = { bind: 'activePage', mode: 'auto', param: 'page' };
    expect(readNavigatorUrl(config)).toBeNull();

    mockWindow.location = new URL('https://vectrune.com/#quickstart');
    expect(readNavigatorUrl(config)).toBeNull();
  });

  it('updates URL with pushState when route changes', () => {
    const config: NavigatorConfig = { bind: 'activePage', mode: 'auto', param: 'page' };
    const mockApp: RuneApp = {
      state: { activePage: 'home' },
      derived: {},
      computeDerived: vi.fn(),
      render: vi.fn(),
      invokeAction: vi.fn(),
    };

    initContext({
      pageTree: {},
      derivedDefinitions: {},
      helperDefinitions: {},
      actionDefinitions: {},
      i18nData: {},
      app: mockApp,
      isRendering: false,
      memorySubscriptions: {},
      navigator: config,
    });

    updateNavigatorUrl('documents');
    expect(mockWindow.history.pushState).toHaveBeenCalledWith(
      { activePage: 'documents' },
      '',
      '/?page=documents'
    );
  });

  it('initializes app.state from URL on setupNavigator', () => {
    mockWindow.location = new URL('https://vectrune.com/?page=rest_post');
    const config: NavigatorConfig = { bind: 'activePage', mode: 'auto', param: 'page' };
    const mockApp: RuneApp = {
      state: { activePage: 'home' },
      derived: {},
      computeDerived: vi.fn(),
      render: vi.fn(),
      invokeAction: vi.fn(),
    };

    initContext({
      pageTree: {},
      derivedDefinitions: {},
      helperDefinitions: {},
      actionDefinitions: {},
      i18nData: {},
      app: mockApp,
      isRendering: false,
      memorySubscriptions: {},
      navigator: config,
    });

    setupNavigator(config, mockApp);
    expect(mockApp.state.activePage).toBe('rest_post');
    expect(typeof (mockWindow as any).navigate).toBe('function');
  });

  it('updates document.title and meta tags dynamically based on SEO configuration', () => {
    const metaElements: Record<string, any> = {};
    const mockDocument: any = {
      title: 'Initial Title',
      querySelector: vi.fn((sel: string) => {
        return metaElements[sel] || null;
      }),
      createElement: vi.fn((_tag: string) => {
        const el: any = {
          attrs: {},
          setAttribute(k: string, v: string) {
            this.attrs[k] = v;
          },
        };
        return el;
      }),
      head: {
        appendChild: vi.fn((el: any) => {
          const key = el.attrs.name
            ? `meta[name="${el.attrs.name}"]`
            : `meta[property="${el.attrs.property}"]`;
          metaElements[key] = el;
        }),
      },
    };
    vi.stubGlobal('document', mockDocument);

    const seo: SeoConfig = {
      title: 'Learn Vectrune',
      description: 'Declarative language',
      image: '/assets/rune-logo.png',
      routes: {
        games: {
          title: 'VectRaiders Arcade',
          description: 'Defend the vector grid in pure retro arcade action',
        },
        vectworms: {
          title: 'VectWorms Arcade',
          description: 'Purge the mushroom grid',
        },
      },
    };

    const mockApp: RuneApp = {
      state: { activePage: 'home' },
      derived: {},
      computeDerived: vi.fn(),
      render: vi.fn(),
      invokeAction: vi.fn(),
    };

    initContext({
      pageTree: {},
      derivedDefinitions: {},
      helperDefinitions: {},
      actionDefinitions: {},
      i18nData: {},
      app: mockApp,
      isRendering: false,
      memorySubscriptions: {},
      seo,
    });

    updateSeoMetadata('games');
    expect(mockDocument.title).toBe('VectRaiders Arcade');
    expect(metaElements['meta[name="description"]']?.attrs.content).toBe(
      'Defend the vector grid in pure retro arcade action'
    );
    expect(metaElements['meta[property="og:title"]']?.attrs.content).toBe(
      'VectRaiders Arcade'
    );
    expect(metaElements['meta[name="twitter:description"]']?.attrs.content).toBe(
      'Defend the vector grid in pure retro arcade action'
    );

    updateSeoMetadata('vectworms');
    expect(mockDocument.title).toBe('VectWorms Arcade');
    expect(metaElements['meta[name="description"]']?.attrs.content).toBe(
      'Purge the mushroom grid'
    );
  });

  it('handles clean path navigation (mode = path)', () => {
    mockWindow.location = new URL('https://vectrune.com/games');
    const config: NavigatorConfig = { bind: 'activePage', mode: 'path' };
    const route = readNavigatorUrl(config);
    expect(route).toBe('games');

    const mockApp: RuneApp = {
      state: { activePage: 'games' },
      derived: {},
      computeDerived: vi.fn(),
      render: vi.fn(),
      invokeAction: vi.fn(),
    };

    initContext({
      pageTree: {},
      derivedDefinitions: {},
      helperDefinitions: {},
      actionDefinitions: {},
      i18nData: {},
      app: mockApp,
      isRendering: false,
      memorySubscriptions: {},
      navigator: config,
      loadedChunks: {},
      loadingChunks: {},
    });

    updateNavigatorUrl('vectworms');
    expect(mockWindow.history.pushState).toHaveBeenCalledWith(
      { activePage: 'vectworms' },
      '',
      '/vectworms'
    );

    updateNavigatorUrl('home');
    expect(mockWindow.history.pushState).toHaveBeenCalledWith(
      { activePage: 'home' },
      '',
      '/'
    );
  });
});
