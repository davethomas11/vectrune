import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLocals, runBuiltin } from './testUtils';
import { ctx } from '../../src/context';
import { executeSteps } from '../../src/statement';
import { parseFetchAssignment, runFetch, runFetchJson, redactUrl, FetchError } from '../../src/builtins/fetch';

const limits = { timeoutMs: 200, maxBodyBytes: 1024 };

function stubFetch(impl: (url: string, init: any) => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init });

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

afterEach(() => vi.unstubAllGlobals());

describe('fetch runtime', () => {
  it('returns status, ok, url, content_type and body', async () => {
    const mock = stubFetch(async () => json({ a: 1 }));
    const result = await runFetch('https://example.com/data?key=secret', limits);
    expect(result).toMatchObject({ status: 200, ok: true, content_type: 'application/json', body: '{"a":1}' });
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'follow' });
  });

  it('returns non-2xx responses from fetch without failing', async () => {
    stubFetch(async () => new Response('nope', { status: 404 }));
    expect(await runFetch('https://example.com/x', limits)).toMatchObject({ status: 404, ok: false, body: 'nope' });
  });

  it('fetch-json parses JSON and rejects non-2xx and non-JSON', async () => {
    stubFetch(async () => json({ t: 12.5 }));
    expect(await runFetchJson('https://example.com/x', limits)).toEqual({ t: 12.5 });

    stubFetch(async () => new Response('x', { status: 500 }));
    await expect(runFetchJson('https://example.com/x?token=abc', limits)).rejects.toMatchObject({
      status: 500,
      message: 'fetch-json: https://example.com/x returned HTTP 500',
    });

    stubFetch(async () => new Response('<html>'));
    await expect(runFetchJson('https://example.com/x', limits)).rejects.toThrow('valid JSON');
  });

  it('rejects non-http schemes and invalid URLs', async () => {
    await expect(runFetch('file:///etc/passwd', limits)).rejects.toThrow('unsupported URL scheme');
    await expect(runFetch('javascript:alert(1)', limits)).rejects.toThrow('unsupported URL scheme');
    await expect(runFetch(42 as any, limits)).rejects.toThrow('non-empty string');
  });

  it('enforces the response size limit while streaming', async () => {
    stubFetch(async () => new Response('x'.repeat(2048)));
    await expect(runFetch('https://example.com/big', limits)).rejects.toThrow('exceeded 1024 bytes');
  });

  it('rejects a declared Content-Length over the limit', async () => {
    stubFetch(async () => new Response('x', { headers: { 'content-length': '999999' } }));
    await expect(runFetch('https://example.com/big', limits)).rejects.toThrow('exceeded 1024 bytes');
  });

  it('times out', async () => {
    stubFetch((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    await expect(runFetch('https://example.com/slow', limits)).rejects.toThrow('timed out');
  });

  it('reports network and CORS failures without leaking the query string', async () => {
    stubFetch(async () => { throw new TypeError('Failed to fetch'); });
    const error = await runFetch('https://example.com/a?key=secret', limits).catch((e) => e);
    expect(error).toBeInstanceOf(FetchError);
    expect(error.status).toBe(0);
    expect(error.message).toContain('blocked by CORS');
    expect(error.message).not.toContain('secret');
  });

  it('redacts credentials, query and fragment', () => {
    expect(redactUrl(new URL('https://u:p@example.com/a?k=v#h'))).toBe('https://example.com/a');
  });
});

describe('fetch builtins', () => {
  it('fetch-json delivers parsed data to the then action and re-renders', async () => {
    stubFetch(async () => json({ t: 1 }));
    const app = ctx().app as any;
    app.invokeAction = vi.fn();
    app.render = vi.fn();
    const locals = createLocals();
    locals.url = 'https://example.com/w';

    expect(runBuiltin('fetch-json url then show_weather', locals)).toBe(true);
    await settle();
    expect(app.invokeAction).toHaveBeenCalledWith('show_weather', [{ t: 1 }]);
    expect(app.render).toHaveBeenCalled();
  });

  it('fetch accepts a quoted literal URL and delivers the response object', async () => {
    stubFetch(async () => new Response('hi'));
    const app = ctx().app as any;
    app.invokeAction = vi.fn();
    app.render = vi.fn();

    runBuiltin('fetch "https://example.com/t" then got_text', createLocals());
    await settle();
    expect(app.invokeAction.mock.calls[0][0]).toBe('got_text');
    expect(app.invokeAction.mock.calls[0][1][0]).toMatchObject({ status: 200, ok: true, body: 'hi' });
  });

  it('calls the catch action on failure, or warns without one', async () => {
    stubFetch(async () => new Response('x', { status: 503 }));
    const app = ctx().app as any;
    app.invokeAction = vi.fn();
    app.render = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    runBuiltin('fetch-json "https://example.com/w" then ok catch failed', createLocals());
    await settle();
    expect(app.invokeAction).toHaveBeenCalledWith('failed', [expect.objectContaining({ status: 503 })]);

    app.invokeAction.mockClear();
    runBuiltin('fetch-json "https://example.com/w" then ok', createLocals());
    await settle();
    expect(app.invokeAction).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not match without a then action', () => {
    expect(runBuiltin('fetch "https://example.com"', createLocals())).toBe(false);
  });
});

describe('fetch assignment form', () => {
  const steps = (...lines: string[]) => lines.map((Statement) => ({ Statement }));
  const mockApp = () => {
    const app = ctx().app as any;
    app.invokeAction = vi.fn();
    app.render = vi.fn();
    app.state = {};
    return app;
  };

  it('parses assignment forms and ignores the callback form', () => {
    expect(parseFetchAssignment('w = fetch-json url')).toEqual({ target: 'w', kind: 'fetch-json', urlExpr: 'url', onError: undefined });
    expect(parseFetchAssignment('state.r = fetch "https://e.com/?a=b" catch oops')).toEqual({
      target: 'state.r', kind: 'fetch', urlExpr: '"https://e.com/?a=b"', onError: 'oops',
    });
    expect(parseFetchAssignment('fetch-json url then show')).toBeNull();
    expect(parseFetchAssignment('x = 1')).toBeNull();
  });

  it('suspends the action, assigns the result and resumes the remaining steps', async () => {
    stubFetch(async () => json({ current: { temperature_2m: 8.4 } }));
    const app = mockApp();
    const locals: Record<string, unknown> = { url: 'https://example.com/w', before: 0 };

    const finished = executeSteps(
      steps('before = 1', 'weather = fetch-json url', 'temp = weather.current.temperature_2m', 'after = temp + 1'),
      locals,
    );
    expect(finished).toBe(false);
    expect(locals.before).toBe(1);
    expect(app.state.temp).toBeUndefined();

    await settle();
    // Names that are not locals are written to page state, as in any other action step.
    expect(app.state.temp).toBe(8.4);
    expect(app.state.after).toBe(9.4);
    expect(app.render).toHaveBeenCalled();
  });

  it('fetch + parse-json matches fetch-json', async () => {
    stubFetch(async () => json({ a: 1 }));
    const app = mockApp();
    const locals: Record<string, unknown> = { url: 'https://example.com/w' };
    executeSteps(steps('response = fetch url', 'data = parse-json response.body'), locals);
    await settle();
    expect(app.state.data).toEqual({ a: 1 });
  });

  it('chains sequential fetches', async () => {
    stubFetch(async (u) => json({ u }));
    const app = mockApp();
    const locals: Record<string, unknown> = {};
    executeSteps(steps('a = fetch-json "https://example.com/1"', 'b = fetch-json "https://example.com/2"'), locals);
    await settle();
    await settle();
    expect(app.state.b.u).toBe('https://example.com/2');
  });

  it('skips remaining steps and calls the catch action on failure', async () => {
    stubFetch(async () => new Response('x', { status: 503 }));
    const app = mockApp();
    const locals: Record<string, unknown> = { reached: false };
    executeSteps(steps('w = fetch-json "https://example.com/w" catch failed', 'reached = true'), locals);
    await settle();
    expect(locals.reached).toBe(false);
    expect(app.invokeAction).toHaveBeenCalledWith('failed', [expect.objectContaining({ status: 503 })]);
  });

  it('rejects the assignment form inside nested blocks', () => {
    const locals: Record<string, unknown> = { on: true };
    const nested = [{ Conditional: { condition: 'on', steps: steps('w = fetch-json "https://example.com/w"') } }];
    expect(() => executeSteps(nested as any, locals)).toThrow('top-level action step');
  });

  it('parse-json throws on invalid input', () => {
    expect(() => runBuiltin('parse-json bad', Object.assign(createLocals(), { bad: '{' }))).toThrow('invalid JSON');
  });
});
