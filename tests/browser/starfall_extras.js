// Optional routes use real movement and hatch inputs after staging their entrance gear.
(() => {
  const g=__RunePixel3D,s=g.app.state;
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const t=(n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
  function move(x){let i=0;while(Math.abs(s.player.x-x)>.2&&i++<400&&s.recovery_phase==='none')t(1,{right:s.player.x<x,left:s.player.x>x});t(5);check(i<400&&s.recovery_phase==='none','Optional route blocked before '+x);}
  function land(z){let i=0;while((!s.grounded||Math.abs(s.player.z-z)>.01)&&i++<180&&s.recovery_phase==='none')t(1);check(i<180&&Math.abs(s.player.z-z)<.01,'Optional landing failed at '+z+' / actual '+s.player.z);}
  function climb(){t(1,{right:true,jump:true});t(10,{right:true});t(1,{right:true,jump:true});t(10,{right:true});}
  function dashGap(){t(1,{right:true,jump:true});t(10,{right:true});t(1,{right:true,jump:true});t(1,{right:true,dash:true});t(32,{right:true});}
  __starfallLaunch();
  check(!s.ui.map&&s.campaign.rooms.dock&&s.pause_ui.map.expanded,'Map must appear only in pause HUD');
  const beforeMap=s.ticks;
  g.paused=true;t(3,{right:true,fire:true});check(s.ticks===beforeMap,'World advanced while viewing pause map');
  check(g.frame().every(p=>(p>>>24)===255),'Pause map frame invalid');g.paused=false;
  s.player.x=33;s.player.z=10;s.jets=true;s.enemies=[];
  t(1,{use:true});check(s.sector_id==='station','Archive admitted pilot without dash');t(1);
  s.dash_unlocked=true;s.plasma=true;t(1,{use:true});t(1);
  check(s.sector_id==='archive','Archive hatch did not load');
  move(17);climb();land(7);move(24);dashGap();land(7);move(43);climb();land(11);move(51);
  check(s.campaign.capacitor&&s.charge_duration===18,'Archive upgrade missing');
  check(g.frame().every(p=>(p>>>24)===255),'Invalid archive frame');
  t(1,{use:true});t(1);check(s.sector_id==='station'&&s.player.z===10,'Archive return lost upper-deck entrance');
  t(18,{fire:true});check(s.charge_ready,'Capacitor did not shorten charge');t(1);check(s.shots.some(shot=>shot.charged),'Upgraded plasma did not fire');
  s.player.x=74;s.player.z=3;s.glove_unlocked=true;s.foundry_cleared=true;
  t(1,{use:true});t(1);check(s.sector_id==='observatory','Observatory hatch missing');
  move(12);t(1,{use:true});t(1);check(s.gravity_low,'Observatory gravity console failed');
  move(13);t(1,{right:true,jump:true});t(18,{right:true});t(1,{right:true,jump:true});t(16,{right:true});land(11);
  move(24);dashGap();land(11);move(43);climb();land(15);move(51);
  check(s.campaign.armor&&s.max_health===6&&s.health===6,'Armor capacity missing');
  check(g.frame().every(p=>(p>>>24)===255),'Invalid observatory frame');
  move(61.8);land(3);move(63);t(1,{use:true});t(1);check(!s.gravity_low,'Arena gravity console missing');
  check(s.checkpoint.x===63,'Optional arena needs a beacon');move(68);
  const bossPhases=new Set();let fireClock=0;
  for(let i=0;i<1800&&s.curator.visible&&s.recovery_phase==='none';i++){
    const cycle=s.curator_clock%200,input={fire:fireClock++%28!==27};
    if(cycle>=40&&cycle<65&&s.player.x<72.5)input.right=true;
    if(cycle>=78&&cycle<108&&s.player.x>68)input.left=true;
    const incoming=s.shots.filter(shot=>shot.hostile&&shot.x>s.player.x&&shot.x-s.player.x<5);
    input.duck=incoming.some(shot=>shot.z>4);
    input.jump=s.grounded&&incoming.some(shot=>shot.z<4&&shot.x-s.player.x<3.5);
    g.step(input);
    if(!bossPhases.has(s.curator_phase)){bossPhases.add(s.curator_phase);g.frame();}
    if(s.curator.visible){check(s.ui.meters.some(m=>m.label==='VOID CURATOR'&&m.value===s.curator.hp),'Optional boss meter missing');check(s.music_track==='sf_curator','Optional boss music missing');}
  }
  check(!s.curator.visible&&s.campaign.curator&&s.campaign.containers.curator,'Optional boss was not defeated');
  check(s.max_health===7&&s.health===7&&s.lives===3+s.life_rewards,'Optional boss reward or survival failed');
  check(bossPhases.has('focus')&&bossPhases.has('open')&&bossPhases.has('shield'),'Optional boss phases missing');
  move(90);t(1,{use:true});t(1);
  check(s.sector_id==='station'&&!s.gravity_low&&Math.abs(s.player.x-74)<.1,'Observatory return failed');
  check(s.campaign.rooms.archive&&s.campaign.rooms.observatory,'Optional rooms absent from exploration save');
  g.invoke('start');g.invoke('advance');t(108);check(s.max_health===7&&s.charge_duration===18,'Saved optional gear lost on restart');
  __starfallLaunch();s.enemies=[s.enemies[0]];
  const enemy=s.enemies[0];enemy.home=15;enemy.x=15;enemy.span=0;enemy.cooldown=0;enemy.targeting=false;
  t(1);check(enemy.model==='sf/drone_charge'&&!s.shots.some(shot=>shot.hostile),'Drone fired without warning');
  t(22);check(!s.shots.some(shot=>shot.hostile),'Drone telegraph shorter than warning window');
  t(1);check(s.shots.some(shot=>shot.hostile),'Telegraphed shot missing');
  g.invoke('take_damage',[1,s.player.x-4]);check(s.ui.damageDirection===-1,'Left damage cue missing');
  s.invulnerable=0;g.invoke('take_damage',[1,s.player.x+4]);check(s.ui.damageDirection===1,'Right damage cue missing');
  __starfallLaunch();
  return true;
})()
