import { afterEach, expect, it, vi } from 'vitest';
import { randomInt, shuffled } from '../src/random';
import { GameSave, restore } from '../src/pixel/persistence';
import { withContext } from '../src/context';
import { evaluateExpression } from '../src/expression';

afterEach(() => vi.unstubAllGlobals());
it('reproduces seeded random cities and shuffles without changing the source list', () => {
  const a=Array.from({length:100},(_,i)=>randomInt(-5,5,42+i));
  expect(a).toEqual(Array.from({length:100},(_,i)=>randomInt(-5,5,42+i)));
  expect(new Set(a).size).toBe(11);
  expect(a.every(n=>n>=-5 && n<=5)).toBe(true);
  const values=[1,2,3,4,5];
  expect(shuffled(values,100)).toEqual(shuffled(values,100));
  expect(shuffled(values,100).sort()).toEqual(values);
  expect(values).toEqual([1,2,3,4,5]);
  expect(()=>randomInt(2,1,4)).toThrow();
});
it('restores declared save fields and tolerates missing, corrupt and incompatible saves', () => {
  const values=new Map<string,string>();
  vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  const config={key:'save-test',state:'profile'}, defaults={coins:0,owned:['kaiju'],skin:'kaiju'};
  const save=new GameSave(config);
  save.flush({coins:200,owned:['kaiju','ember'],skin:'ember'});
  expect(save.status).toBe('saved');
  expect(new GameSave(config).load(defaults)).toEqual({coins:200,owned:['kaiju','ember'],skin:'ember'});
  expect(restore(defaults,{coins:'bad',owned:[1],skin:null,unknown:true})).toEqual(defaults);
  values.set('rune-pixel-save-test','{broken');
  const recovered=new GameSave(config);
  expect(recovered.load(defaults)).toEqual(defaults);
  expect(recovered.status).toBe('recovered');
  values.set('rune-pixel-save-test',JSON.stringify({version:2,data:{coins:99}}));
  expect(new GameSave(config).load(defaults)).toEqual(defaults);
});
it('shows session-only persistence when storage is blocked', () => {
  vi.stubGlobal('window',{get localStorage(){throw new Error('blocked');}});
  const save=new GameSave({key:'session-test',state:'profile'});
  save.flush({coins:40});
  expect(save.status).toBe('session');
  expect(new GameSave(save.config).load({coins:0})).toEqual({coins:40});
});
it('operator parsing caches never retain evaluated values across state changes', () => {
  const scope={x:1};
  withContext({helperDefinitions:{}} as any,()=>{
    expect(evaluateExpression('x + 1',scope)).toBe(2);
    scope.x=9;
    expect(evaluateExpression('x + 1',scope)).toBe(10);
  });
});
