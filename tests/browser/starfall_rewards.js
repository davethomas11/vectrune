// Actual boss death hooks award unique persistent cells; four optional ledges provide extra lives.
(() => {
 const g=__RunePixel3D,s=g.app.state,check=(ok,message)=>{if(!ok)throw Error(message);};
 __starfallLaunch();check(s.health===4&&s.max_health===4,'Fresh expedition must start with four health');
 g.invoke('build_hydroponics');s.rootheart.hp=1;s.root_phase='open';g.invoke('hit_rootheart',[1,66,4]);
 check(s.max_health===5&&s.health===5&&s.campaign.containers.rootheart,'Rootheart did not award a cell');
 g.invoke('build_foundry');s.forge_guardian.hp=1;s.forge_phase='vent';g.invoke('hit_iron_cantor',[1,88,4]);
 check(s.max_health===6&&s.campaign.containers.cantor,'Cantor did not award a cell');
 g.invoke('build_station');s.boss.hp=1;g.invoke('hit_warden',[1,114,4]);
 check(s.max_health===7&&s.campaign.containers.warden,'Warden did not award a cell');
 g.invoke('build_bonus_room',['observatory']);s.curator.hp=1;s.curator_phase='open';g.invoke('hit_curator',[1,81,4]);
 check(s.max_health===8&&s.campaign.curator&&s.campaign.containers.curator,'Curator did not award a cell');
 s.player.x=51;s.player.z=15;g.invoke('update_exploration');g.invoke('refresh_ui');
 check(s.max_health===10&&s.health===10,'Armor must add to boss-earned containers');
 check(g.frame().every(pixel=>(pixel>>>24)===255),'Expanded health HUD did not render');
 for(const key of ['rootheart','cantor','warden','curator'])g.invoke('claim_boss_container',[key]);
 check(s.max_health===10,'Boss cells can be farmed');g.start();check(s.max_health===10,'New expedition lost boss cells');
 __starfallLaunch();s.enemies=[];s.player.x=73;s.player.z=11;g.invoke('update_exploration');
 check(s.lives===4&&s.life_rewards===1&&s.life_pickups.containment,'1-UP did not grant an extra life');
 g.invoke('build_station');check(!s.pickups.find(p=>p.key==='containment').visible,'Area revisit respawned a claimed life');
 __starfallLaunch();
 const areas=new Set();
 for(const [action,args,keys] of [
  ['build_station',[],['containment']],['build_hydroponics',[],['hydroponics']],['build_foundry',[],['foundry']],
  ['build_bonus_room',['archive'],['archive']],['build_bonus_room',['observatory'],[]],
  ['enter_upgrade_vault',['jets'],[]],['enter_upgrade_vault',['dash'],[]]]){
  g.invoke(action,args);
  check(s.pickups.filter(p=>p.kind==='oneup').length===keys.length,'Unexpected extra-life count in '+s.sector_id);
  for(const key of keys){
   const life=s.pickups.find(p=>p.kind==='oneup'&&p.key===key);
   check(life?.visible,'Missing area 1-UP: '+key);areas.add(key);
   const z=Math.floor(life.base-.7),i=(z*s.world.height+7)*s.world.width+Math.floor(life.x);
   check(s.world.cells[i]!==0,'Unsupported 1-UP: '+key);
  }
 }
 check(areas.size===4,'Expedition must have exactly four optional lives');
 s.campaign={hydroponics:true,foundry:true,finished:false};g.invoke('initialize');
 check(s.max_health===6&&s.campaign.containers.rootheart&&s.campaign.containers.cantor,'Legacy sector save did not receive earned health');
 __starfallLaunch();return true;
})()
