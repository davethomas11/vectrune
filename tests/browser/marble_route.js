// Shared by QuickJS and Chromium. Complete the courses using only control inputs.
(() => {
  const g = __RunePixel3D, s = g.app.state;
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const a = 31 * Math.PI / 180;
  const point = distance => {
    const leg = s.route.find(p => distance >= p.s && distance <= p.s+p.length) || s.route.at(-1);
    const along = clamp(distance-leg.s,0,leg.length), angle = leg.angle*Math.PI/180;
    return {x:leg.x+Math.cos(angle)*along,y:leg.y+Math.sin(angle)*along,angle,leg};
  };
  const frame = () => {
    const pixels = g.frame();
    check(pixels.length === g.raycaster.width*g.raycaster.height, 'Framebuffer size');
    check(pixels.every(pixel => pixel >>> 24 === 255), 'Transparent frame');
  };
  const results = [], deaths = [];
  const step = input => {
    const before = {level:s.level,tick:s.ticks,s:s.course_s,player:{...s.player},lives:s.lives,input};
    g.step(input);
    if (s.lives < before.lives) deaths.push(before);
  };
  g.start();
  let chargedFrame = false, blastFrame = false;
  for (let level = 1; level <= s.level_count; level++) {
    const started = Date.now();
    const jumped = new Set(), spikeJumps = new Set(), headings = new Set();
    const blastTargets = [[0,1,2],[0,1,3],[0,1,3],[0,1,4],[0,2,4],[0,2,4]][level-1];
    check(s.level === level && s.charges_left === 3, 'Next course did not reset cells');
    for (let tick = 0; tick < 4000 && s.status === 'playing'; tick++) {
      headings.add(s.course_angle);
      if (s.charging) {
        step({});
        if (s.charge === s.charge_duration-1 && !chargedFrame) { frame(); chargedFrame = true; }
        if (s.blast_ticks === 18 && !blastFrame) { frame(); blastFrame = true; }
        continue;
      }
      const gap = s.gaps.find((p,i) => !jumped.has(i) && p.s >= s.course_s);
      const spike = s.spikes.find(p => Math.abs(p.across)<.9 && !spikeJumps.has(p.s) && p.s>s.course_s && p.s-s.course_s<2.8);
      const hazard = s.enemies.find((p,i) => !blastTargets.includes(i) && p.visible && p.dissolve===0 && p.s>s.course_s && p.s-s.course_s<3.1);
      const gapJump = gap && gap.s-s.course_s<1.3 && s.grounded;
      const spikeJump = spike && s.grounded;
      const enemyJump = hazard && s.grounded;
      const target = s.enemies.find((p,i) => blastTargets.includes(i) && p.visible && p.dissolve===0 && p.s>s.course_s);
      let speed = s.max_speed;
      const turn = s.waypoints.find(p => p.kind==='turn' && p.s>s.course_s && p.s-s.course_s<6);
      if (turn) speed = .17;
      if (target && target.s-s.course_s<8 && s.grounded) {
        speed = clamp((target.s-2.35-s.course_s)*.08,-.15,speed);
        const offset = Math.sin(((s.ticks+s.charge_duration-1)*target.speed+target.phase)*Math.PI/180)*target.span;
        let futureZ = target.home_z;
        if (target.pipe && Math.abs(offset)>.5) {
          const bank = Math.min(3,Math.floor((Math.abs(offset)-.5)/.625));
          futureZ += bank*bank*.125+(Math.abs(offset)-.5-bank*.625)*(2*bank+1)*.2;
        }
        const futureX = target.home_x+target.axis_x*offset, futureY = target.home_y+target.axis_y*offset;
        if (Math.hypot(futureX-s.player.x,futureY-s.player.y,futureZ-s.player.z)<2.85 && target.s-s.course_s>1.1 && s.charge_cooldown===0 && s.charges_left>0) {
          step({charge:true}); continue;
        }
      }
      if (gapJump) jumped.add(s.gaps.indexOf(gap));
      if (spikeJump) spikeJumps.add(spike.s);
      const destination = point(Math.min(s.course_length-3,s.course_s+(turn ? 1.6 : 2.5)));
      const dx = destination.x-s.player.x, dy = destination.y-s.player.y, distance = Math.max(.1,Math.hypot(dx,dy));
      const desiredX = dx/distance*speed, desiredY = dy/distance*speed;
      // Cancel only the measured ground slope, while respecting ordinary input limits.
      const worldX = clamp((desiredX-s.player.vx*.975+(s.grounded ? s.slope_x*.035 : 0))/.017,-1,1);
      const worldY = clamp((desiredY-s.player.vy*.975+(s.grounded ? s.slope_y*.035 : 0))/.017,-1,1);
      step({move_y:Math.cos(a)*worldX+Math.sin(a)*worldY,move_x:-Math.sin(a)*worldX+Math.cos(a)*worldY,jump:!!(gapJump||spikeJump||enemyJump)});
    }
    check(s.status===(level===s.level_count?'won':'level_complete'),`Course ${level} incomplete: ${s.status}; s=${s.course_s}, p=${JSON.stringify(s.player)}, cells=${s.charges_left}, kills=${s.kills}; ${JSON.stringify(deaths)}`);
    check(s.lives===3 && s.checkpoint_active,`Course ${level} lost a life or checkpoint: ${JSON.stringify(deaths)}`);
    check(jumped.size===s.gaps.length,`Course ${level} missed a gap`);
    check(headings.size>=2,`Course ${level} did not change direction`);
    check(s.kills>=1 && s.charges_left>=0,`Course ${level} did not exercise limited blasts`);
    results.push({level,kills:s.kills,gaps:jumped.size,headings:[...headings],pipes:s.pipe_count,spikeJumps:spikeJumps.size,ms:Date.now()-started});
    frame();
    if (level<s.level_count) g.controls.command('host.advance');
  }
  check(chargedFrame && blastFrame && s.completed_levels===s.level_count,'Incomplete charge or campaign presentation');
  g.start(); g.paused=true;
  const x=s.player.x;
  g.step({forward:true,jump:true,charge:true});
  check(s.player.x===x && s.charges_left===3,'Pause advanced simulation');
  g.paused=false;
  globalThis.__marbleCampaignReport=results;
  return true;
})()
