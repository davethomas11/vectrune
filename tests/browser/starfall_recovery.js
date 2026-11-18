// Recovery fixtures exercise presentation and lifecycle independently of the route.
(() => {
  const g = __RunePixel3D, s = g.app.state;
  function check(ok, message) { if (!ok) throw Error(message); }
  function frame() {
    check(g.frame().every(p => (p >>> 24) === 255), 'Invalid recovery frame');
  }
  function ticks(n) { for (let i = 0; i < n; i++) g.step({right:true,fire:true,jump:true}); }
  function fixture() {
    __starfallLaunch(); s.player.x = 58; s.camera.x = 58; s.checkpoint = {x:35,z:3};
    s.enemies = []; s.jets = true; s.plasma = true; s.core = true;
  }
  fixture();
  g.invoke('take_damage', [2]);
  check(s.health === 2 && s.player.x === 58 && s.recovery_phase === 'none', 'Ordinary hit teleported the pilot');
  check(s.ui.meters[0].value === 2 && s.ui.meters[0].icon === 'sf/life_critical', 'Life bar missed critical damage');
  frame();
  fixture(); g.invoke('take_damage', [6]);
  check(s.health === 0 && s.recovery_phase === 'collapse', 'Death did not begin collapse');
  check(s.ui.panel === null && s.title_hidden && !s.touch_ready, 'Death opened a blocking game-over menu');
  const enemyClock = s.boss_clock;
  ticks(7); check(s.avatar.model === 'sf/pilot_down0', 'Kneeling death pose missing'); frame();
  ticks(11); check(s.avatar.model === 'sf/pilot_down1' && s.avatar.dissolve > 0, 'Suit did not collapse and dissolve'); frame();
  check(s.player.x === 58 && s.shots.length === 0, 'Controls moved or fired during collapse');
  ticks(6);
  check(s.ghost.visible && !s.avatar.visible && s.recovery_phase === 'return', 'Ghost did not emerge');
  const origin = s.ghost.x;
  ticks(20);
  check(s.ghost.x < origin && s.ghost.x > 35, 'Ghost did not travel toward beacon');
  check(s.camera.x > 35 && s.camera.x < 58, 'Camera snapped to beacon'); frame();
  g.invoke('advance');
  check(s.recovery_phase === 'return', 'Enter skipped recovery');
  const pausedTicks = s.recovery_ticks, pausedX = s.ghost.x;
  g.paused = true; ticks(10);
  check(s.recovery_ticks === pausedTicks && s.ghost.x === pausedX, 'Pause failed to freeze ghost');
  g.paused = false;
  let count = 0, previousCamera = s.camera.x, reformSeen = false;
  while (s.recovery_phase !== 'none' && count++ < 140) {
    g.step({right:true,fire:true,jump:true});
    check(Math.abs(s.camera.x - previousCamera) < 1.5, 'Recovery camera jumped');
    previousCamera = s.camera.x;
    if (s.recovery_phase === 'reform' && !reformSeen) {
      reformSeen = true;
      check(s.player.x === 35 && !s.ghost.visible && s.avatar.dissolve > 0, 'Suit did not reform at beacon'); frame();
    }
  }
  check(count < 140 && reformSeen && s.health === s.max_health, 'Automatic recovery did not finish');
  check(s.jets && s.plasma && s.core && s.boss_clock === enemyClock, 'Death changed equipment or advanced combat');
  check(s.player.x === 35 && s.player.z === 3 && s.avatar.dissolve === 0, 'Wrong return location or lingering dissolve');
  check(s.invulnerable > 0 && s.touch_ready, 'Pilot resumed without protection or controls'); frame();
  __starfallLaunch();
  check(s.recovery_phase === 'none' && !s.ghost.visible && s.health === s.max_health, 'New run retained recovery state');
  return true;
})()
