// Charged weapon and seal presentation, using real fire inputs.
(() => {
  const g=__RunePixel3D,s=g.app.state;
  function check(ok,message){if(!ok)throw Error(message);}
  function frame(){check(g.frame().every(p=>(p>>>24)===255),'Invalid plasma/seal frame');}
  function fixture(){__starfallLaunch();s.enemies=[];s.player.x=58;s.camera.x=60;s.plasma=true;s.garden_cleared=true;}
  fixture();
  for(let i=0;i<12;i++)g.step({fire:true});
  check(s.charge_ticks===12 && s.shots.length===0 && s.charge_fx.visible,'Charge buildup missing');frame();
  for(let i=0;i<22;i++)g.step({fire:true});
  check(s.charge_ticks===24 && s.charge_ready && s.shots.length===0,'Charge did not cap without firing');frame();
  g.paused=true;g.step({});
  check(s.charge_ticks===24 && s.shots.length===0,'Pause released charged shot');g.paused=false;
  g.step({});
  check(s.shots[0]?.charged && s.shots[0].damage===6 && s.charge_ticks===0,'Release did not fire powered shot');frame();
  for(let i=0;i<8 && !s.gate_open;i++)g.step({});
  check(s.gate_open && s.seal_shell.visible && s.seal_shell.dissolve===0,'Seal vanished without its afterimage');frame();
  g.step({});check(s.seal_shell.x!==62.5,'Seal did not shake');
  for(let i=0;i<16;i++)g.step({});
  check(s.seal_shell.dissolve>0 && s.seal_shell.dissolve<1,'Seal did not dissolve gradually');frame();
  const age=s.seal_age;g.paused=true;g.step({});check(s.seal_age===age,'Paused seal kept dissolving');g.paused=false;
  for(let i=0;i<32;i++)g.step({});
  check(!s.seal_shell.visible && s.seal_shake===0,'Seal afterimage/shake did not finish');frame();
  fixture();s.player.x=61;
  g.step({fire:true});g.step({});
  check(!s.gate_open,'Uncharged plasma opened seal');
  for(let i=0;i<8;i++)g.step({});
  for(let i=0;i<24;i++)g.step({fire:true});
  g.invoke('take_damage',[6]);
  check(s.charge_ticks===0 && !s.charge_fx.visible && !s.fire_held,'Death retained charge');
  __starfallLaunch();check(!s.seal_shell.visible && !s.gate_open && s.charge_ticks===0,'Restart retained seal/charge state');
  return true;
})()
