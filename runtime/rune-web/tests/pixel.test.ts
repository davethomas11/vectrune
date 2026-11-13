import { describe, expect, it } from 'vitest';
import { PixelEngine, type PixelConfig } from '../src/pixel/engine';
import type { RuneWebConfig } from '../src/types';

function game() {
  const config: PixelConfig = { width:384,height:216,tickRate:30,background:0x010203,layers:['actor'],rects:[],
    sprites:{dot:{width:2,height:1,origin:[1,0],colors:[null,0xff0000],pixels:[0,1]},blue:{width:1,height:1,origin:[0,0],colors:[0x0000ff],pixels:[0]}},
    animations:{blink:{frames:['dot','blue'],fps:15}} };
  const options = {pageTree:{Comment:'test'},stateJson:{count:0,status:'playing',health:100,actor:{x:10,y:40,sprite:'dot',scale:2}},
    derivedDefinitions:{double:{source:"count",cases:[{matcher:"_",value:"count * 2"}]}},helperDefinitions:{},i18nData:{},actionDefinitions:{start:{params:[],steps:[{Statement:'count = 0'}]},tick:{params:['input'],steps:[{Statement:'count += 1'}]}}} as unknown as RuneWebConfig;
  return new PixelEngine(config,options);
}

describe('portable pixel renderer and simulation', () => {
  it('preserves transparent pixels, scales sprites, and honors origins and flipping', () => {
    const engine=game(); let frame=engine.frame();
    expect(frame[40*384+8]).toBe(0xff030201);
    expect(frame[40*384+10]).toBe(0xff0000ff);
    expect(frame[41*384+11]).toBe(0xff0000ff);
    (engine.app.state.actor as any).flip=true;
    frame=engine.frame();
    expect(frame[40*384+8]).toBe(0xff0000ff);
    expect(frame[40*384+10]).toBe(0xff030201);
  });
  it('clips sprites at every framebuffer edge without writing into adjacent rows', () => {
    const engine=game(); const actor=engine.app.state.actor as any;
    actor.x=384;engine.frame();
    expect(engine.buffer[41*384]).toBe(0xff030201);
    actor.x=-20;actor.y=-20;expect(()=>engine.frame()).not.toThrow();
  });
  it('uses simulation ticks for animation and pauses state changes', () => {
    const engine=game();(engine.app.state.actor as any).sprite='blink';
    expect(engine.frame()[40*384+10]).toBe(0xff0000ff);
    engine.step();engine.step();
    expect(engine.frame()[40*384+10]).toBe(0xffff0000);
    engine.paused=true;engine.step();expect(engine.app.state.count).toBe(2);
    engine.start();expect(engine.app.state.count).toBe(0);expect(engine.paused).toBe(false);
  });
  it('keeps independent game contexts isolated when stepping alternately', () => {
    const first=game(),second=game();first.step();second.step();first.step();
    expect(first.app.state.count).toBe(2);expect(second.app.state.count).toBe(1);
    expect(first.app.derived.double).toBe(4);expect(second.app.derived.double).toBe(2);
  });
  it('fails clearly on missing sprite names', () => {
    const engine=game();(engine.app.state.actor as any).sprite='typo';
    expect(()=>engine.frame()).toThrow('Unknown pixel sprite: typo');
  });
});
