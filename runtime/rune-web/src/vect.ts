// Headless Vect execution uses the same typed expressions as Rune-Web.
import { parseCoreExpression, evaluateCoreExpression, assignCoreTarget, coreFunctions, type Expr } from './core_expression';
type Stmt = Record<string, any>;
type Scope = Record<string, any>;
interface Host { print: (text: string) => void; read: () => string; write: (path: string, text: string) => void; request?: (config: string, source: string, packet: string) => string }
const text = (v: any): string => v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
export function run(program: { statements: Stmt[] }, host: Host, scriptDir = '.'): void {
  const globals: Scope = { script_dir: scriptDir };
  const actions: Record<string, any> = Object.create(null);
  const cache = new Map<string, Expr>();
  const statements = new Map<string, { target?: string; value: Expr }>();
  let depth = 0, budget = 100_000_000;
  const functions = { ...coreFunctions };
  const ast = (s: string): Expr => {
    let ast = cache.get(s);
    if (!ast) { ast = parseCoreExpression(s); cache.set(s, ast); }
    return ast;
  };
  const expr = (s: string, scope: Scope): any => evaluateCoreExpression(ast(s), scope, functions);
  const interpolate = (s: string, scope: Scope) => s.replace(/\{([^{}]+)\}/g, (match, key) => {
    try { const value = expr(key, scope); return value === undefined ? match : text(value); } catch { return match; }
  });
  const assign = (target: string, value: any, scope: Scope) => {
    assignCoreTarget(ast(target), value, scope, functions);
  };
  function block(stmts: Stmt[], scope: Scope): any {
    for (const stmt of stmts) {
      if (--budget <= 0) throw new Error('Vect execution budget exceeded');
      const [kind, s] = Object.entries(stmt)[0];
      try {
        switch (kind) {
          case 'Action': actions[s.name] = s; break;
          case 'Print': host.print(interpolate(s.text, scope)); break;
          case 'ReadInput': assign(s.var_name, host.read(), scope); break;
          case 'Set': { // Preserve legacy set literals and interpolation.
            const value = interpolate(s.value, scope);
            let decoded: any = value;
            if (/^-?\d+(\.\d+)?$/.test(value)) decoded = Number(value);
            else if (['true', 'false'].includes(value)) decoded = value === 'true';
            assign(s.var_name, decoded, scope); break;
          }
          case 'Expression': {
            let compiled = statements.get(s.source);
            if (!compiled) {
              const source = s.source.replace(/^(?:local|let)\s+/, '');
              const m = source.match(/^([\w$]+(?:\.[\w$]+|\[\][\w$]+|\[[^\n]+\])*)\s*([+*/%-]?=)(?!=)\s*([\s\S]+)$/);
              compiled = m
                ? { target: m[1], value: ast(m[2] === '=' ? m[3] : `${m[1]} ${m[2][0]} (${m[3]})`) }
                : { value: ast(s.source) };
              statements.set(s.source, compiled);
            }
            const value = evaluateCoreExpression(compiled.value, scope, functions);
            if (compiled.target) assign(compiled.target, value, scope);
            break;
          }
          case 'IfChain': {
            const branch = s.branches.find((b: any) => expr(b.condition, scope));
            const flow = block(branch ? branch.body : s.else_body, scope); if (flow) return flow; break;
          }
          case 'For': {
            const collection = expr(s.collection, scope);
            if (!Array.isArray(collection) && typeof collection !== 'string') throw new Error('for requires a collection');
            for (let i = 0; i < collection.length; i++) {
              scope[s.item_name] = collection[i]; if (s.index_name) scope[s.index_name] = i;
              if (--budget <= 0) throw new Error('Vect execution budget exceeded');
              const flow = block(s.body, scope);
              if (flow?.type === 'break') break;
              if (flow && flow.type !== 'continue') return flow;
            }
            break;
          }
          case 'While': {
            while (expr(s.condition, scope)) {
              if (--budget <= 0) throw new Error('Vect execution budget exceeded');
              const flow = block(s.body, scope);
              if (flow?.type === 'break') break;
              if (flow && flow.type !== 'continue') return flow;
            }
            break;
          }
          case 'Return': return { type: 'return', value: s.value ? expr(s.value, scope) : undefined };
          case 'Break': return { type: 'break' };
          case 'Continue': return { type: 'continue' };
          case 'Stop': if (s.message) host.print(interpolate(s.message, scope)); return { type: 'stop' };
          case 'Builtin': {
            const args = s.args.map((arg: string) => Object.prototype.hasOwnProperty.call(scope, arg) ? scope[arg] : interpolate(arg, scope));
            let result: any;
            if (s.name === 'log') { result = args.join(' '); host.print(result); }
            else if (s.name === 'parse-json') result = JSON.parse(scope[s.args[0] || 'body']);
            else if (s.name === 'is-set') result = Object.prototype.hasOwnProperty.call(scope, s.args[0]);
            else if (s.name === 'delete') { delete scope[s.args[0]]; break; }
            else if (s.name === 'to-number') result = Number(args[0]);
            else if (s.name === 'to-string') result = text(args[0]);
            else if (s.name === 'to-bool') result = args[0] === true || args[0] === 1 || args[0] === '1' || String(args[0]).toLowerCase() === 'true';
            else throw new Error(`Unsupported Vect builtin: ${s.name}`);
            if (s.assign_to) scope[s.assign_to] = result;
            else if (s.name === 'parse-json') scope[s.args[0] || 'body'] = result;
            else scope.___result___ = result;
            break;
          }
          default: throw new Error(`Unsupported Vect statement: ${kind}`);
        }
      } catch (e) { throw new Error(`Vect line ${s.line_no}: ${(e as Error).message}`); }
    }
  }
  // Register actions before executing, so declarations can follow their callers.
  for (const stmt of program.statements) if (stmt.Action) actions[stmt.Action.name] = stmt.Action;
  for (const name of Object.keys(actions)) functions[name] = (...args: any[]) => {
    if (++depth > 128) { depth--; throw new Error('Vect action recursion exceeds 128 calls'); }
    const action = actions[name], locals = Object.create(globals);
    action.params.forEach((key: string, i: number) => { locals[key] = args[i]; });
    try {
      const flow = block(action.body, locals);
      if (flow && flow.type !== 'return') throw new Error(`${flow.type} cannot escape an action`);
      return flow?.value;
    } finally { depth--; }
  };
  functions['file.write'] = (path, contents) => host.write(String(path), text(contents));
  functions['db.request'] = (config, source, packet) => {
    if (!host.request) throw new Error('This Vect host does not provide storage access');
    return JSON.parse(host.request(String(config), String(source), JSON.stringify(packet)));
  };
  const flow = block(program.statements, globals);
  if (flow && flow.type !== 'stop') throw new Error(`${flow.type} outside action or loop`);
}
