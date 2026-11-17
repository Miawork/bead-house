(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BeadMobileControls=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function isTouchUi(env){
    const width=Number(env?.innerWidth)||1280;
    const coarse=Boolean(env?.matchMedia?.('(pointer: coarse)')?.matches);
    const touches=Number(env?.navigator?.maxTouchPoints)||0;
    return (coarse||touches>0)&&width<=1100;
  }

  // Convert joystick axes into world movement using the camera's projected screen axes.
  // This makes up/down/left/right feel identical in first-person and elevated mobile views.
  function screenRelativeMove(dx,dz,forward,right){
    const fl=Math.hypot(forward?.[0]||0,forward?.[2]||0)||1;
    const rl=Math.hypot(right?.[0]||0,right?.[2]||0)||1;
    const clean=value=>Math.abs(value)<1e-12?0:value;
    return {
      x:clean((forward?.[0]||0)/fl*(-dz)+(right?.[0]||0)/rl*dx),
      z:clean((forward?.[2]||0)/fl*(-dz)+(right?.[2]||0)/rl*dx)
    };
  }

  return {isTouchUi,screenRelativeMove};
});
