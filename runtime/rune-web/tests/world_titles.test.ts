import {describe,it,expect} from 'vitest';
import {Raycaster3D,type Thing3D} from '../src/pixel3d/raycaster';
import {voxelWorld,voxelFill} from '../src/pixel3d/voxel';

const ink=0xff563412;
const marked=(r:Raycaster3D)=>Array.from(r.buffer.entries()).filter(([,color])=>color===ink).map(([i])=>[i%r.width,Math.floor(i/r.width)]);
const create=()=>new Raycaster3D({width:100,height:80,textures:{wall:{width:8,height:8,pixels:new Uint32Array(64).fill(0xff222222)}},sprites:{},
 map:{width:8,height:8,grid:Array.from({length:64},(_,i)=>i<8||i>=56||i%8===0||i%8===7?1:0),floor:0x111111,ceiling:0x333333,ceilingHeight:4}});

describe('world-anchored door titles',()=>{
 it('follows the camera, supports pitch, and skips hidden, dissolved and rear labels',()=>{
  const r=create(),camera={x:1.5,y:3.5,angle:0};
  const door:Thing3D={x:3.5,y:3.5,title:'HYDROPONICS',titleHeight:.5,titleColor:0x123456};
  r.render(camera,[door]);const first=marked(r);expect(first.length).toBeGreaterThan(50);
  r.render({...camera,y:3.8},[door]);const moved=marked(r);
  expect(Math.min(...moved.map(([x])=>x))).toBeLessThan(Math.min(...first.map(([x])=>x)));
  r.render({...camera,pitch:15},[{...door,titleHeight:1}]);expect(marked(r).length).toBeGreaterThan(50);
  for(const change of [{visible:false},{dissolve:1},{x:.5}]){r.render(camera,[{...door,...change}]);expect(marked(r)).toHaveLength(0);}
 });
 it('respects wall depth in grid and voxel scenes and leaves geometry depths intact',()=>{
  const r=create(),camera={x:1.5,y:3.5,angle:0};
  const door:Thing3D={x:5.5,y:3.5,title:'CRYPT',titleHeight:.5,titleColor:0x123456};
  r.render(camera,[]);const original=r.pixelDepth.slice();r.render(camera,[door]);expect(r.pixelDepth).toEqual(original);
  for(let y=1;y<7;y++)r.config.map.grid[y*8+3]=1;
  r.render(camera,[door]);expect(marked(r)).toHaveLength(0);
  const world=voxelWorld(16,16,8,['wall']);r.config.world=world;
  const eye={...camera,z:1.5};r.render(eye,[{...door,titleHeight:2.75}]);expect(marked(r).length).toBeGreaterThan(0);
  voxelFill(world,[3,0,0],[1,16,7],1);
  r.render(eye,[{...door,titleHeight:2.75}]);expect(marked(r)).toHaveLength(0);
 });
 it('validates author-controlled title data before drawing',()=>{
  const r=create(),camera={x:1.5,y:3.5,angle:0},door={x:3.5,y:3.5,title:'DOOR',titleHeight:.5};
  for(const title of ['', 'X'.repeat(49),'A\nB'])expect(()=>r.render(camera,[{...door,title}])).toThrow('title');
  for(const titleHeight of [-1,Infinity,65])expect(()=>r.render(camera,[{...door,titleHeight}])).toThrow('titleHeight');
  for(const titleColor of [-1,0x1000000,1.5])expect(()=>r.render(camera,[{...door,titleColor}])).toThrow('titleColor');
 });
});
