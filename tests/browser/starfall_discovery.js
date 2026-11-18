// Real pickup hooks, safe celebration, input edges and return to gameplay.
(() => {
 const g=__RunePixel3D,s=g.app.state,check=(ok,message)=>{if(!ok)throw Error(message);};
 const step=(n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
 for(const [kind,model,title] of [
  ['jets','sf/jets','JUMP JETS'],['dash','sf/dash_cell','AIR DASH'],
  ['plasma','sf/plasma_cell','PLASMA CHARGE'],['glove','sf/magnetic_glove','MAGNETIC GLOVE'],
  ['capacitor','sf/overcharge_cell','PLASMA CAPACITOR'],['armor','sf/armor_cell','SUIT ARMOR'],
  ['relay','sf/garden_relay','GARDEN RELAY'],['foundry_relay','sf/foundry_relay','FOUNDRY RELAY'],['core','sf/core','STARCORE']]){
  __starfallLaunch();s.dash_unlocked=true;
  s.pickups=[{x:s.player.x,y:7,z:3.5,base:3.5,kind,model,visible:true}];
  g.invoke('update_exploration');
  check(s.discovery_active&&s.discovery_item.visible&&s.discovery_item.model===model,'Pickup did not start reveal: '+kind);
  check(s.ui.objective.includes(title)&&s.discovery_help.length>30,'Missing item instructions: '+kind);
  const x=s.player.x,z=s.player.z,ticks=s.ticks,hp=s.health,enemy=JSON.stringify(s.enemies),shots=JSON.stringify(s.shots);
  const low=s.discovery_item.z;
  step(45,{right:true,fire:true,jump:true,use:true});
  check(s.discovery_active,'Held pickup input dismissed reveal');
  check(s.player.x===x&&s.player.z===z&&s.ticks===ticks,'World advanced during reveal');
  check(JSON.stringify(s.enemies)===enemy&&JSON.stringify(s.shots)===shots,'Combat advanced during reveal');
  g.invoke('take_damage',[99]);check(s.health===hp&&s.recovery_phase==='none','Pilot can die during reveal');
  check(s.discovery_item.z>low+1&&s.avatar.model==='sf/pilot_celebrate'&&!s.rifle.visible,'No overhead lift or hands-up pose');
  check(s.effects.length>0&&s.music_track==='','Celebration lacks sparkles or fanfare space');
  check(g.frame().every(pixel=>(pixel>>>24)===255),'Invalid celebration frame');
  step(1);step(1,{jump:true});
  check(!s.discovery_active&&!s.discovery_item.visible&&s.rifle.visible,'Confirmation did not restore gameplay');
  check(s.notice===s.discovery_help&&s.notice_ticks>0,'Instructions vanish after dismissal');
  step(2,{jump:true});check(s.player.z===z,'Confirmation leaked into a jump');
 }
 __starfallLaunch();g.invoke('claim_boss_container',['rootheart']);
 check(s.discovery_active&&s.discovery_item.model==='sf/health_container'&&s.max_health===5,'Boss reward did not celebrate');
 step(150);check(!s.discovery_active&&s.max_health===5,'Timed reveal did not finish');
 g.invoke('claim_boss_container',['rootheart']);check(!s.discovery_active&&s.max_health===5,'Repeated boss reward replayed reveal');
 g.invoke('begin_discovery',['jets','sf/jets']);step(10);g.invoke('advance');check(s.discovery_active,'Enter skipped the initial lift');
 step(26);g.invoke('advance');check(!s.discovery_active,'Enter cannot confirm discovery');
 g.invoke('begin_discovery',['jets','sf/jets']);g.paused=true;g.invoke('return_to_title');
 check(!s.discovery_active&&!s.discovery_item.visible,'Reset left a frozen discovery');
 __starfallLaunch();return true;
})()
