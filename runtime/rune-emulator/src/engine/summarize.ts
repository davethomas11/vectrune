// Same report semantics as src/builtins/builtin/summarize.rs.
export const SUMMARIZE_USAGE = 'summarize: expected <records> by <group-path> [sum|avg|min|max|median|distinct|first|last <value-path>]';

interface Group {
  group: unknown;
  count: number;
  numericCount: number;
  total: number;
  min: number | null;
  max: number | null;
  numbers: number[];
  distinct: Set<unknown>;
  selected: unknown;
}

function validPath(path: string): boolean {
  return Boolean(path) && path.split('.').every(Boolean);
}

function field(row: unknown, path: string): unknown {
  let value = row;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)
        || !Object.prototype.hasOwnProperty.call(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) value = Number(value);
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('invalid number');
  return value;
}

export function summarize(records: unknown, groupPath: string, operation?: string, valuePath?: string): unknown[] {
  if (!validPath(groupPath) || (operation !== undefined
      && (!['sum', 'avg', 'min', 'max', 'median', 'distinct', 'first', 'last'].includes(operation) || !validPath(valuePath ?? '')))) {
    throw new Error(SUMMARIZE_USAGE);
  }
  if (!Array.isArray(records)) throw new Error('summarize: source must be a list of records');
  // Map keeps first-seen order, typed scalar keys, and safe keys such as __proto__.
  const groups = new Map<unknown, Group>();
  records.forEach((row, index) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`summarize: row ${index + 1} must be a record`);
    }
    const key = field(row, groupPath) ?? null;
    if ((key !== null && !['string', 'number', 'boolean'].includes(typeof key))
        || (typeof key === 'number' && !Number.isFinite(key))) {
      throw new Error(`summarize: row ${index + 1} group field '${groupPath}' must be a scalar`);
    }
    let group = groups.get(key);
    if (!group) {
      group = { group: key, count: 0, numericCount: 0, total: 0, min: null, max: null, numbers: [], distinct: new Set(), selected: null };
      groups.set(key, group);
    }
    group.count++;
    if (operation !== undefined) {
      const cell = field(row, valuePath!) ?? null;
      if (operation === 'first' || operation === 'last') {
        if (operation === 'last' || group.count === 1) {
          // Return independent JSON data, just like cloning a native Value.
          group.selected = JSON.parse(JSON.stringify(cell, (_key, value) => {
            if (typeof value === 'number' && !Number.isFinite(value)) {
              throw new Error(`summarize: row ${index + 1} field '${valuePath}' must contain only finite JSON numbers`);
            }
            return value;
          }));
        }
        return;
      }
      if (operation === 'distinct') {
        if (cell !== null) {
          if (!['string', 'number', 'boolean'].includes(typeof cell)
              || (typeof cell === 'number' && !Number.isFinite(cell))) {
            throw new Error(`summarize: row ${index + 1} field '${valuePath}' must be a scalar for distinct`);
          }
          group.distinct.add(cell);
        }
        return;
      }
      let number: number | null;
      try { number = numeric(cell); }
      catch (_) { throw new Error(`summarize: row ${index + 1} field '${valuePath}' must be a finite number or numeric string`); }
      if (number !== null) {
        group.numericCount++;
        if (operation === 'median') group.numbers.push(number);
        group.min = group.min === null ? number : Math.min(group.min, number);
        group.max = group.max === null ? number : Math.max(group.max, number);
        if (operation === 'sum' || operation === 'avg') {
          group.total += number;
          if (!Number.isFinite(group.total)) throw new Error(`summarize: ${operation} overflow for field '${valuePath}'`);
        }
      }
    }
  });
  return [...groups.values()].map(group => {
    const result: Record<string, unknown> = { group: group.group, count: group.count };
    if (operation !== undefined) {
      switch (operation) {
        case 'sum': result.sum = group.total; break;
        case 'avg': result.avg = group.numericCount ? group.total / group.numericCount : null; break;
        case 'min': result.min = group.min; break;
        case 'max': result.max = group.max; break;
        case 'distinct': result.distinct = group.distinct.size; break;
        case 'first': case 'last': result[operation] = group.selected; break;
        case 'median': {
          group.numbers.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
          const middle = Math.floor(group.numbers.length / 2);
          if (!group.numbers.length) result.median = null;
          else if (group.numbers.length % 2) result.median = group.numbers[middle];
          else {
            const lower = group.numbers[middle - 1], upper = group.numbers[middle];
            result.median = (lower < 0) === (upper < 0) ? lower + (upper - lower) / 2 : (lower + upper) / 2;
          }
          break;
        }
      }
    }
    return result;
  });
}
