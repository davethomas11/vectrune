import {makeReactive} from '../src/scope';
import {describe,it,expect,vi} from 'vitest';
import {nearby,withEntityQueries,entityMoved,entityGroup,nearbyForRender} from '../src/pixel3d/entities';
import {assignPath,executeStatement} from '../src/statement';
import {evaluateExpression} from '../src/expression';
import {initContext} from '../src/context';

describe('nearby entity buckets',()=>{
 it('preserves authored ordering, duplicates, dimensions and hidden entities',()=>{
  const a={x:0,y:0,z:100},b={x:3,y:4,z:0},hidden={visible:false};
  const source=[b,a,b,hidden];
  expect(nearby(source,{x:0,y:0},5)).toEqual([b,a,b]);
  expect(nearby(source,{x:0,y:0,z:0},5)).toEqual([b,b]);
  expect(()=>nearby(source,{x:0,y:0},-1)).toThrow();
 });
 it('relocates Rune writes and invalidates pushes, replacements and visibility changes',()=>{
  initContext({app:{state:{},derived:{}},helperDefinitions:{},actionDefinitions:{},derivedDefinitions:{}} as any);
  const a={x:1,y:1,visible:true},b={x:1000,y:1,visible:true};const list=[a,b];
  withEntityQueries(()=>{
   expect(nearby(list,{x:0,y:0},5)).toEqual([a]);
   assignPath('entity.x',2,{entity:b});expect(nearby(list,{x:0,y:0},5)).toEqual([a,b]);
   assignPath('entity.visible',false,{entity:a});expect(nearby(list,{x:0,y:0},5)).toEqual([b]);
   const c={x:2,y:2,visible:true};executeStatement('list.push(c)',{list,c});
   expect(nearby(list,{x:0,y:0},5)).toEqual([b,c]);
   assignPath('list[1]',{x:2000,y:0},{list});expect(nearby(list,{x:0,y:0},5)).toEqual([c]);
  });
  b.x=1;expect(nearby([b],{x:0,y:0},5)).toEqual([b]);
 });
 it('does not reread distant entity coordinates for repeated local queries in a pass',()=>{
  let reads=0;
  const source=Array.from({length:10000},(_,i)=>({get x(){reads++;return i*20;},y:0,z:0}));
  withEntityQueries(()=>{
   expect(nearby(source,{x:0,y:0,z:0},24)).toHaveLength(2);
   const registered=reads;
   for(let i=0;i<50;i++)expect(nearby(source,{x:0,y:0,z:0},24)).toHaveLength(2);
   expect(reads).toBe(registered);
  });
 });
 it('handles nested passes and external explicit relocation',()=>{
  const e={x:1,y:0};const list=[e];
  withEntityQueries(()=>{
   nearby(list,{x:0,y:0},5);
   withEntityQueries(()=>{e.x=100;entityMoved(e);});
   expect(nearby(list,{x:0,y:0},5)).toEqual([]);
  });
 });
 it('rebuilds indexes after a pass throws without affecting later queries',()=>{
  const e={x:1,y:0},list=[e];
  expect(()=>withEntityQueries(()=>{
   expect(nearby(list,{x:0,y:0},5)).toEqual([e]);
   throw new Error('test failure');
  })).toThrow('test failure');
  e.x=100;
  expect(nearbyForRender(list,{x:0,y:0,z:0},5,0)).toEqual([]);
  withEntityQueries(()=>expect(nearby(list,{x:0,y:0},5)).toEqual([]));
 });
});


describe('persistent entity groups',()=>{
 it('keeps distant actors indexed across frames and relocates only changed actors',()=>{
  const group=entityGroup(Array.from({length:10000},(_,i)=>({x:i*20,y:0,z:0})));
  const spy=vi.spyOn(Array.prototype,'forEach');
  try {
   for(let frame=0;frame<50;frame++)withEntityQueries(()=>{
    group[0].x=frame%2;
    expect(nearby(group,{x:0,y:0,z:0},24)).toHaveLength(2);
   });
   expect(spy.mock.contexts.filter(value=>value===group)).toHaveLength(1);
  } finally {spy.mockRestore();}
  group[5000].x=3;expect(nearby(group,{x:0,y:0,z:0},24)).toHaveLength(3);
  group[5000].visible=false;expect(nearby(group,{x:0,y:0,z:0},24)).toHaveLength(2);
 });
 it('owns imported records, preserves duplicates, handles structure and restores JSON',()=>{
  const raw={x:1,y:0},group=entityGroup([raw,raw]);
  expect(group[0]).toBe(group[1]);raw.x=100;
  expect(nearby(group,{x:0,y:0},5)).toHaveLength(2);
  const other=entityGroup([raw]);expect(other[0]).not.toBe(group[0]);
  group.push({x:3,y:0});group.splice(0,1);
  expect(nearby(group,{x:0,y:0},5)).toHaveLength(2);
  group[0]={x:100,y:0};expect(nearby(group,{x:0,y:0},5)).toHaveLength(1);
  expect(nearby(entityGroup(JSON.parse(JSON.stringify(group))),{x:0,y:0},5)).toHaveLength(1);
  group.length=0;expect(nearby(group,{x:0,y:0},5)).toEqual([]);
 });
 it('recovers safely after movement journal overflow and accounts for scaled render bounds',()=>{
  const group=entityGroup([{x:100,y:0,z:0,scale:1}]);
  expect(nearbyForRender(group,{x:0,y:0,z:0},10,2)).toHaveLength(0);
  group[0].scale=50;
  expect(nearbyForRender(group,{x:0,y:0,z:0},10,2)).toHaveLength(1);
  const unrelated=entityGroup([{x:0,y:0}]);
  for(let i=0;i<5000;i++)unrelated[0].x=i;
  group[0].x=1;
  expect(nearby(group,{x:0,y:0,z:0},5)).toHaveLength(1);
 });
});


it('preserves managed actor identity through reactive state',()=>{
 vi.stubGlobal("window",{});
 initContext({app:{state:{},derived:{}},helperDefinitions:{},actionDefinitions:{},derivedDefinitions:{}} as any);
 const group=entityGroup([{x:1,y:0}]),state=makeReactive({group});
 expect(state.group).toBe(group);expect((state.group as any)[0]).toBe(group[0]);
 group[0].x=100;expect(nearby(state.group,{x:0,y:0},5)).toHaveLength(0);
 vi.unstubAllGlobals();
});
