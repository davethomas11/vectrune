// Shared title, locked selector, death presentation, and save setup fixture.
(() => {
  const g=__RunePixel3D,s=g.app.state;
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  check(s.status==='title' && s.level_count===6,'Title did not initialize');
  const camera=g.renderState().camera;
  for(let i=0;i<30;i++)g.step({});
  const moving=g.renderState().camera;
  check(Math.hypot(camera.x-moving.x,camera.y-moving.y)>.1,'Title camera is static');
  check(g.frame().every(p=>p>>>24===255),'Invalid title frame');
  g.invoke('open_selector');g.invoke('select_course',[6]);
  check(s.selection_locked && s.course_cards.length===6,'Locked course preview missing');
  g.invoke('advance');check(s.status==='level_select','Locked course started');
  g.invoke('select_course',[1]);g.invoke('advance');
  check(s.status==='playing','Unlocked course did not start');
  const text = g.raycaster.text;
  const captions = [];
  g.raycaster.text = value => captions.push(value);
  try {
    g.frame();
    g.step({charge:true});
    g.frame();
  } finally {
    g.raycaster.text = text;
  }
  check(s.charging && captions.length === 0,'Gameplay rendered text over the course');
  g.start();
  g.invoke('lose_life');
  check(s.lives===2 && s.death_timer===36 && s.fragments.length===24,'Death did not begin');
  for(let i=0;i<12;i++)g.step({right:true,charge:true,jump:true});
  check(s.player.x===3 && s.avatar.dissolve>.5 && s.charges_left===3,'Death allowed movement or charging');
  check(g.frame().every(p=>p>>>24===255),'Invalid shatter frame');
  const timer=s.death_timer;g.paused=true;g.step({});
  check(s.death_timer===timer,'Paused death kept advancing');
  g.paused=false;
  for(let i=0;i<24;i++)g.step({});
  check(s.death_timer===0 && s.avatar.dissolve===0 && s.avatar.scale===1 && s.fragments.length===0,'Respawn did not finish cleanly');
  s.player={x:s.goal.x,y:s.goal.y,z:s.goal.z,vx:0,vy:0,vz:0};g.step({});
  check(s.progress.unlocked===2 && s.progress.cleared===1,'Clear did not update saved progress');
  g.invoke('return_to_title');g.invoke('open_selector');g.invoke('select_course',[2]);g.invoke('advance');
  check(s.level===2 && s.status==='playing' && s.charges_left===3,'Unlocked replay failed');
  return true;
})()
