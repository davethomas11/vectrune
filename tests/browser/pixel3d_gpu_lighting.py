"""Compare hybrid GPU lighting with CPU frames and exercise host fallbacks.

SwiftShader validates shaders, not hardware speed. Readback is test-only.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BINARY = os.environ.get("VECTRUNE_BINARY", str(ROOT / "target/debug/vectrune"))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--benchmark", action="store_true", help="Measure software GPU completion, not hardware speed")
parser.add_argument("--browser-gpu", action="store_true", help="Use the default browser adapter (may still be software)")
args = parser.parse_args()

COMPARE = """crowded => {
  const game=__RunePixel3D, state=game.app.state;
  if(crowded){
    state.progress.tank=2;state.progress.fish=30;
    state.progress.critters=Array.from({length:12},(_,i)=>({kind:i%4}));
    state.progress.florals=Array.from({length:12},(_,i)=>({kind:i%3,slot:i}));
  }
  game.invoke('initialize');state.progress.pearls=100;game.invoke('feed');
  for(let i=0;i<60;i++) game.step({});
  const canvas=document.createElement('canvas');
  canvas.width=game.raycaster.width;canvas.height=game.raycaster.height;
  const renderer=RuneGpuLighting.createGpuLighting(canvas);
  if(!renderer) throw new Error('Software WebGL2 fixture unavailable');
  const gl=canvas.getContext('webgl2');
  const results=[];
  const compare=(render,label)=>{
    const cpu=new Uint8Array(render().buffer.slice(0));
    render(frame=>renderer.draw(frame));
    const actual=new Uint8Array(cpu.length);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,actual);
    let max=0,total=0,changed=0,large=0;
    for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++){
      const a=(y*canvas.width+x)*4,b=((canvas.height-1-y)*canvas.width+x)*4;
      let delta=0;
      for(let channel=0;channel<3;channel++) delta=Math.max(delta,Math.abs(cpu[a+channel]-actual[b+channel]));
      max=Math.max(max,delta);total+=delta;if(delta) changed++;if(delta>2) large++;
      if(cpu[a+3]!==actual[b+3]) throw new Error('Alpha mismatch');
    }
    results.push({label,max,mean:total/(canvas.width*canvas.height),changed,large});
  };
  for(const enhanced of [false,true]){
    game.raycaster.setEnhancedLighting(enhanced);
    compare(callback=>game.frame(callback),enhanced?'aquarium-enhanced':'aquarium-standard');
  }
  game.invoke('toggle_menu');
  compare(callback=>game.frame(callback),'aquarium-menu');
  game.invoke('close_menu');
  if(!crowded){
    state.progress.pearls=100000;
    for(let i=0;i<state.fish.length;i++){
      game.invoke('inspect_fish',[i]);game.invoke('buy_fish_upgrade',[0]);game.invoke('buy_fish_upgrade',[2]);
    }
    game.invoke('close_profile');
    for(let i=0;i<10;i++)game.step({});
    game.raycaster.setEnhancedLighting(true);
    compare(callback=>game.frame(callback),'aquarium-styled-moon');
  }
  const {Raycaster3D,voxelWorld,voxelFill}=RuneGpuLighting;
  const world=voxelWorld(8,8,8,['floor']);
  voxelFill(world,[0,0,0],[8,8,1],1);
  const ray=new Raycaster3D({width:73,height:53,world,
    map:{width:4,height:4,grid:Array(16).fill(0),floor:0xff202024,ceiling:0xff202024},
    textures:{floor:{width:1,height:1,pixels:new Uint32Array([0xffc89988])}},sprites:{},
    models:{
      actor:{blocks:[],contactShadow:.8},
      lamp:{blocks:[{from:[-.18,-.1,-.18],size:[.36,.2,.36],color:0xfff4a015,emissive:true}]},
      glass:{blocks:[],glass:[3,3]},
      cover:{blocks:[{from:[-1,-.1,-1],size:[2,.2,2],color:0xff202024}]}
    }});
  const camera={x:4,y:6,z:2.8,angle:270,pitch:-50};
  const things=[{x:4,y:4,z:1,model:'actor'},{x:4,y:4,z:2,model:'lamp'},
    {x:4,y:3,z:2,model:'glass',pitch:-90,angle:90}];
  const lights=[{x:4,y:4,z:3,radius:4,intensity:.6,color:0xff8020}];
  canvas.width=ray.width;canvas.height=ray.height;
  ray.setEnhancedLighting(true);
  const render=(actors=things,flash=0,stats=undefined)=>callback=>
    ray.render(camera,actors,undefined,flash,stats,undefined,0,undefined,[],lights,callback);
  compare(render(things.slice(0,2)),'voxel-contact-shadow');
  let shadowCount=0;
  render(things.slice(0,2))(frame=>{shadowCount=frame.enhancement.shadows.length;});
  if(shadowCount!==1) throw new Error('Contact shadow fixture did not exercise a supporting floor');
  compare(render(),'voxel-shadow-glass-bloom');
  let glassVisible=false;
  render()(frame=>{glassVisible=frame.enhancement.paneAlpha.some(alpha=>alpha>0);});
  if(!glassVisible) throw new Error('Glass fixture must intersect the view');
  ray.setPalette([0x08182d,0x489abe,0xffe076],true);
  compare(render(things,3),'palette-outline-flash');
  ray.setPalette(undefined,false);
  compare(render([...things,{x:4,y:4.8,z:2,model:'cover'}]),'occluded-emitter');
  const depth=new Float64Array(ray.width*ray.height).fill(48);
  // Exercise distance haze, including non-finite sky depth, independent of nearby geometry.
  const effects=new RuneGpuLighting.EnhancedLighting();
  effects.begin(ray.width,ray.height);
  depth[0]=Infinity;depth[1]=6;
  const color=new Uint32Array(depth.length).fill(0xff242020);
  const expected=color.slice();
  effects.finish(expected,depth,{x:0,y:0,height:2,angle:0},1,0,.7,ray.height/2,world,[],{});
  const enhancement=effects.prepareDeferred(depth,{x:0,y:0,height:2,angle:0},1,0,.7,ray.height/2,world,[],{});
  const hazeFrame={width:ray.width,height:ray.height,color,depth,
    sceneOverlay:new Uint32Array(depth.length),hud:new Uint32Array(depth.length),
    camera:{x:0,y:0,height:2},dirX:1,dirY:0,fov:.7,rowOrigin:ray.height/2,
    lights:[],enhancement,outlineRadius:0,outlineColor:0,flash:0,fade:.4};
  const faded=expected.map(c=>0xff000000|Math.floor((c&255)*.6)|
    Math.floor(((c>>>8)&255)*.6)<<8|Math.floor(((c>>>16)&255)*.6)<<16);
  compare(callback=>{if(callback) callback(hazeFrame);return faded;},'haze-fade');
  let limited=false;
  try{render(Array.from({length:33},()=>things[0]))(frame=>renderer.draw(frame));}
  catch(error){if(!error.message.includes('32 contact shadows')) throw error;limited=true;}
  if(!limited) throw new Error('Contact shadow limit must fail explicitly, not omit shadows');
  renderer.dispose();
  return results;
}"""

BENCHMARK = """browserGpu => {
  const game=__RunePixel3D,ray=game.raycaster;
  const canvas=document.createElement('canvas');
  canvas.width=ray.width;canvas.height=ray.height;
  const renderer=RuneGpuLighting.createGpuLighting(canvas),gl=canvas.getContext('webgl2');
  const cpuCanvas=document.createElement('canvas');
  cpuCanvas.width=ray.width;cpuCanvas.height=ray.height;
  const context=cpuCanvas.getContext('2d'),cpu=[],gpu=[];
  for(let i=0;i<40;i++){
    let begin=performance.now();
    const image=game.frame();
    context.putImageData(new ImageData(new Uint8ClampedArray(image.buffer),ray.width,ray.height),0,0);
    const cpuMs=performance.now()-begin;
    begin=performance.now();
    game.frame(frame=>renderer.draw(frame));
    gl.finish();
    const gpuMs=performance.now()-begin;
    if(i>=10){cpu.push(cpuMs);gpu.push(gpuMs);}
  }
  renderer.dispose();
  const stats=values=>{
    values.sort((a,b)=>a-b);
    return {median:values[values.length>>1],p95:values[Math.floor(values.length*.95)]};
  };
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  return {environment:browserGpu?'Browser default adapter; inspect adapter before claiming hardware speed':
      'SwiftShader; not hardware performance evidence',
    adapter:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    fish:game.app.state.fish.length,cpuMs:stats(cpu),gpuCompletedMs:stats(gpu)};
}"""

with tempfile.TemporaryDirectory(prefix="pixel3d-gpu-") as folder, sync_playwright() as pw:
    folder = Path(folder)
    preview = folder / "aquarium.html"
    preview.write_bytes(subprocess.check_output([
        BINARY, str(ROOT / "examples/games/idle_aquarium/idle_aquarium.rune"), "-o", "html",
    ]))
    fixture = folder / "lighting.js"
    subprocess.run([
        str(ROOT / "runtime/rune-web/node_modules/.bin/esbuild"),
        "--bundle", "--format=iife", "--global-name=RuneGpuLighting",
        f"--outfile={fixture}", "--log-level=error", "--sourcefile=gpu-fixture.ts",
    ], input="""export {createGpuLighting} from './runtime/rune-web/src/pixel3d/gpu_lighting';
export {Raycaster3D} from './runtime/rune-web/src/pixel3d/raycaster';
export {EnhancedLighting} from './runtime/rune-web/src/pixel3d/enhanced_lighting';
export {voxelWorld,voxelFill} from './runtime/rune-web/src/pixel3d/voxel';""",
        text=True, cwd=ROOT, check=True)
    browser = pw.chromium.launch(args=[] if args.browser_gpu else ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
    results = []
    for crowded in [False, True]:
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.add_init_script("""window.requestAnimationFrame=()=>0;""")
        if not args.browser_gpu:
            page.add_init_script("""
          const get=HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext=function(type,options){
            if(type==='webgl2') options={...options,failIfMajorPerformanceCaveat:false};
            return get.call(this,type,options);
          };""")
        page.goto(preview.as_uri())
        page.wait_for_function("window.__RunePixel3D")
        page.add_script_tag(path=str(fixture))
        result = page.evaluate(COMPARE, crowded)
        results.append(result)
        assert not errors, errors
        for frame in result:
            assert frame["mean"] < .1 and frame["max"] <= 2, frame
        if args.benchmark:
            print(json.dumps(page.evaluate(BENCHMARK, args.browser_gpu), indent=2))
        page.close()
    print(json.dumps(results, indent=2))
    for failure in ["context-loss", "frame-failure", "unavailable"]:
        available = failure != "unavailable"
        page = browser.new_page()
        page.add_init_script("""window.__frame=undefined;window.__clock=performance.now();
          window.requestAnimationFrame=callback=>{window.__frame=callback;return 1;};
          window.drawNext=()=>{__clock+=40;__frame(__clock);};
          const get=HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext=function(type,options){
            if(type==='webgl2') options={...options,failIfMajorPerformanceCaveat:false};
            return get.call(this,type,options);
          };""")
        if not available:
            page.add_init_script("""const previousGet=HTMLCanvasElement.prototype.getContext;
              HTMLCanvasElement.prototype.getContext=function(type,options){
                return type==='webgl2'?null:previousGet.call(this,type,options);
              };""")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(preview.as_uri())
        page.wait_for_function("Boolean(window.__RunePixel3D && window.__frame)", polling=50)
        toggle = page.locator("[data-pixel-gpu]")
        page.evaluate("""const toggle=document.querySelector('[data-pixel-gpu]');
          toggle.checked=true;toggle.dispatchEvent(new Event('change'));""")
        page.evaluate("drawNext()")
        if available:
            assert page.locator("[data-pixel-gpu-surface]").is_visible()
            for angle in range(0,361,15):
                page.evaluate("""angle=>{
                  const g=__RunePixel3D,s=g.app.state;
                  s.orbit=angle;s.orbit_target=angle;g.invoke('animate');drawNext();
                }""", angle)
                assert toggle.is_checked() and not toggle.is_disabled()
            page.evaluate("__RunePixel3D.invoke('toggle_menu');drawNext()")
            assert page.locator("[data-pixel-gpu-surface]").is_visible()
            if failure == "context-loss":
                page.evaluate("""document.querySelector('[data-pixel-gpu-surface]').getContext('webgl2')
                  .getExtension('WEBGL_lose_context').loseContext()""")
            else:
                page.evaluate("""const gl=document.querySelector('[data-pixel-gpu-surface]').getContext('webgl2');
                  gl.drawArrays=()=>{throw new Error('Forced GPU frame failure');};
                  __RunePixel3D.invalidateFrame();drawNext();""")
            page.wait_for_function("document.querySelector('[data-pixel-gpu]').disabled", polling=50)
        assert toggle.is_disabled() and not toggle.is_checked()
        assert "CPU" in toggle.get_attribute("title")
        page.evaluate("drawNext()")
        assert page.evaluate("__RunePixel3D.raycaster.enhancedLighting")
        assert page.locator("[data-pixel-gpu-surface]").count() == 0
        assert not errors, errors
        page.close()
    browser.close()
