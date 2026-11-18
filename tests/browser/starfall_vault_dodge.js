// The spacious approach allows either guard to be jumped without firing or taking damage.
(() => {
 const g=__RunePixel3D,s=g.app.state;
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const t=(n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
 for(const kind of ['jets','dash']){
  __starfallLaunch();
  if(kind==='dash'){s.jets=true;s.player.x=52;g.step({use:true});g.step({});}
  g.invoke('enter_upgrade_vault',[kind]);
  let i=0;
  while(s.player.x<26&&i++<160)t(1,{right:true});
  check(i<160&&s.player.z===7,'Guard approach not reachable');
  t(1,{right:true,jump:true});t(32,{right:true});t(8);
  check(s.health===s.max_health&&s.lives===3+s.life_rewards&&s.recovery_phase==='none','Tunnel guard cannot be evaded safely');
  check(s.player.x>33&&s.enemies[0].visible,'Guard evasion must work without killing it');
 }
 __starfallLaunch();
 return true;
})()
