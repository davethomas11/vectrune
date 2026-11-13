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
  it('matches individual sprite pixels after span caching, clipping, scaling and flipping', () => {
    for(const flip of [false,true]) for(const scale of [1,2,3]) for(const x of [-1,10,384]) {
      const engine=game();
      engine.config.sprites.pattern={width:3,height:2,origin:[1,1],colors:[null,0xff0000,0x00ff00],pixels:[1,1,0,2,0,1]};
      engine.app.state.actor={x,y:41,sprite:'pattern',scale,flip};
      const expected=new Uint32Array(384*216).fill(0xff030201);
      const pattern=[1,1,0,2,0,1], colors=[0,0xff0000ff,0xff00ff00];
      for(let row=0;row<2;row++) for(let col=0;col<3;col++) {
        const color=colors[pattern[row*3+col]];
        if(!color) continue;
        for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++) {
          const px=x-scale+(flip ? 2-col : col)*scale+dx, py=41-scale+row*scale+dy;
          if(px>=0 && px<384 && py>=0 && py<216) expected[py*384+px]=color;
        }
      }
      // Compare every pixel, including a warm-cache pass, without Vitest's
      // recursive inspection of multi-megabyte typed arrays on slower CI hosts.
      for(let pass=0;pass<2;pass++) {
        const mismatch=engine.frame().findIndex((pixel,index)=>pixel!==expected[index]);
        expect(mismatch,`flip=${flip} scale=${scale} x=${x} pass=${pass}`).toBe(-1);
      }
    }
  });
  it('uses the current menu for keyboard choices before its next rendered frame', () => {
    const engine=game(); engine.config.menu='menu';
    engine.app.state.menu={title:'OLD',buttons:[{label:'OLD',action:'tick'}]};
    engine.frame(); engine.step(); expect(engine.app.state.count).toBe(1);
    engine.app.state.menu={title:'NEW',buttons:[{label:'START',action:'start'}]};
    expect(engine.key('Enter')).toBe(true);
    expect(engine.app.state.count).toBe(0);
  });
  it('fails clearly on missing sprite names', () => {
    const engine=game();(engine.app.state.actor as any).sprite='typo';
    expect(()=>engine.frame()).toThrow('Unknown pixel sprite: typo');
  });
});
