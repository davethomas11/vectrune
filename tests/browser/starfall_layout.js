// Directional signs stay front-facing; the new glove route preserves old sector saves.
(() => {
 const g=__RunePixel3D,s=g.app.state;
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const left=g.config.models['sf/dash_gap_left'],right=g.config.models['sf/dash_gap_right'];
 check(left&&right&&left.blocks.length===right.blocks.length,'Missing directional signs');
 left.blocks.forEach((block,i)=>check(right.blocks[i].from[0]===-block.from[0]-block.size[0],'Chevron did not mirror its horizontal geometry'));
 __starfallLaunch();
 check(s.scenery.some(prop=>prop.model==='sf/dash_gap_left'),'Plasma sign must point west');
 s.jets=true;s.player.x=52;g.step({use:true});g.step({});
 check(s.scenery.some(prop=>prop.model==='sf/dash_gap_right'),'Greenhouse sign must point east');
 for(const kind of ['archive','observatory']){
  g.invoke('build_bonus_room',[kind]);
  check(s.scenery.some(prop=>prop.model==='sf/dash_gap_right'),'Optional gap sign must point east');
 }
 __starfallLaunch();
 return true;
})()
