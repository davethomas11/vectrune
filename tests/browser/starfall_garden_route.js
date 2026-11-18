// Connected-sector route. Starts in cargo after the jump-jet pickup; no progress mutations.
(() => {
  globalThis.__starfallGardenRoute = () => {
    const g=__RunePixel3D,s=g.app.state,route=[];
    function check(ok,message){if(!ok)throw Error(message);}
    function t(n,input={}){for(let i=0;i<n;i++)g.step(input);}
    function capture(label){check(s.health>0&&s.lives===3+s.life_rewards,'Life lost in '+label);check(g.frame().every(p=>(p>>>24)===255),'Invalid garden frame');route.push({label,x:s.player.x,z:s.player.z});}
    function move(x){let i=0;while(Math.abs(s.player.x-x)>.25&&i++<400&&s.status==='playing'&&s.recovery_phase==='none')t(1,{left:s.player.x>x,right:s.player.x<x,fire:true});t(5);check(i<400&&s.recovery_phase==='none','Garden route blocked at '+x);}
    move(52);t(1,{use:true});t(1);
    check(s.sector_id==='hydroponics'&&s.world.width===80,'Garden hatch did not change sectors');capture('greenhouse');
    function land(z){let i=0;while((!s.grounded||Math.abs(s.player.z-z)>.01)&&i++<150&&s.recovery_phase==='none')t(1,{fire:true});check(i<150&&s.player.z===z,'Canopy landing failed at '+z+' / '+s.player.z);}
    function climbToRepair(){
      t(1,{left:true,jump:true,fire:true});t(10,{left:true,fire:true});t(1,{left:true,jump:true,fire:true});t(18,{left:true,fire:true});land(13);move(12);
    }
    move(9.5);
    t(1,{right:true,jump:true,fire:true});t(10,{right:true,fire:true});t(1,{right:true,jump:true,fire:true});t(8,{right:true,fire:true});land(7);
    move(14.5);t(1,{right:true,jump:true,fire:true});t(10,{right:true,fire:true});t(1,{right:true,jump:true,fire:true});t(12,{right:true,fire:true});land(10);
    climbToRepair();check(!s.pickups[1].visible&&!s.dash_unlocked,'Dash crypt must follow the repair pod');capture('repair canopy');move(15.4);
    // A normal jump cannot climb the final four-tile rise or enter the crypt.
    let singlePeak=s.player.z;
    for(let i=0;i<34;i++){t(1,{right:i<24,jump:i===0,fire:true});singlePeak=Math.max(singlePeak,s.player.z);}
    land(10);check(singlePeak<17&&s.sector_id==='hydroponics'&&!s.dash_unlocked,'Single jump bypassed the jet requirement');
    climbToRepair();move(15.4);
    t(1,{right:true,jump:true,fire:true});t(10,{right:true,fire:true});t(1,{right:true,jump:true,fire:true});t(15,{right:true,fire:true});land(17);move(22);capture('upper crypt entrance');
    move(23.5);check(s.sector_id==='hydroponics','Portal activated without USE');t(1,{use:true});t(1);
    check(s.sector_id==='dash_vault','Upper portal did not lead into the dash crypt');
    __starfallUpgradeVaultRoute('dash');move(28.8);land(5);
    check(s.dash_unlocked,'Air dash module not collected');capture('air dash');
    t(1,{right:true,jump:true,fire:true});t(10,{right:true,fire:true});t(1,{right:true,jump:true,fire:true});
    t(1,{right:true,dash:true,fire:true});check(s.dash_ticks>0&&s.avatar.model==='sf/pilot_dash','Air dash did not animate');g.frame();
    t(9,{right:true,fire:true});t(26,{right:true,fire:true});t(16,{fire:true});
    check(s.player.x>42&&s.player.z===5,'Dash breach was not traversable');capture('breach');
    move(58);
    const phases=new Set();
    for(let i=0;i<600&&s.rootheart.visible&&s.status==='playing'&&s.recovery_phase==='none';i++){
      t(1,{fire:true,jump:s.root_clock%180===48||s.root_clock%180===84});
      if(!phases.has(s.root_phase)){phases.add(s.root_phase);g.frame();}
      if(s.rootheart.visible){const meter=s.ui.meters.find(m=>m.label==='ROOTHEART');check(meter?.value===s.rootheart.hp,'Rootheart life bar out of sync');}
    }
    check(!s.rootheart.visible&&s.pickups[2].visible,'Rootheart encounter failed');
    check(phases.has('open')&&phases.has('closed'),'Miniboss did not cycle armored/bloom phases');capture('rootheart');
    move(72);check(s.campaign.hydroponics&&s.garden_cleared&&s.portals[1].visible,'Relay did not bank sector and unlock shortcut');
    t(1,{use:true});t(1);
    check(s.sector_id==='station'&&Math.abs(s.player.x-37)<.1,'Shortcut did not reconnect to cargo');
    check(s.jets&&s.dash_unlocked&&s.portals[1].visible,'Room change lost equipment or shortcut');capture('cargo shortcut');
    return route;
  };
  return true;
})()
