import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readNavigatorUrl, updateNavigatorUrl, setupNavigator } from '../src/navigator';
import { initContext } from '../src/context';
import type { NavigatorConfig, RuneApp } from '../src/types';

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
});
