// Engine-owned data supplies its own mutation tracking. Preserve its identity
// when it crosses the general UI runtime's reactive boundary.
const ownedValues=new WeakSet<object>();
const reactiveTargets=new WeakMap<object,object>();
export function ownValue<T extends object>(value:T):T {ownedValues.add(value);return value;}
export function isOwnedValue(value:object):boolean {return ownedValues.has(value);}
export function registerReactive(proxy:object,target:object):void {reactiveTargets.set(proxy,target);}
export function rawValue<T>(value:T):T {
  if(value&&typeof value==='object')return (reactiveTargets.get(value)??value) as T;
  return value;
}
