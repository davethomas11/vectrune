import type { DeferredLightingFrame } from './raycaster';

const vertex = `#version 300 es
void main() {
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.0-1.0,0,1);
}`;
const header = `#version 300 es
precision highp float;
precision highp int;
out vec4 painted;
`;
const blur = `${header}
uniform sampler2D source;
uniform ivec2 direction;
vec3 sampleAt(ivec2 p) {
  ivec2 size=textureSize(source,0);
  if(any(lessThan(p,ivec2(0))) || any(greaterThanEqual(p,size))) return vec3(0);
  return floor(texelFetch(source,p,0).rgb*255.0+0.5);
}
void main() {
  ivec2 p=ivec2(gl_FragCoord.xy);
  vec3 sum=sampleAt(p-direction*2)+sampleAt(p-direction)*2.0+
    sampleAt(p)*4.0+sampleAt(p+direction)*2.0+sampleAt(p+direction*2);
  painted=vec4(floor(sum/10.0)/255.0,1);
}`;
const compose = `${header}
uniform sampler2D scene, depths, glow, panes, sceneOverlay, hud, palette;
uniform vec2 viewport, heading, tilt;
uniform vec3 eye;
uniform float fov, rowOrigin, haze, flash, fade;
uniform vec3 horizon, outlineColor;
uniform int lightCount, shadowCount, outlineRadius, paletteEnabled, bloomEnabled;
uniform vec4 lightPose[8], lightColor[8], shadowPose[32], shadowSize[32];
vec3 rgbAt(sampler2D image,ivec2 p) {
  return floor(texelFetch(image,p,0).rgb*255.0+0.5);
}
float depthAt(ivec2 p) {
  p=clamp(p,ivec2(0),ivec2(viewport)-1);
  float d=texelFetch(depths,p,0).r;
  return d==0.0 ? 1e30 : d;
}
vec3 glowAt(ivec2 p) {
  return rgbAt(glow,clamp(p,ivec2(0),textureSize(glow,0)-1));
}
vec3 mixGlow(vec3 a,vec3 b,float weight) {
  return floor((a*(4.0-weight)+b*weight)/4.0);
}
void main() {
  ivec2 p=ivec2(int(gl_FragCoord.x),int(viewport.y)-1-int(gl_FragCoord.y));
  float d=depthAt(p), up=(rowOrigin-float(p.y)-0.5)/viewport.y;
  float side=(float(p.x)*2.0/viewport.x-1.0)*fov;
  vec3 color=rgbAt(scene,p);
  for(int i=0;i<8;i++) {
    if(i>=lightCount) break;
    vec4 pose=lightPose[i];
    if(d<pose.z-pose.w || d>pose.z+pose.w) continue;
    vec3 delta=vec3(d*side-pose.x,d*up-pose.y,d-pose.z);
    float edge=1.0-dot(delta,delta)/(pose.w*pose.w);
    if(edge>0.0) color=floor(min(vec3(255),color+lightColor[i].rgb*edge*edge));
  }
  for(int i=0;i<32;i++) {
    if(i>=shadowCount) break;
    vec4 pose=shadowPose[i], size=shadowSize[i];
    float distance=(pose.z-eye.z)/(tilt.y+tilt.x*up);
    if(distance<=0.10) continue;
    if(size.z>0.0 ? d<distance-0.02 : abs(d-distance)>0.055) continue;
    float forward=tilt.x-tilt.y*up;
    vec2 offset=(eye.xy-pose.xy+distance*(heading*forward+vec2(-heading.y,heading.x)*side))/size.xy;
    float strength=(1.0-dot(offset,offset))*pose.w;
    if(strength>0.0) color=floor(color+(vec3(11,9,16)-color)*strength);
  }
  ivec2 tile=p/4;
  vec2 pane=texelFetch(panes,tile,0).rg;
  if(haze>0.0 && d>22.0 && d<1e29)
    color=floor(color+(horizon-color)*haze*min(0.30,(d-22.0)*0.008));
  if(d>pane.x+0.00001 && pane.y>0.0)
    color=floor(color+(vec3(129,201,240)-color)*(pane.y/255.0));
  if(bloomEnabled>0) {
    float wx=float(p.x%4), wy=float(p.y%4);
    vec3 a=mixGlow(glowAt(tile),glowAt(tile+ivec2(0,1)),wy);
    vec3 b=mixGlow(glowAt(tile+ivec2(1,0)),glowAt(tile+ivec2(1,1)),wy);
    color=min(vec3(255),color+mixGlow(a,b,wx));
  }
  if(outlineRadius>0) {
    ivec2 x=ivec2(outlineRadius,0), y=ivec2(0,outlineRadius);
    float near=min(min(depthAt(p-x),depthAt(p+x)),min(depthAt(p-y),depthAt(p+y)));
    int diagonal=int(float(outlineRadius)/sqrt(2.0));
    if(diagonal>0) {
      ivec2 a=ivec2(diagonal,diagonal),b=ivec2(diagonal,-diagonal);
      near=min(near,min(min(depthAt(p-a),depthAt(p+a)),min(depthAt(p-b),depthAt(p+b))));
    }
    if(d-near>max(0.12,near*0.025)) color=outlineColor;
  }
  vec4 overlay=texelFetch(sceneOverlay,p,0);
  if(overlay.a>0.0) color=floor(overlay.rgb*255.0+0.5);
  if(flash>0.0) {
    float amount=min(1.0,flash*0.12);
    color=clamp(color+vec3(floor(180.0*amount),-floor(50.0*amount),-floor(50.0*amount)),0.0,255.0);
  }
  color=floor(color*(1.0-min(1.0,fade)));
  overlay=texelFetch(hud,p,0);
  if(overlay.a>0.0) color=floor(overlay.rgb*255.0+0.5);
  if(paletteEnabled>0) {
    int luma=int(dot(color,vec3(54,183,19))/256.0);
    color=rgbAt(palette,ivec2(luma,0));
  }
  painted=vec4(color/255.0,1);
}`;

/** CPU geometry/picking, GPU lighting/compositing; no framebuffer readback in presentation. */
export function createGpuLighting(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', {alpha:false,antialias:false,depth:false,failIfMajorPerformanceCaveat:true});
  if (!gl) return undefined;
  const programs: WebGLProgram[] = [], shaders: WebGLShader[] = [];
  const textures: WebGLTexture[] = [], framebuffers: WebGLFramebuffer[] = [];
  const vao = gl.createVertexArray();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    gl.deleteVertexArray(vao);
    textures.forEach(t => gl.deleteTexture(t));
    framebuffers.forEach(f => gl.deleteFramebuffer(f));
    programs.forEach(p => gl.deleteProgram(p));
    shaders.forEach(s => gl.deleteShader(s));
  };
  const program = (fragment: string, names: string[]) => {
    const handle = gl.createProgram();
    if (!handle) throw new Error('GPU lighting program allocation failed');
    programs.push(handle);
    for (const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('GPU lighting shader allocation failed');
      shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'GPU lighting shader failed');
      gl.attachShader(handle,shader);
    }
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle) ?? 'GPU lighting link failed');
    return {handle,loc:Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(handle,name)]))};
  };
  const texture = () => {
    const t=gl.createTexture();
    if (!t) throw new Error('GPU lighting texture allocation failed');
    textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  };
  try {
    if (!vao) throw new Error('GPU lighting vertex array allocation failed');
    gl.disable(gl.DITHER);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(vao);
    const blurProgram=program(blur,['source','direction']);
    const finalProgram=program(compose,['scene','depths','glow','panes','sceneOverlay','hud','palette',
      'viewport','heading','tilt','eye','fov','rowOrigin','haze','flash','fade','horizon','outlineColor',
      'lightCount','shadowCount','outlineRadius','paletteEnabled','bloomEnabled','lightPose[0]','lightColor[0]',
      'shadowPose[0]','shadowSize[0]']);
    const scene=texture(),depths=texture(),emission=texture(),pane=texture(),
      overlay=texture(),hud=texture(),palette=texture(),horizontal=texture(),vertical=texture();
    const targets=[horizontal,vertical].map(t=>{
      const framebuffer=gl.createFramebuffer();
      if (!framebuffer) throw new Error('GPU bloom framebuffer allocation failed');
      framebuffers.push(framebuffer);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
      return framebuffer;
    });
    const sizes=new Map<WebGLTexture,string>();
    const upload=(t:WebGLTexture,w:number,h:number,internal:number,format:number,type:number,data:ArrayBufferView|null)=>{
      gl.bindTexture(gl.TEXTURE_2D,t);
      const key=`${w}:${h}:${internal}`;
      if(sizes.get(t)!==key) {
        gl.texImage2D(gl.TEXTURE_2D,0,internal,w,h,0,format,type,data);
        sizes.set(t,key);
      } else if(data) gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,w,h,format,type,data);
    };
    let depthData=new Float32Array(0),paneData=new Float32Array(0),emissionData=new Uint32Array(0);
    const lightPose=new Float32Array(32),lightColor=new Float32Array(32),
      shadowPose=new Float32Array(128),shadowSize=new Float32Array(128);
    const bytes=(data:Uint32Array)=>new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    const packedRgb=(color:number)=>[color&255,(color>>>8)&255,(color>>>16)&255] as const;
    const draw=(frame:DeferredLightingFrame)=>{
      if(disposed || gl.isContextLost()) throw new Error('GPU lighting context unavailable');
      gl.disable(gl.DITHER);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
      const {width:w,height:h,enhancement:e}=frame;
      if((e?.shadows.length??0)>32) throw new Error('GPU lighting supports up to 32 contact shadows; using CPU');
      const tw=e?.tileWidth??Math.ceil(w/4),th=e?.tileHeight??Math.ceil(h/4);
      if(depthData.length!==w*h) depthData=new Float32Array(w*h);
      if(paneData.length!==tw*th*2) {paneData=new Float32Array(tw*th*2);emissionData=new Uint32Array(tw*th);}
      for(let i=0;i<depthData.length;i++) depthData[i]=Number.isFinite(frame.depth[i])?frame.depth[i]:0;
      let bloomEnabled = false;
      for(let i=0;i<emissionData.length;i++){
        paneData[i*2]=Number.isFinite(e?.paneDepth[i])?e!.paneDepth[i]:1e30;
        paneData[i*2+1]=e?.paneAlpha[i]??0;
        emissionData[i]=(0xff000000|(e?.emission.colors[i]??0))>>>0;
        if(e?.emission.colors[i]) bloomEnabled = true;
      }
      gl.activeTexture(gl.TEXTURE0);
      upload(scene,w,h,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bytes(frame.color));
      upload(depths,w,h,gl.R32F,gl.RED,gl.FLOAT,depthData);
      upload(overlay,w,h,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bytes(frame.sceneOverlay));
      upload(hud,w,h,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bytes(frame.hud));
      upload(pane,tw,th,gl.RG32F,gl.RG,gl.FLOAT,paneData);
      upload(emission,tw,th,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bytes(emissionData));
      if(frame.palette) upload(palette,256,1,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,bytes(frame.palette));
      else upload(palette,1,1,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
      upload(horizontal,tw,th,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,null);
      upload(vertical,tw,th,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindVertexArray(vao);gl.useProgram(blurProgram.handle);
      gl.viewport(0,0,tw,th);gl.uniform1i(blurProgram.loc.source,0);
      for(let i=0;i<(bloomEnabled?2:0);i++){
        gl.bindFramebuffer(gl.FRAMEBUFFER,targets[i]);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('GPU bloom target incomplete');
        gl.bindTexture(gl.TEXTURE_2D,i?horizontal:emission);
        gl.uniform2i(blurProgram.loc.direction,i?0:1,i?1:0);
        gl.drawArrays(gl.TRIANGLES,0,3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);
      gl.useProgram(finalProgram.handle);
      const l=finalProgram.loc;
      for(const [unit,name,t] of [[0,'scene',scene],[1,'depths',depths],[2,'glow',bloomEnabled?vertical:emission],[3,'panes',pane],
        [4,'sceneOverlay',overlay],[5,'hud',hud],[6,'palette',palette]] as const) {
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(l[name],unit);
      }
      const pitch=(frame.camera.pitch??0)*Math.PI/180,cp=Math.cos(pitch),sp=Math.sin(pitch);
      const eye=frame.camera.height??.5;
      frame.lights.forEach((light,i)=>{
        const dx=light.x-frame.camera.x,dy=light.y-frame.camera.y,dz=light.z-eye;
        const forward=dx*frame.dirX+dy*frame.dirY;
        lightPose.set([-dx*frame.dirY+dy*frame.dirX,dz*cp-forward*sp,forward*cp+dz*sp,light.radius],i*4);
        lightColor.set([(light.color>>>16)*light.intensity,((light.color>>>8)&255)*light.intensity,
          (light.color&255)*light.intensity,0],i*4);
      });
      e?.shadows.forEach((s,i)=>{
        shadowPose.set([s.x,s.y,s.z,s.strength],i*4);
        shadowSize.set([s.halfA,s.halfB,s.onGlass?1:0,0],i*4);
      });
      gl.uniform4fv(l['lightPose[0]'],lightPose);gl.uniform4fv(l['lightColor[0]'],lightColor);
      gl.uniform4fv(l['shadowPose[0]'],shadowPose);gl.uniform4fv(l['shadowSize[0]'],shadowSize);
      gl.uniform1i(l.lightCount,frame.lights.length);gl.uniform1i(l.shadowCount,e?.shadows.length??0);
      gl.uniform2f(l.viewport,w,h);gl.uniform2f(l.heading,frame.dirX,frame.dirY);gl.uniform2f(l.tilt,cp,sp);
      gl.uniform3f(l.eye,frame.camera.x,frame.camera.y,eye);gl.uniform1f(l.fov,frame.fov);gl.uniform1f(l.rowOrigin,frame.rowOrigin);
      gl.uniform1f(l.haze,e?.haze??0);gl.uniform3f(l.horizon,...packedRgb(e?.horizon??0));
      gl.uniform1f(l.flash,frame.flash);gl.uniform1f(l.fade,frame.fade);
      gl.uniform1i(l.outlineRadius,frame.outlineRadius);gl.uniform3f(l.outlineColor,...packedRgb(frame.outlineColor));
      gl.uniform1i(l.paletteEnabled,frame.palette?1:0);
      gl.uniform1i(l.bloomEnabled,bloomEnabled?1:0);
      gl.drawArrays(gl.TRIANGLES,0,3);
      const error=gl.getError();
      if(error!==gl.NO_ERROR) throw new Error(`GPU lighting failed (WebGL ${error})`);
    };
    return {draw,dispose};
  } catch(error) {dispose();throw error;}
}
