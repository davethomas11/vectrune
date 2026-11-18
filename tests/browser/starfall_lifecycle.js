// Real cinematic ticks and three complete life-loss cycles in browser and QuickJS.
(() => {
  const g=__RunePixel3D,s=g.app.state;
  function check(ok,message){if(!ok)throw Error(message);}
  function ticks(n,input={}){for(let i=0;i<n;i++)g.step(input);}
  function frame(){check(g.frame().every(p=>(p>>>24)===255),'Invalid cinematic/lives frame');}
  function recover(){let i=0;while(s.recovery_phase!=='none' && i++<180)g.step({});check(i<180,'Recovery did not finish');}
  function die(){s.invulnerable=0;g.invoke('take_damage',[6]);}
  g.start();
  check(s.status==='intro','New expedition did not begin its opening flight');g.invoke('advance');
  check(s.status==='landing' && s.lives===3+s.life_rewards && !s.avatar.visible,'Landing did not begin');frame();
  ticks(24,{right:true,fire:true,jump:true});
  check(s.player.x===9 && s.ship.z<15 && !s.shots.length,'Landing accepted gameplay inputs');frame();
  const landing=s.cinematic_ticks;g.paused=true;ticks(10);check(s.cinematic_ticks===landing,'Pause advanced landing');g.paused=false;
  g.invoke('advance');check(s.status==='landing','Enter restarted landing');
  ticks(48);check(s.ship.z===3 && s.avatar.visible,'Pilot did not disembark');frame();
  ticks(36);check(s.status==='playing' && s.touch_ready,'Landing did not unlock controls');

  s.enemies=[];s.player.x=110;s.player.z=3;s.camera.x=110;s.camera.z=6;s.checkpoint={x:90,z:8};
  s.jets=true;s.plasma=true;s.boss.hp=12;s.boss_clock=161;s.boss_phase='exposed';
  die();
  check(s.lives===2 && s.boss.hp===48 && s.boss.x===114 && s.boss_clock===0 && s.boss_phase==='dormant','Death did not refill/reset Warden');
  recover();check(s.lives===2 && s.jets && s.plasma && s.player.x===90,'First life did not preserve equipment/checkpoint');
  s.player.x=98;s.player.z=3;g.step({});
  check(s.boss.hp===48 && s.music_track==='sf_warden','Retry did not start a fresh boss fight');
  die();check(s.lives===1,'Second death did not consume a life');recover();
  die();check(s.lives===0 && s.recovery_phase==='collapse','Third death skipped collapse');
  ticks(24);
  check(s.status==='gameover' && !s.ghost.visible && !s.touch_ready && !s.title_hidden,'Final death did not open game-over screen');
  check(s.ui.heading==='GAME OVER' && s.ui.panel!==null && s.music_track==='','Game-over presentation missing');frame();
  ticks(10,{fire:true,right:true});check(s.status==='gameover','Held inputs dismissed game over');
  g.invoke('advance');check(s.status==='intro','New expedition did not restart its story');g.invoke('advance');
  check(s.status==='landing' && s.lives===3+s.life_rewards && s.health===s.max_health,'New expedition did not restore lives');
  check(!s.jets && !s.plasma && !s.core && !s.gate_open && s.checkpoint.x===9 && s.enemies.length===6,'New expedition retained run progress');

  __starfallLaunch();s.enemies=[];s.core=true;s.boss.visible=false;g.step({});
  check(s.status==='departing','Core return did not start boarding');
  g.invoke('advance');check(s.status==='departing','Enter skipped departure');
  ticks(15,{right:true,fire:true,jump:true});check(s.player.x===9 && !s.shots.length,'Boarding accepted gameplay input');frame();
  ticks(15);check(!s.avatar.visible && s.ship_flames.length===2,'Pilot did not board / engines did not ignite');
  const departure=s.cinematic_ticks;g.paused=true;ticks(10);check(s.cinematic_ticks===departure,'Pause advanced takeoff');g.paused=false;
  ticks(45);check(s.ship.z>7 && s.ship.x<7 && s.status==='departing','Ship did not lift off');frame();
  ticks(45);check(s.status==='ending','Homecoming did not begin');g.invoke('advance');check(s.status==='credits','Credits did not begin');g.invoke('advance');check(s.status==='won' && !s.ship.visible && s.music_track==='','Victory shown before ship escaped');frame();
  return true;
})()
