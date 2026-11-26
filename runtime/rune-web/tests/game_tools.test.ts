import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomInt, shuffled } from '../src/random';
import { GameSave, restore } from '../src/pixel/persistence';
import { withContext } from '../src/context';
import { evaluateExpression } from '../src/expression';
import { PixelEngine } from '../src/pixel/engine';
import { Pixel3DEngine } from '../src/pixel3d/engine';
import type { RuneWebConfig } from '../src/types';

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

describe('batched game saves', () => {
  it('batches tick serialization, skips clean revisions and immediately flushes dirty actions or replacements', () => {
    const save = new GameSave({key:'batch-test',state:'profile',interval_ticks:150,revision:'revision'});
    const state = {profile:{coins:0},revision:0};
    save.persist(state);
    const stringify = vi.spyOn(JSON, 'stringify');
    try {
      state.profile.coins = 5;
      state.revision++;
      for (let i=0;i<149;i++) save.persist(state, false);
      expect(stringify).not.toHaveBeenCalled();
      save.persist(state, false);
      expect(stringify).toHaveBeenCalledTimes(1);
      for (let i=0;i<300;i++) save.persist(state, false);
      expect(stringify).toHaveBeenCalledTimes(1);
      state.profile.coins = 6;
      state.revision++;
      save.persist(state);
      expect(stringify).toHaveBeenCalledTimes(2);
      save.persist(state);
      expect(stringify).toHaveBeenCalledTimes(2);
      state.profile = {coins:7};
      save.persist(state);
      expect(stringify).toHaveBeenCalledTimes(3);
      state.revision++;
      save.persist(state);
      expect(stringify).toHaveBeenCalledTimes(4);
    } finally { stringify.mockRestore(); }
  });

  it('preserves every-tick saving by default and supports interval batching without revision markers', () => {
    for (const interval of [undefined, 3]) {
      const save = new GameSave({key:`legacy-batch-${interval}`,state:'profile',interval_ticks:interval});
      const stringify = vi.spyOn(JSON, 'stringify');
      try {
        for (let i=0;i<6;i++) save.tick({coins:i});
        expect(stringify).toHaveBeenCalledTimes(interval ? 2 : 6);
      } finally { stringify.mockRestore(); }
    }
    for (const interval_ticks of [0,-1,1.5,3601,NaN]) {
      expect(() => new GameSave({key:'bad',state:'profile',interval_ticks})).toThrow('interval_ticks');
    }
    const save = new GameSave({key:'bad',state:'profile',revision:'revision'});
    for (const revision of [undefined,-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1]) {
      expect(() => save.flush({},revision)).toThrow('revision');
    }
    expect(() => save.persist({profile:{},revision:'bad'})).toThrow('revision');
  });

  for (const kind of ['pixel','pixel3d'] as const) {
    it(`${kind} batches tick saves but flushes purchases, pause and lifecycle requests immediately`, () => {
      const key = `engine-batch-${kind}`;
      const persistence = {key,state:'profile',interval_ticks:5,revision:'revision'};
      const options: RuneWebConfig = {
        stateJson:{profile:{coins:0},revision:0,camera:{x:1,y:1,angle:0},status:'playing'},
        pageTree:{Text:''},i18nData:{},derivedDefinitions:{},helperDefinitions:{},
        actionDefinitions:{
          tick:{params:[],steps:[{Statement:'profile.coins += 1'},{Statement:'revision += 1'}]},
          purchase:{params:[],steps:[{Statement:'profile.coins += 10'},{Statement:'revision += 1'}]},
        },
      };
      const game = kind === 'pixel'
        ? new PixelEngine({width:16,height:16,tickRate:30,background:0,sprites:{},animations:{},layers:[],rects:[],persistence},options)
        : new Pixel3DEngine({width:16,height:16,tickRate:30,camera:'camera',textures:{},sprites:{},
          map:{width:3,height:3,grid:Array(9).fill(0),floor:0,ceiling:0},persistence},options);
      const saved = () => new GameSave({key,state:'profile'}).load({coins:0});
      game.step();game.step();
      expect(saved()).toEqual({coins:0});
      game.paused = true;
      expect(saved()).toEqual({coins:2});
      game.paused = false;
      for (let i=0;i<5;i++) game.step();
      expect(saved()).toEqual({coins:7});
      game.invoke('purchase');
      expect(saved()).toEqual({coins:17});
      game.step();
      game.flushSave();
      expect(saved()).toEqual({coins:18});
    });
  }
});
