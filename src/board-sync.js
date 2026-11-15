(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BeadBoardSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 function validRevision(value){return Number.isSafeInteger(value)&&value>=0?value:0;}

 function createBoardSync(options){
  const tables=options.tables||[],delay=Math.max(0,Number(options.delay)||0);
  const now=options.now||(()=>Date.now()),setTimer=options.setTimer||setTimeout,clearTimer=options.clearTimer||clearTimeout;
  const read=options.read,send=options.send;
  const states=Object.fromEntries(tables.map(table=>[table,{revision:0,lastSentAt:-Infinity,timer:null,pendingLocal:false}]));

  function stateFor(table){return states[table]||(states[table]={revision:0,lastSentAt:-Infinity,timer:null,pendingLocal:false});}
  function sameSnapshot(a,b){return !!a&&a.size===b.size&&a.cells===b.cells;}

  function dispatch(table){
   const state=stateFor(table);
   if(state.timer!==null){clearTimer(state.timer);state.timer=null;}
   const snapshot=read(table);
   if(!snapshot||send(table,{...snapshot,revision:state.revision})===false)return false;
   state.lastSentAt=now();
   return true;
  }

  function flush(table,force=false){
   const state=stateFor(table);
   if(force)return dispatch(table);
   const wait=delay-(now()-state.lastSentAt);
   if(wait<=0)return dispatch(table);
   if(state.timer===null)state.timer=setTimer(()=>{state.timer=null;dispatch(table);},wait);
   return false;
  }

  function changed(table){
   const state=stateFor(table);
   state.revision++;
   state.pendingLocal=true;
   flush(table,false);
   return state.revision;
  }

  function receive(table,message){
   const state=stateFor(table),incoming=validRevision(message?.revision),local=read(table);
   const remote={size:message?.size,cells:message?.cells};
   if(incoming<state.revision)return{apply:false,reason:'stale'};
   if(incoming===state.revision){
    if(sameSnapshot(local,remote)){state.pendingLocal=false;return{apply:false,ack:true};}
    if(state.pendingLocal){state.revision=incoming+1;flush(table,true);return{apply:false,reason:'rebased'};}
    return{apply:true,revision:incoming};
   }
   if(state.pendingLocal){state.revision=incoming+1;flush(table,true);return{apply:false,reason:'rebased'};}
   state.revision=incoming;
   return{apply:true,revision:incoming};
  }

  function dispose(){for(const state of Object.values(states))if(state.timer!==null){clearTimer(state.timer);state.timer=null;}}
  function inspect(table){const state=stateFor(table);return{revision:state.revision,pendingLocal:state.pendingLocal,lastSentAt:state.lastSentAt,scheduled:state.timer!==null};}

  return{changed,flush,receive,dispose,inspect};
 }

 return{createBoardSync};
});
