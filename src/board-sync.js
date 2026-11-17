(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.BeadBoardSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 function validRevision(value){return Number.isSafeInteger(value)&&value>=0?value:0;}

 // Shared pegboards send only the cells that changed. That lets several players edit
 // different parts of any table at the same time without one full-board save erasing
 // another player's latest beads.
 function createBoardSync(options){
  const tables=options.tables||[],delay=Math.max(0,Number(options.delay)||0),maxChanges=Math.max(1,Number(options.maxChanges)||512);
  const setTimer=options.setTimer||setTimeout,clearTimer=options.clearTimer||clearTimeout;
  const read=options.read,sendPatch=options.sendPatch,sendReplace=options.sendReplace,localId=options.localId||'';
  const states={};

  function snapshotFor(table){const value=read(table);return value&&Number.isInteger(value.size)&&typeof value.cells==='string'&&value.cells.length===value.size*value.size?value:null;}
  function stateFor(table){
   if(states[table])return states[table];
   const initial=snapshotFor(table)||{size:0,cells:''};
   return states[table]={size:initial.size,shadow:initial.cells,revision:0,pending:new Map(),queued:new Map(),timer:null,replacePending:false};
  }
  for(const table of tables)stateFor(table);
  function cancel(state){if(state.timer!==null){clearTimer(state.timer);state.timer=null;}}
  function schedule(table,wait=delay){const state=stateFor(table);cancel(state);state.timer=setTimer(()=>{state.timer=null;flush(table);},wait);}

  function flush(table,force=false){
   const state=stateFor(table);
   if(state.replacePending){if(force)return false;schedule(table,Math.max(120,delay));return false;}
   cancel(state);if(!state.queued.size)return true;
   const all=[...state.queued.entries()];state.queued.clear();let sent=true;
   for(let start=0;start<all.length;start+=maxChanges){
    const changes=all.slice(start,start+maxChanges);
    if(sendPatch(table,{size:state.size,changes})===false){for(const [index,value] of changes)state.queued.set(index,value);sent=false;}
   }
   if(!sent&&!force)schedule(table,Math.max(250,delay));
   return sent;
  }

  function changed(table){
   const state=stateFor(table),snapshot=snapshotFor(table);if(!snapshot)return false;
   if(snapshot.size!==state.size||snapshot.cells.length!==state.shadow.length){
    return replace(table);
   }
   let count=0;
   for(let index=0;index<snapshot.cells.length;index++)if(snapshot.cells[index]!==state.shadow[index]){
    const value=snapshot.cells[index];state.pending.set(index,value);state.queued.set(index,value);count++;
   }
   state.shadow=snapshot.cells;if(count)schedule(table);return count>0;
  }

  function replace(table){
   const state=stateFor(table),snapshot=snapshotFor(table);if(!snapshot)return false;
   cancel(state);state.pending.clear();state.queued.clear();state.size=snapshot.size;state.shadow=snapshot.cells;state.replacePending=true;
   if(sendReplace(table,{...snapshot,baseRevision:state.revision})===false){state.replacePending=false;return false;}
   return true;
  }

  function acknowledge(table,changes){
   const state=stateFor(table);
   for(const change of changes||[]){const index=change?.[0],value=change?.[1];if(state.pending.get(index)===value)state.pending.delete(index);}
  }

  function receiveBoard(table,message){
   const state=stateFor(table),revision=validRevision(message?.revision),size=message?.size,cells=message?.cells;
   if(!Number.isInteger(size)||typeof cells!=='string'||cells.length!==size*size)return{apply:false,reason:'invalid'};
   if(revision<state.revision&&!state.replacePending)return{apply:false,reason:'stale'};
   let merged=cells;
   if(size===state.size&&state.pending.size){const work=cells.split('');for(const [index,value] of state.pending)if(index>=0&&index<work.length)work[index]=value;merged=work.join('');}
   else if(size!==state.size){state.pending.clear();state.queued.clear();}
   state.size=size;state.shadow=merged;state.revision=Math.max(state.revision,revision);state.replacePending=false;
   if(state.queued.size)schedule(table);
   return{apply:true,size,cells:merged,revision:state.revision};
  }

  function receivePatch(table,message){
   const state=stateFor(table),snapshot=snapshotFor(table);if(!snapshot||message?.size!==snapshot.size||!Array.isArray(message?.changes))return{apply:false,reason:'size-mismatch'};
   const work=snapshot.cells.split('');let applied=0;
   for(const change of message.changes){const index=change?.[0],value=change?.[1];if(!Number.isInteger(index)||index<0||index>=work.length||typeof value!=='string'||value.length!==1)continue;
    const pending=state.pending.get(index);
    if(pending!==undefined){if(message.id===localId&&pending===value)state.pending.delete(index);else continue;}
    work[index]=value;applied++;
   }
   state.shadow=work.join('');state.size=snapshot.size;state.revision=Math.max(state.revision,validRevision(message.revision));
   return{apply:applied>0,size:state.size,cells:state.shadow,revision:state.revision};
  }

  function dispose(){for(const state of Object.values(states))cancel(state);}
  function inspect(table){const state=stateFor(table);return{revision:state.revision,pendingLocal:state.pending.size>0||state.queued.size>0||state.replacePending,queued:state.queued.size,pending:state.pending.size,replacePending:state.replacePending,scheduled:state.timer!==null,size:state.size};}

  return{changed,replace,flush,acknowledge,receiveBoard,receivePatch,dispose,inspect};
 }

 return{createBoardSync};
});
