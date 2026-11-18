import { afterEach, expect, it, vi } from 'vitest';
import { beginGameLoading, markGameReady } from '../src/game_ready';

afterEach(() => vi.unstubAllGlobals());

it('signals ready once per boot and never confuses loading with readiness', () => {
  const dataset: Record<string,string> = {}, postMessage = vi.fn();
  vi.stubGlobal('document', {documentElement:{dataset}});
  vi.stubGlobal('window', {parent:{postMessage}});
  beginGameLoading();
  expect(dataset.runeGameState).toBe('loading');
  expect(postMessage).not.toHaveBeenCalled();
  markGameReady();
  markGameReady();
  expect(dataset.runeGameState).toBe('ready');
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({type:'rune-game-ready'},'*');
  beginGameLoading();
  markGameReady();
  expect(postMessage).toHaveBeenCalledTimes(2);
});

it('supports standalone and native hosts without an embedding page', () => {
  const host = {parent:null as unknown}; host.parent = host;
  vi.stubGlobal('document', {documentElement:{dataset:{}}});
  vi.stubGlobal('window', host);
  expect(()=>{beginGameLoading();markGameReady();}).not.toThrow();
  vi.stubGlobal('document', undefined);
  vi.stubGlobal('window', undefined);
  expect(()=>{beginGameLoading();markGameReady();}).not.toThrow();
});
