// Focused presentation fixtures, separate from the input-only expedition route.
(() => {
  const g = __RunePixel3D, s = g.app.state;
  function check(ok, message) { if (!ok) throw Error(message); }
  function frame() {
    const pixels = g.frame();
    check(pixels.length === g.raycaster.width * g.raycaster.height && pixels.every(p => (p >>> 24) === 255), 'Invalid effects frame');
  }
  __starfallLaunch();
  g.step({aim_up:true, fire:true});
  check(s.avatar.model === 'sf/pilot_idle_up', 'Pilot did not raise arms');
  check(s.rifle.model === 'sf/rifle_up' && s.muzzle.x === s.player.x, 'Rifle/muzzle did not aim up');
  check(s.shots[0].dx === 0 && s.shots[0].dz > 0, 'Upward shot moved sideways');
  frame();
  const poses = new Set();
  for (let i = 0; i < 16; i++) {
    g.step({right:true});
    if (!poses.has(s.avatar.model)) { poses.add(s.avatar.model); frame(); }
  }
  check(poses.size === 4, 'Walk cycle did not use all four poses');
  g.step({left:true, aim_up:true}); frame();
  check(s.avatar.angle === 180 && s.rifle.angle === 180, 'Left aiming pose not mirrored');
  g.step({jump:true, aim_up:true}); frame();
  check(s.avatar.model === 'sf/pilot_air_up', 'Airborne aiming pose missing');

  __starfallLaunch();
  s.enemies = [{x:9,y:7,z:6,home:9,base:6,span:0,hp:3,hit_ticks:0,visible:true,model:'sf/drone',cooldown:200}];
  s.plasma = true;
  g.step({fire:true, aim_up:true}); g.step({aim_up:true}); g.step({aim_up:true});
  check(s.enemies[0].hp === 1 && s.enemies[0].model === 'sf/drone_hit', 'Drone hit flash missing');
  frame();
  for (let i = 0; i < 6; i++) g.step({aim_up:true});
  g.step({fire:true, aim_up:true}); g.step({aim_up:true}); g.step({aim_up:true});
  check(!s.enemies[0].visible && s.effects.length >= 18, 'Drone death debris missing');
  check(s.effects.some(p => p.kind === 'blast'), 'Expanding explosion missing');
  frame();
  const fragment = s.effects.find(p => p.kind === 'debris'), z = fragment.z;
  g.step({});
  check(fragment.z !== z, 'Death fragments did not animate'); frame();
  for (let i = 0; i < 32; i++) g.step({});
  check(s.effects.length === 0, 'Death fragments did not expire');
  g.invoke('take_damage', [1]); g.invoke('update_view');
  check(s.flash > 0 && s.avatar.model.endsWith('_hit') && s.avatar.visible, 'Player damage flash missing');
  frame();
  for (let i = 0; i < 12; i++) g.step({});
  check(s.flash === 0 && s.hurt_ticks === 0, 'Player damage flash did not clear');

  __starfallLaunch();
  s.player.x = 110; s.plasma = true; s.boss_clock = 161; s.boss.hp = 1;
  g.step({fire:true}); for (let i = 0; i < 4; i++) g.step({});
  check(!s.boss.visible && s.effects.length >= 44, 'Guardian death explosion missing'); frame();
  __starfallLaunch();
  check(s.effects.length === 0 && !s.aiming_up && s.flash === 0, 'New run retained presentation effects');
  return true;
})()
