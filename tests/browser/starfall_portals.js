// Portals are visible, solid-footed and deliberate; effects share the game clock.
(() => {
 const g=__RunePixel3D,s=g.app.state;
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const t=(n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
 __starfallLaunch();
 const rift=s.portals.find(p=>p.kind==='jets_entry');
 check(rift&&rift.title==='PROPULSION CRYPT'&&rift.model.startsWith('sf/rift_gate'),'Missing crypt gateway');
 check(s.portals.find(p=>p.kind==='garden_entry').title==='HYDROPONICS','Hydroponics door has no destination title');
 check(s.portals.every(p=>typeof p.title==='string'&&p.title.length>0),'Every door needs a destination title');
 s.enemies=[];s.player.x=49;s.player.z=3;t(2);
 check(s.sector_id==='station'&&s.grounded,'Portal must stand on solid ground and wait for USE');
 check(s.portal_aura.length===6,'Portal energy motes missing');
 const poses=new Set();for(let i=0;i<21;i++){t(1);poses.add(rift.model);}
 check(poses.size===2,'Portal field animation missing');
 const aura=JSON.stringify(s.portal_aura),clock=s.ticks;g.paused=true;t(5);
 check(s.ticks===clock&&JSON.stringify(s.portal_aura)===aura,'Paused portal kept animating');g.paused=false;
 t(1,{use:true});check(s.sector_id==='jet_vault'&&s.arrival_ring.visible,'USE did not show a portal arrival');
 const scale=s.arrival_ring.scale;t(1,{use:true});
 check(s.sector_id==='jet_vault'&&s.arrival_ring.scale>scale&&s.arrival_ring.dissolve>0,'Held USE bounced through portal or arrival failed to expand');
 check(g.frame().every(p=>(p>>>24)===255),'Portal frame invalid');
 t(14);check(!s.arrival_ring.visible,'Arrival effect did not finish');
 t(1,{use:true});check(s.sector_id==='station'&&s.player.x===46&&s.arrival_ring.visible,'Return portal did not restore parent area safely');
 t(2,{use:true});check(s.sector_id==='station','Held USE re-entered the return portal');
 __starfallLaunch();return true;
})()
