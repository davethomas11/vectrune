// Tests finish the real landing sequence before exercising gameplay fixtures.
(() => {
  globalThis.__starfallLaunch = () => {
    const g=__RunePixel3D;
    g.app.state.campaign={hydroponics:false,finished:false};
    g.start();
    if(g.app.state.status==='intro')g.invoke('advance');
    for(let i=0;i<140 && g.app.state.status==='landing';i++)g.step({});
    if(g.app.state.status!=='playing')throw Error('Ship failed to land');
  };
  return true;
})()
