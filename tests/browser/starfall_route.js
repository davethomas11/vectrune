// Shared by browser and native QuickJS tests. Progress uses only game inputs.
(() => {
  const g = __RunePixel3D, s = g.app.state, route = [];
  __starfallLaunch();
  let fireTicks = 0;
  function ticks(n, input = {}) {
    for (let i = 0; i < n; i++) {
      const actual = {...input};
      // Hold a full charge through cooldown, then release through the input API.
      if(s.plasma && input.fire) actual.fire = fireTicks++ % 35 !== 34;
      else fireTicks = 0;
      g.step(actual);
    }
  }
  function check(condition, message) { if (!condition) throw Error(message); }
  function capture(label) {
    check(s.health > 0 && s.lives === 3+s.life_rewards && s.player.y === 7, 'Life lost or plane escape at ' + label);
    check(g.frame().every(pixel => (pixel >>> 24) === 255), 'Invalid frame at ' + label);
    route.push({label, x:s.player.x, z:s.player.z});
  }
  function move(x) {
    let count = 0;
    while (Math.abs(s.player.x - x) > .25 && s.status === 'playing' && count++ < 500) {
      ticks(1, {left:s.player.x > x, right:s.player.x < x, fire:true});
    }
    ticks(5);
    check(count < 500, 'Route blocked before x=' + x);
  }
  function gap(right) {
    ticks(25, {right, left:!right, jump:true, fire:true});
    ticks(12, {fire:true});
  }
  function climb(leftTicks, settleTicks) {
    ticks(1, {left:true, jump:true, fire:true});
    ticks(10, {left:true, fire:true});
    ticks(1, {left:true, jump:true, fire:true});
    ticks(leftTicks, {left:true, fire:true});
    ticks(settleTicks, {fire:true});
  }
  move(22); gap(true); move(49);
  check(s.sector_id==='station','Crypt must wait for USE');ticks(1,{use:true});ticks(1);
  __starfallUpgradeVaultRoute('jets');
  check(s.jets && !s.plasma && s.checkpoint.x === 35, 'Jump jets or cargo beacon missing');
  capture('cargo');
  __starfallGardenRoute(); move(49);
  climb(10, 26); check(s.player.z === 7, 'Jet ledge unreachable');
  move(42); climb(27, 18); check(s.player.z === 10, 'Middle ledge unreachable');
  climb(27, 18); check(s.player.z === 13, 'Upper ledge unreachable');
  move(22);
  ticks(1, {left:true, jump:true, fire:true}); ticks(10, {left:true, fire:true});
  ticks(1, {left:true, jump:true, fire:true}); ticks(1, {left:true, dash:true, fire:true});
  ticks(32, {left:true, fire:true}); ticks(20, {fire:true}); move(6);
  check(s.plasma, 'Plasma upgrade unreachable'); capture('plasma');
  move(10); ticks(55, {fire:true}); move(22); gap(true); move(60);
  ticks(40,{fire:true}); ticks(4);
  ticks(20, {right:true, fire:true}); check(s.gate_open, 'Plasma failed to breach seal');
  capture('seal');
  __starfallFoundryRoute(); move(69);
  move(74); gap(true); move(81);
  ticks(20,{right:true,jump:true,fire:true}); ticks(15,{fire:true});
  check(s.player.z === 5,'Vestibule step unreachable');
  ticks(1,{right:true,jump:true,fire:true}); ticks(10,{right:true,fire:true});
  ticks(1,{right:true,jump:true,fire:true}); ticks(10,{right:true,fire:true}); ticks(28,{fire:true});
  check(s.player.z === 8,'Temple overlook unreachable');
  move(90); check(s.checkpoint.x === 90,'Temple beacon not linked');
  move(98); check(s.player.z === 3,'Sanctuary descent failed');
  check(!s.core && !s.pickups[2].visible, 'Core exposed before guardian defeated');
  const phases = new Set(), positions = [];
  for (let i = 0; i < 1200 && s.boss.visible && s.status === 'playing'; i++) {
    ticks(1, {fire:true, jump:s.boss_clock > 36 && (s.boss_clock-36) % 240 === 102});
    if (s.boss.visible && !phases.has(s.boss_phase)) {
      phases.add(s.boss_phase);
      check(g.frame().every(pixel => (pixel >>> 24) === 255), 'Invalid boss phase '+s.boss_phase);
    }
    positions.push(s.boss.x);
    if (s.boss.visible) {
      check(s.music_track === "sf_warden", "Boss music missing during fight");
      const meter = s.ui.meters.find(m => m.label === 'CRYPT WARDEN');
      check(meter?.display === 'bar' && meter.value === s.boss.hp, 'Guardian life bar out of sync');
    }
  }
  for (const phase of ['awakening','patrol','windup','leap','slam','exposed','recover']) {
    check(phases.has(phase), 'Boss phase never reached: '+phase);
  }
  check(Math.max(...positions)-Math.min(...positions)>8,'Guardian did not move across sanctuary');
  check(!s.boss.visible && s.boss.hp === 0, 'Guardian fight failed');
  check(s.discovery_active, 'Warden health reward should celebrate');
  ticks(150);
  check(s.music_track === 'sf_orbit', 'Exploration music not restored'); capture('warden');
  move(121); ticks(14,{right:true,jump:true,fire:true}); ticks(20,{fire:true}); move(124); check(s.core && s.status === 'playing', 'Core must be carried home');
  move(97);
  ticks(18,{left:true,jump:true,fire:true}); ticks(18,{fire:true});
  check(s.player.z === 5,'Crypt exit step unreachable');
  ticks(1,{left:true,jump:true,fire:true}); ticks(10,{left:true,fire:true});
  ticks(1,{left:true,jump:true,fire:true}); ticks(3,{left:true,fire:true}); ticks(32,{fire:true});
  check(s.player.z === 8,'Crypt return ascent unreachable');
  move(79); gap(false); move(27); gap(false); move(9);
  check(s.status === 'departing', 'Ship did not begin takeoff');
  check(s.escape_active && s.return_encounters.every(e=>e.fired), 'Return encounters did not all trigger');
  check(s.enemies.filter(e=>e.kind==='hunter').length===3 && s.enemies.filter(e=>e.kind==='crawler').length===3,'Return enemy roster incorrect');

  ticks(120);
  check(s.status === 'ending', 'Return route did not begin homecoming');g.invoke('advance');g.invoke('advance');
  check(s.status === 'won', 'Return route did not finish expedition'); capture('home');
  return route;
})()
