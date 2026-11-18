// Return-trip enemies: real Warden death hook, one-shot waves, attacks and damage.
(() => {
  const g=__RunePixel3D,s=g.app.state;
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const t=(n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
  const frame=()=>check(g.frame().every(p=>(p>>>24)===255),'Invalid return-enemy frame');
  __starfallLaunch();s.enemies=[];s.boss.hp=1;
  g.invoke('hit_warden',[1,114,4]);
  check(s.escape_active&&s.return_encounters.length===3,'Warden did not arm return encounters');
  t(150); // Let the health-container discovery finish before continuing.
  s.player.x=109;t(1);check(s.enemies.length===0,'Enemies appeared before retrieving the core');
  s.player.x=124;s.player.z=4;t(1);check(s.core,'Core pickup failed');t(150);
  s.player.x=115;s.player.z=3;s.invulnerable=10000;t(1);
  check(s.enemies.length===2&&s.return_encounters[0].fired,'Crypt return encounter missing');
  const hunter=s.enemies[0],crawler=s.enemies[1];
  check(hunter.kind==='hunter'&&crawler.kind==='crawler','New enemy types missing');
  check(hunter.phase==='windup','Hunter did not telegraph its lunge');frame();
  const hx=hunter.x;t(28);
  check(hunter.phase==='lunge'&&hunter.x>hx,'Hunter did not lunge toward the pilot');frame();
  t(38);check(crawler.phase==='charge','Crawler did not telegraph its shot');frame();
  t(28);check(s.shots.some(shot=>shot.hostile&&shot.z===3.55),'Crawler low bolt missing');
  const clock=hunter.clock;g.paused=true;t(20);g.paused=false;
  check(hunter.clock===clock,'Paused return enemies kept moving');
  s.player.x=73;t(1);check(s.enemies.length===4,'Containment wave missing');
  s.player.x=45;t(1);check(s.enemies.length===6,'Cargo wave missing');
  t(3);check(s.enemies.length===6,'Return waves spawned repeatedly');
  s.invulnerable=0;g.invoke('take_damage',[6]);t(180);
  check(s.lives===2+s.life_rewards&&s.recovery_phase==='none','Return-trip death did not recover');
  check(s.escape_active&&s.core&&s.return_encounters.every(e=>e.fired),'Death reset return progression');
  s.player.x=45;t(1);check(s.enemies.length===6,'Ghost return duplicated reinforcements');
  for(const kind of ['hunter','crawler']){
    __starfallLaunch();s.enemies=[];s.player.x=110;s.facing=-1;s.plasma=true;
    g.invoke('escape_enemy',[kind,105,kind==='hunter'?4:3.7,0]);
    const enemy=s.enemies[0];
    t(1,{fire:true});t(1);
    for(let i=0;i<10&&enemy.hit_ticks===0;i++)t(1);
    check(enemy.hit_ticks>0&&enemy.model===`sf/${kind}_hit`,'Missing '+kind+' damage flash');frame();
    t(8);t(1,{fire:true});t(1);t(10);
    check(!enemy.visible&&s.effects.length>0,'Missing '+kind+' death particles');frame();
  }
  __starfallLaunch();
  check(!s.escape_active&&s.return_encounters.length===0&&!s.enemies.some(e=>e.kind==='hunter'||e.kind==='crawler'),'Restart retained return enemies');
  return true;
})()
