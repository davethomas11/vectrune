// Input-only discovery, glove workshop, hanging carrier, gravity puzzle and Cantor.
(() => {
 globalThis.__starfallFoundryRoute=()=>{
  const g=__RunePixel3D,s=g.app.state,route=[];let fire=0;
  function check(ok,message){if(!ok)throw Error(message);}
  function t(n,input={}){for(let i=0;i<n;i++){const a={...input};if(input.fire)a.fire=fire++%35!==34;else fire=0;g.step(a);}}
  function capture(label){check(s.health>0&&s.lives===3+s.life_rewards,'Life lost in Foundry '+label);check(g.frame().every(p=>(p>>>24)===255),'Invalid Foundry frame');route.push({label,x:s.player.x,z:s.player.z});}
  function move(x){let i=0;while(Math.abs(s.player.x-x)>.25&&i++<400&&s.status==='playing'&&s.recovery_phase==='none')t(1,{right:s.player.x<x,left:s.player.x>x,fire:true});t(5);check(i<400&&s.recovery_phase==='none','Foundry route blocked at '+x);}
  function land(z){let i=0;while((Math.abs(s.player.z-z)>.01||!s.grounded)&&i++<160&&s.recovery_phase==='none')t(1,{fire:true});check(i<160&&Math.abs(s.player.z-z)<.01,'Failed landing at '+z);}
  move(69);t(1,{use:true});t(1);
  check(s.sector_id==='foundry'&&s.world.cells.length===40320,'Foundry hatch did not load sector');capture('furnace');
  check(!s.glove_unlocked&&!s.magnet_seen&&s.pickups[0].z>14,'Glove must be discovered above the entry');
  move(18.8);t(23,{right:true,jump:true,fire:true});t(15,{fire:true});move(24.8);
  check(s.magnet_seen&&!s.glove_unlocked,'Carrier must be encountered before the glove');capture('carrier discovery');
  check(s.world.cells[(12*s.world.height+7)*s.world.width+13]===0,'Workshop gate did not unlock');
  t(1,{left:true,jump:true,fire:true});t(10,{left:true,fire:true});t(1,{left:true,jump:true,fire:true});t(25,{left:true,fire:true});land(9);
  t(1,{left:true,jump:true,fire:true});t(10,{left:true,fire:true});t(1,{left:true,jump:true,fire:true});t(10,{left:true,fire:true});land(13);
  t(1,{left:true,jump:true,fire:true});t(9,{left:true,fire:true});land(14);
  check(s.glove_unlocked,'Workshop glove not collected');capture('glove workshop');move(24.8);

  let wait=0;while(s.shuttle.x>29.5&&wait++<400)t(1,{fire:true});check(wait<400,'Shuttle never returned');
  t(1,{right:true,jump:true,fire:true});t(14,{right:true,fire:true});t(10,{fire:true});
  check(s.on_shuttle&&s.magnet_fx.visible,'Glove failed to grab carrier');check(!s.grounded&&Math.abs(s.player.z-(s.shuttle.z-2.4))<.001&&s.avatar.model.startsWith('sf/pilot_hang'),'Hanging pose/attachment missing');capture('magnetic grip');
  const x=s.player.x;t(12,{fire:true});check(s.player.x!==x,'Shuttle did not carry pilot');
  const clock=s.foundry_clock,shuttleX=s.shuttle.x;g.paused=true;t(8);check(s.foundry_clock===clock&&s.shuttle.x===shuttleX,'Pause did not freeze machinery');g.paused=false;
  wait=0;while(s.shuttle.x<49.7&&wait++<400&&s.recovery_phase==='none')t(1,{fire:true});check(wait<400,'Shuttle failed to reach far dock');
  t(1,{right:true,jump:true,fire:true});t(24,{right:true,fire:true});land(5);check(!s.on_shuttle,'Jump did not release glove');capture('far dock');
  move(57);t(1,{use:true});t(2,{use:true});check(s.gravity_low,'Gravity console did not switch or debounced incorrectly');t(1);
  t(1,{right:true,jump:true,fire:true});t(18,{right:true,fire:true});t(1,{right:true,jump:true,fire:true});t(16,{right:true,fire:true});land(13);capture('upper gantry');
  move(69);move(81.5);land(3);t(1,{use:true});t(1);check(!s.gravity_low,'Arena console did not restore normal gravity');
  const phases=new Set();
  for(let i=0;i<850&&s.forge_guardian.visible&&s.recovery_phase==='none';i++){
   t(1,{fire:true,jump:s.forge_clock%180===76});
   if(!phases.has(s.forge_phase)){phases.add(s.forge_phase);g.frame();}
   if(s.forge_guardian.visible){const meter=s.ui.meters.find(m=>m.label==='IRON CANTOR');check(meter?.value===s.forge_guardian.hp,'Cantor life bar out of sync');check(s.music_track==='sf_iron_cantor','Cantor score missing');}
  }
  check(!s.forge_guardian.visible&&s.pickups[2].visible,'Iron Cantor fight failed');
  check(phases.has('guard')&&phases.has('vent'),'Cantor armor/vent cycle missing');capture('iron cantor');
  move(92);check(s.campaign.foundry&&s.foundry_cleared&&s.portals[1].visible,'Foundry relay did not bank sector');
  t(1,{use:true});t(1);
  check(s.sector_id==='station'&&Math.abs(s.player.x-58)<.1,'Foundry shortcut did not return to cargo');
  check(s.glove_unlocked&&s.plasma&&s.portals[3].visible,'Foundry shortcut lost saved gear');
  check(s.world.cells[(4*s.world.height+7)*s.world.width+78]===0,'Crypt bulkhead remained locked');capture('crypt access');
  return route;
 };
 return true;
})()
