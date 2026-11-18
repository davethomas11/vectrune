// Crouch changes combat height, not invulnerability; terrain bounds protect all patrol types.
(() => {
  const g=__RunePixel3D,s=g.app.state;
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const t=(n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
  function leap(){
    __starfallLaunch();s.enemies=[];s.player.x=110;s.player.z=3;s.grounded=true;
    s.boss_clock=119;s.boss.launch=110;s.boss.target=110;s.boss_phase='leap';
  }
  leap();t(1);check(s.health===s.max_health-1,'Standing pilot did not intersect descending Warden');
  leap();t(1,{duck:true});
  check(s.health===s.max_health&&s.ducking&&s.body_height===.85,'Ducking did not clear the Warden leap');
  check(s.avatar.model==='sf/pilot_duck'&&s.rifle.z<s.player.z,'Crouch pose/rifle missing');
  check(g.frame().every(p=>(p>>>24)===255),'Invalid duck frame');
  s.boss.visible=false;
  g.invoke('enemy_shot',[s.player.x,4.2,0,0]);t(1,{duck:true});
  check(s.health===s.max_health,'Head-height projectile hit the crouched pilot');
  t(1,{duck:true,fire:true});
  check(s.shots.some(shot=>!shot.hostile&&Math.abs(shot.z-(s.player.z+.45))<1e-8),'Ducking fire/muzzle height differs');
  g.invoke('enemy_shot',[s.player.x,3.5,0,0]);t(1,{duck:true});
  check(s.health===s.max_health-1,'Ducking incorrectly avoided a ground-level attack');
  t(1,{duck:true,jump:true});check(!s.ducking&&s.body_height===1.6&&s.player.z>3,'Jump did not release duck');
  t(1,{duck:true});check(!s.ducking,'Pilot ducked in midair');
  __starfallLaunch();t(1,{duck_axis:1});check(s.ducking,'Controller down axis did not duck');
  t(1);check(!s.ducking&&s.body_height===1.6,'Ducking stuck after release');
  // Sweep full patrol cycles in each authored sector and check the entire enemy envelope.
  for(const sector of ['station','hydroponics','foundry']){
    __starfallLaunch();s.jets=true;s.plasma=true;s.garden_cleared=true;
    if(sector!=='station'){s.player.x=sector==='foundry'?69:52;t(1,{use:true});}
    const patrols=s.enemies;s.invulnerable=100000;s.player.x=sector==='station'?35:6;
    for(let tick=0;tick<180;tick++){
      t(1);
      for(const enemy of patrols){
        if(!enemy.visible)continue;
        g.invoke('enemy_space',[enemy,enemy.x,enemy.z]);
        check(enemy.space_clear,`${sector} ${enemy.kind||'drone'} entered terrain at ${enemy.x},${enemy.z}`);
      }
    }
  }
  __starfallLaunch();s.enemies=[];
  g.invoke('escape_enemy',['hunter',60,4,2]);
  const hunter=s.enemies[0];g.invoke('move_enemy',[hunter,65,4]);
  check(hunter.x<61,'Hunter tunneled through the violet wall');
  g.invoke('escape_enemy',['crawler',28,3.7,2]);
  const crawler=s.enemies[1];g.invoke('move_enemy',[crawler,21,3.7]);
  check(crawler.x>=26.65,'Crawler walked off the cargo platform');
  g.invoke('enemy_space',[hunter,hunter.x,hunter.z]);check(hunter.space_clear,'Hunter clipped its wings into wall');
  __starfallLaunch();check(!s.ducking&&s.body_height===1.6,'Restart retained crouch');
  return true;
})()
