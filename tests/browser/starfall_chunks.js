(() => {
 const g=__RunePixel3D,s=g.app.state;
 const check=(value,message)=>{if(!value)throw Error(message);};
 __starfallLaunch();
 check(s.world.storage==='chunked','Station did not use sparse terrain');
 const enemy=s.enemies[s.enemies.length-1];
 check(enemy.x-s.player.x>28,'Expected a sleeping enemy beyond the dock');
 const before=JSON.stringify(enemy);
 for(let i=0;i<12;i++)g.step({});
 check(JSON.stringify(enemy)===before,'Distant enemy was processed');
 s.player.x=enemy.x-10;s.player.z=enemy.z;s.invulnerable=10000;
 g.step({});check(enemy.active_tick===s.ticks,'Nearby enemy did not wake');
 const active=enemy.active_tick;
 s.player.x=9;s.player.z=3;
 for(let i=0;i<12;i++)g.step({});
 check(enemy.active_tick===active,'Enemy kept simulating after leaving its area');
 enemy.cooldown=1;enemy.targeting=true;
 s.player.x=enemy.x-5;s.player.z=enemy.z;s.invulnerable=10000;
 g.step({});check(enemy.cooldown>=23,'Waking enemy skipped its attack telegraph');
 __starfallLaunch();
 return true;
})()
