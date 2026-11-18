// Natural cinematic timing, world handoff, scroll progress, pause and replay input.
(() => {
 const g=__RunePixel3D,s=g.app.state,check=(ok,message)=>{if(!ok)throw Error(message);};
 const t=(n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
 const frame=()=>check(g.frame().every(pixel=>(pixel>>>24)===255),'Cinematic framebuffer invalid');
 g.paused=true;g.invoke('return_to_title');
 const first=g.renderState().camera,playerX=s.player.x;frame();t(120,{right:true,fire:true});
 const next=g.renderState().camera;
 check(s.status==='title'&&s.player.x===playerX&&Math.abs(first.x-next.x)>.1,'Title flyover did not move independently of game logic');frame();
 // The controller Start command begins at the title, then pauses during cinematics.
 g.controls.command('host.pause');check(s.status==='intro','Controller Start did not begin the introduction');
 check(s.ui.cinema.lines.includes('Bring the light home.')&&!s.touch_ready,'Mission story missing or gameplay enabled');
 t(80,{right:true,fire:true,jump:true});check(s.player.x===9&&s.shots.length===0,'Opening movie accepted gameplay controls');frame();
 t(120);check(s.ship.visible&&s.ship.model==='sf/distant_ship'&&s.ship.scale<.1,'Departing ship did not become a dot');frame();
 t(45);check(!s.ship.visible,'Distant ship never disappeared');
 const clock=s.cinema_ticks,scroll=s.ui.cinema.offset;g.controls.command('host.pause');t(20);
 check(g.paused&&s.cinema_ticks===clock&&s.ui.cinema.offset===scroll,'Pause advanced the story crawl');frame();
 g.controls.command('host.pause');check(!g.paused,'Controller did not resume the movie');
 t(s.intro_duration-s.cinema_ticks);check(s.status==='landing'&&s.world.width===128&&s.world.depth===20&&s.ship.scale===1.2&&s.ship.y===5.5,'Movie did not restore the actual game world');frame();
 t(108);check(s.status==='playing'&&s.health===s.max_health&&s.touch_ready,'Landing did not unlock gameplay');
 s.enemies=[];s.core=true;s.player.x=9;s.player.z=3;t(1);check(s.status==='departing','Ending boarding did not begin');
 t(120);check(s.status==='ending'&&s.campaign.finished&&s.music_track==='sf_homecoming','Victory must be banked before credits');frame();
 t(190);check(s.scenery[0].model==='sf/ark_lit'&&s.ship.scale>1,'Homecoming did not light the Ark or bring the ship home');frame();
 t(s.ending_duration-s.cinema_ticks);check(s.status==='credits'&&s.ui.cinema.lines.includes('GAME BY DAVE THOMAS'),'Rolling attribution missing');
 t(170);const offset=s.ui.cinema.offset;frame();t(60);check(s.ui.cinema.offset>offset,'Credits did not scroll');
 t(s.credits_duration-s.cinema_ticks);check(s.status==='won'&&s.title_hidden===false&&s.music_track==='','Credits did not reach the replay screen');frame();
 g.start();check(s.status==='intro'&&!s.campaign.finished,'Replay did not start a new story');g.invoke('advance');check(s.status==='landing','Skip did not advance safely to landing');
 __starfallLaunch();return true;
})()
