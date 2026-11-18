import {describe,it,expect} from 'vitest';
import {Raycaster3D} from '../src/pixel3d/raycaster';
import {renderHud,validateHud,type GameHud} from '../src/pixel3d/hud';
const create=()=>new Raycaster3D({width:80,height:80,textures:{},sprites:{},map:{width:2,height:2,grid:[0,0,0,0],floor:0x222222,ceiling:0x444444}});
const ui:GameHud={meters:[],objective:'',detail:'',prompt:'',notice:'',panel:null,cinema:{lines:['AAA','BBB'],offset:45,top:.25,bottom:.75,scale:2,spacing:18}};
describe('cinematic crawl HUD',()=>{
 it('clips partially visible glyphs at both viewport edges',()=>{
  const r=create();r.buffer.fill(0xff010203);
  r.text('AAA',10,18,0x123456,2,{top:21,bottom:26});
  const rows=Array.from(r.buffer.entries()).filter(([,v])=>v===0xff563412).map(([i])=>Math.floor(i/80));
  expect(Math.min(...rows)).toBe(21);expect(Math.max(...rows)).toBe(25);
 });
 it('scrolls text within its viewport and fades the world without fading the credits',()=>{
  const r=create();expect(validateHud(ui)).toBe(ui);
  r.buffer.fill(0xff010203);renderHud(r,ui,'credits',false);
  const first=r.buffer.slice(),ink=0xffe9eee4;
  const indices=Array.from(first.entries()).filter(([,v])=>v===ink).map(([i])=>i);
  expect(indices.length).toBeGreaterThan(0);
  expect(indices.every(i=>Math.floor(i/80)>=20&&Math.floor(i/80)<60)).toBe(true);
  r.buffer.fill(0xff010203);renderHud(r,{...ui,cinema:{...ui.cinema!,offset:55}},'credits',false);expect(r.buffer).not.toEqual(first);
  const camera={x:.5,y:.5,angle:0};r.render(camera,[],undefined,0,{status:'credits',ui:{...ui,cinema:{...ui.cinema!,fade:1}}});
  expect(r.buffer[12*80+40]).toBe(0xff000000);expect(r.buffer.some(pixel=>pixel===ink)).toBe(true);
 });
 it('rejects unbounded or invalid scroll and fade values',()=>{
  for(const change of [{offset:Infinity},{offset:10001},{lines:Array(65).fill('A')},{lines:['X'.repeat(81)]},{top:.8,bottom:.2},{fade:1.1},{scale:3},{spacing:0}])
   expect(()=>validateHud({...ui,cinema:{...ui.cinema!,...change}})).toThrow('cinema');
 });
});
