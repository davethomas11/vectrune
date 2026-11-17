// A complete campaign using movement, glide, dodge and stomp inputs. No position/progress fixtures.
() => {
 const g=__RunePixel3D,s=g.app.state,log=[];
 const manualStep=g.step.bind(g);g.step=()=>{};
 function capture(){const image=document.createElement('canvas');image.width=432;image.height=270;image.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(g.frame().buffer),432,270),0,0);return image.toDataURL();}
 function tick(input={}) {manualStep(input);}
 function record(name){log.push({name,phase:s.phase,x:s.player.x,y:s.player.y,z:s.player.z,h:s.hearts,boss:s.boss_hp,beat:s.boss_phase,bc:s.boss_clock,seeds:s.collected,squished:s.squished,unlocked:s.saga.unlocked});}
 function settle(max=80){for(let i=0;i<max;i++){tick();if(s.player.vz===0)break;}}
 function steer(x,y,jump=false){
   const dx=x-s.player.x,dy=y-s.player.y,d=Math.hypot(dx,dy),a=s.yaw*Math.PI/180,amp=Math.min(1,d/.18);
   tick({move_y:d>.03?(Math.cos(a)*dx+Math.sin(a)*dy)/d*amp:0,move_x:d>.03?(-Math.sin(a)*dx+Math.cos(a)*dy)/d*amp:0,jump});
 }
 function clearNearby(){
   if(s.boss_active)return;
   const start={x:s.player.x,y:s.player.y};
   for(const enemy of s.enemies){
    if(!enemy.visible||enemy.flat||Math.abs(enemy.floor-s.player.z)>.2||Math.hypot(enemy.x-s.player.x,enemy.y-s.player.y)>3)continue;
    if(enemy.kind==='hopper')for(let i=0;i<84&&!(enemy.clock%84>=36&&enemy.clock%84<=42);i++)tick();
    tick();tick({jump:true});for(let i=0;i<4;i++)tick({jump:true});
    for(let i=0;i<100&&!enemy.flat&&s.phase==='playing';i++)steer(enemy.x,enemy.y,true);
    if(!enemy.flat)throw Error('Could not stomp '+JSON.stringify(enemy)+' / '+JSON.stringify(s.player)+' / '+JSON.stringify(log.slice(-6)));
    settle();for(let i=0;i<40&&Math.hypot(start.x-s.player.x,start.y-s.player.y)>.12;i++)steer(start.x,start.y);
    for(let i=0;i<6;i++)tick();settle();
   }
 }
 function travel(x,y,jump=false){
   clearNearby();
   let count=0;
   for(;count<100;count++){
    if(s.phase!=='playing')break;
    const dx=x-s.player.x,dy=y-s.player.y,d=Math.hypot(dx,dy);
    if(d<.14)break;
    const yaw=s.yaw*Math.PI/180,amp=Math.min(1,d/.18);
    tick({move_y:(Math.cos(yaw)*dx+Math.sin(yaw)*dy)/d*amp,move_x:(-Math.sin(yaw)*dx+Math.cos(yaw)*dy)/d*amp,jump:jump});
   }
   for(let i=0;i<6;i++)tick();settle();
   if(count===100)throw Error('Stuck '+x+','+y+' / '+JSON.stringify(s.player)+' / hearts '+s.hearts+' / route '+JSON.stringify(log.slice(-5)));
   record((jump?'leap ':'walk ')+x+','+y+(count===100?' STUCK':''));
 }
 g.start();
 travel(9.5,13.2);travel(9.5,17.5,true);
 travel(8.6,18.3);travel(5,19.5,true);travel(5.5,20.5);record('reedwake-detour');
 travel(6.4,19.5);travel(9.5,17.5,true);travel(9.5,16.3);travel(9.5,12.5,true);
 travel(10.3,9);travel(15.3,9,true);
 travel(16.5,10.6);travel(21.3,11.5,true);
 travel(22,14.2);travel(21.5,19,true);
 travel(18.5,20);travel(13,20,true);
 travel(13,22.3);travel(13,27,true);travel(15.3,28);travel(20.5,28,true);
 travel(23.3,30);travel(28.5,30,true);travel(30,30);
 record('first-clear');
 if(s.phase!=='result'){throw Error('Campaign stopped at '+s.phase+' / '+s.stages[s.selected].name+' / '+JSON.stringify(log));}
 g.invoke('advance');g.invoke('choose_two');g.invoke('advance');
 travel(10.3,9);travel(15.3,9,true);travel(17.4,9);travel(22.5,9,true);
 travel(24.3,11);travel(29,11,true);travel(31,14.3);travel(32,19.5,true);
 travel(34.3,20);travel(39.5,20,true);travel(40,20);travel(40,23);
 record('boss1-ready');window.__kilnFrame=capture();
 function waitForRest(){for(let i=0;i<220&&s.boss_phase!=='rest'&&s.phase==='playing';i++)tick();}
 function strike(){
  const before=s.boss_hp;
  for(let i=0;i<90&&s.boss_hp===before&&s.phase==='playing';i++){
   const dx=s.boss.x-s.player.x,dy=s.boss.y-s.player.y,d=Math.hypot(dx,dy),a=s.yaw*Math.PI/180;
   tick({move_y:d>.1?(Math.cos(a)*dx+Math.sin(a)*dy)/d:0,move_x:d>.1?(-Math.sin(a)*dx+Math.cos(a)*dy)/d:0,jump:i===0});
  }
  record('strike');
 }
 for(let hit=0;hit<3&&s.phase==='playing';hit++){
  if(s.boss_phase==='stagger')travel(s.boss.x<41?44:38.5,23);
  for(let i=0;i<200&&s.boss_phase!=='telegraph';i++)tick();
  travel(s.boss_aim.x<41?44:38.5,23);
  waitForRest();record('boss1-rest');
  const dx=s.player.x-s.boss.x,dy=s.player.y-s.boss.y,d=Math.hypot(dx,dy);
  travel(s.boss.x+dx/d*3,s.boss.y+dy/d*3);strike();
 }
 record('boss1-clear');
 if(s.phase!=='result'){throw Error('Campaign stopped at '+s.phase+' / '+s.stages[s.selected].name+' / '+JSON.stringify(log));}
 g.invoke('advance');g.invoke('choose_three');g.invoke('advance');
 travel(8,21.4);travel(8,15.7,true);travel(9,13.6);travel(10.5,8.5,true);travel(12,8);
 travel(14.3,8);travel(19.2,8,true);travel(21.5,10.3);travel(22.5,15.2,true);
 travel(25.3,17);travel(30.5,17,true);travel(33,19.3);travel(33,24.5,true);
 travel(35.3,26);travel(40.5,27,true);travel(41,27);
 record('tide-clear');
 if(s.phase!=='result'){throw Error('Campaign stopped at '+s.phase+' / '+s.stages[s.selected].name+' / '+JSON.stringify(log));}
 g.invoke('advance');g.invoke('choose_four');g.invoke('advance');
 travel(8,28.6);travel(9,23,true);travel(10,20.6);travel(11,15,true);
 travel(14.3,16);travel(19.5,16,true);travel(22.3,17);travel(27.5,18,true);travel(28,18);
 travel(30,20.3);travel(30,25.5,true);travel(32.3,27);travel(37.5,27,true);
 travel(39,29.3);travel(39,34.5,true);travel(39,35);record('canopy-clear');
 if(s.phase!=='result')throw Error('Canopy route failed');
 g.invoke('advance');g.invoke('choose_five');g.invoke('advance');
 travel(10.3,10);travel(15.5,11,true);travel(18.3,11);travel(23.5,11,true);
 travel(26.3,13);travel(31.5,13.5,true);travel(34,15.3);travel(34,20.5,true);travel(34,21);
 travel(31.6,22);travel(26.5,23,true);travel(23.6,24);travel(18.5,25,true);
 travel(19,27.3);travel(19,32.5,true);travel(21.3,34);travel(26.5,34,true);travel(27,34);record('aurora-clear');
 if(s.phase!=='result')throw Error('Aurora route failed '+JSON.stringify(log.slice(-16)));
 g.invoke('advance');g.invoke('choose_six');g.invoke('advance');
 travel(10.3,9);travel(15.5,9,true);travel(18.3,11);travel(23.5,11,true);
 travel(26,13.3);travel(26,18.5,true);travel(26,19);
 travel(23.6,20);travel(18.5,21,true);travel(15.6,22);travel(10.5,23,true);
 travel(11,25.3);travel(11,30.5,true);travel(13.3,32);travel(18.5,33,true);travel(20,33);record('emberglass-clear');
 if(s.phase!=='result')throw Error('Emberglass route failed');
 g.invoke('advance');g.invoke('choose_seven');g.invoke('advance');
 travel(10.3,9);travel(15.4,10,true);travel(17.4,11);travel(22.5,11,true);
 travel(24,13.3);travel(25,18.5,true);travel(27.3,19.5);travel(32.5,20,true);
 travel(35.3,20);travel(40.5,20,true);travel(41,21.3);travel(41,25.5,true);travel(43,28);
 record('regent-ready');window.__regentFrame=capture();
 for(let hit=0;hit<4&&s.phase==='playing';hit++){
  travel(43,28);
  for(let i=0;i<200&&s.boss_phase!=='attack';i++)tick();
  for(let i=0;i<60&&s.boss_phase==='attack';i++)tick({jump:s.boss_clock>=17&&s.boss_clock<37});
  settle();record('regent-rest');
  travel(41.4,29.2);strike();
 }
 record('regent-clear');
 if(s.phase!=='result'||!s.saga.cleared.every(Boolean))throw Error('Final lantern was not restored');
 return log;
 }
