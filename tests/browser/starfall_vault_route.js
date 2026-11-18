// Both upgrades must be recovered by descending and jumping onto a solid pedestal.
(() => {
 globalThis.__starfallUpgradeVaultRoute=kind=>{
  const g=__RunePixel3D,s=g.app.state;
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  function t(n,input={}){for(let i=0;i<n;i++)g.step(input);}
  function move(x){let i=0;while(Math.abs(s.player.x-x)>.2&&i++<400&&s.recovery_phase==='none')t(1,{left:s.player.x>x,right:s.player.x<x,fire:true});t(5);check(i<400&&s.recovery_phase==='none','Vault route blocked at '+x);}
  function land(z){let i=0;while((!s.grounded||Math.abs(s.player.z-z)>.01)&&i++<120&&s.recovery_phase==='none')t(1,{fire:true});check(i<120&&s.player.z===z,'Vault landing failed at '+z);}
  const unlocked=()=>kind==='jets'?s.jets:s.dash_unlocked;
  check(s.sector_id===(kind==='jets'?'jet_vault':'dash_vault')&&!unlocked(),'Upgrade granted before tunnel descent');
  check(s.player.z===13&&s.world.width===56,'Vault did not extend below the entrance');
  check(s.world.depth===24,'Vault needs room above its raised ceilings');
  for(let step=0;step<6;step++){
   const x=7+step*6,top=13-step*2;
   for(let z=top;z<top+7;z++)check(s.world.cells[(z*s.world.height+7)*s.world.width+x]===0,'Tunnel jump headroom blocked');
  }
  check(Math.abs(s.enemies[0].home-s.pickups[0].x)>=14&&s.enemies[0].hp<=2,'Guard crowds the upgrade pedestal');

  move(42.5);land(3);check(!unlocked(),'Upgrade was collected before the pedestal');
  check(s.world.cells[(3*s.world.height+7)*s.world.width+45]!==0,'Pedestal has no solid collision');
  t(1,{right:true,jump:true,fire:true});t(13,{right:true,fire:true});t(20,{fire:true});land(4);move(45.5);
  check(unlocked()&&s.health>0&&s.lives===3+s.life_rewards,'Pedestal upgrade missing or life lost');
  check(g.frame().every(p=>(p>>>24)===255),'Invalid upgrade chamber frame');
  move(51);land(3);t(1,{use:true});t(1);
  check(s.sector_id===(kind==='jets'?'station':'hydroponics'),'Lift did not restore original area');
  check(s.upgrade_snapshot===null&&s.player.z===(kind==='jets'?3:17),'Lift left stale room state');
  check(!s.pickups[0].visible,'Old surface upgrade remained visible');
  return true;
 };
 return true;
})()
