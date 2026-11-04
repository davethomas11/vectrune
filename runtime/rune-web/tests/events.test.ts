import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindEvent } from '../src/events';
import { initContext } from '../src/context';

function setup(href = '#quickstart', target = '') {
  const frames: FrameRequestCallback[] = [];
  let handler: (event: Event) => void;
  let rendered = false;
  const scrollIntoView = vi.fn();
  const invokeAction = vi.fn(() => {
    requestAnimationFrame(() => { rendered = true; });
  });
  const getElementById = vi.fn(() => rendered ? { scrollIntoView } : null);
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    addEventListener: (_: string, listener: typeof handler) => { handler = listener; },
    getElementById,
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  initContext({
    pageTree: { Text: '' }, derivedDefinitions: {}, helperDefinitions: {},
    actionDefinitions: {}, i18nData: {}, isRendering: false, memorySubscriptions: {},
    app: { state: {}, derived: {}, computeDerived() {}, render() {}, invokeAction },
  });
  const attrs: Record<string, string> = {
    href, target, 'data-on-click': "navigate('home')",
  };
  const anchor = { tagName: 'A', getAttribute: (key: string) => attrs[key] ?? null };
  bindEvent('click');
  return {
    click: (overrides = {}) => handler!({
      target: { closest: () => anchor }, button: 0, defaultPrevented: false, ...overrides,
    } as unknown as Event),
    flush: () => { while (frames.length) frames.shift()!(0); },
    scrollIntoView, invokeAction, getElementById,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('action links', () => {
  it('scrolls to a fragment after the action renders its destination', () => {
    const test = setup();
    test.click();
    expect(test.invokeAction).toHaveBeenCalledWith('navigate', ['home'], {});
    expect(test.scrollIntoView).not.toHaveBeenCalled();
    test.flush();
    expect(test.getElementById).toHaveBeenCalledWith('quickstart');
    expect(test.scrollIntoView).toHaveBeenCalledOnce();
  });

  it('decodes fragment ids', () => {
    const test = setup('#getting%20started');
    test.click();test.flush();
    expect(test.getElementById).toHaveBeenCalledWith('getting started');
  });

  it('does not scroll for external links or cancelled navigation', () => {
    const external = setup('https://example.com/#quickstart');
    external.click();external.flush();
    expect(external.scrollIntoView).not.toHaveBeenCalled();
    const cancelled = setup();
    cancelled.click({ defaultPrevented: true });cancelled.flush();
    expect(cancelled.scrollIntoView).not.toHaveBeenCalled();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])(
    'leaves modified clicks to the browser: %o', (modifiers) => {
      const test = setup();test.click(modifiers);test.flush();
      expect(test.invokeAction).not.toHaveBeenCalled();
      expect(test.scrollIntoView).not.toHaveBeenCalled();
    },
  );

  it('leaves new-window links to the browser', () => {
    const test = setup('#quickstart', '_blank');test.click();test.flush();
    expect(test.invokeAction).not.toHaveBeenCalled();
  });
});
