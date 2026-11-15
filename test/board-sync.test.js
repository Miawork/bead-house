'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createBoardSync } = require('../src/board-sync');

function harness(){
 let clock=0,nextTimer=1;
 const timers=new Map(),boards={A:{size:16,cells:'.'.repeat(256)},B:{size:16,cells:'.'.repeat(256)}},sent=[];
 const sync=createBoardSync({tables:['A','B'],delay:220,now:()=>clock,
  setTimer:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,at:clock+ms});return id;},clearTimer:id=>timers.delete(id),
  read:table=>boards[table],send:(table,snapshot)=>{sent.push({table,...snapshot});return true;}});
 function advance(ms){clock+=ms;for(const [id,timer] of [...timers].sort((a,b)=>a[1].at-b[1].at)){if(timer.at<=clock){timers.delete(id);timer.fn();}}}
 return{boards,sent,sync,advance};
}

test('rapid placement keeps the latest bead and sends a trailing board snapshot',()=>{
 const h=harness();
 h.boards.A={size:16,cells:'A'+'.'.repeat(255)};
 h.sync.changed('A');
 assert.equal(h.sent.length,1);
 assert.equal(h.sent[0].revision,1);

 h.advance(50);
 h.boards.A={size:16,cells:'AA'+'.'.repeat(254)};
 h.sync.changed('A');
 assert.equal(h.sent.length,1);
 assert.equal(h.sync.receive('A',h.sent[0]).reason,'stale');
 assert.equal(h.boards.A.cells.slice(0,2),'AA');

 h.advance(170);
 assert.equal(h.sent.length,2);
 assert.equal(h.sent[1].revision,2);
 assert.equal(h.sent[1].cells.slice(0,2),'AA');
});

test('board throttling is independent per table',()=>{
 const h=harness();
 h.boards.A.cells='A'+'.'.repeat(255);h.sync.changed('A');
 h.boards.B.cells='B'+'.'.repeat(255);h.sync.changed('B');
 assert.deepEqual(h.sent.map(message=>message.table),['A','B']);
});

test('a newer server revision rebases unsaved local work instead of overwriting it',()=>{
 const h=harness();
 h.boards.A.cells='A'+'.'.repeat(255);h.sync.changed('A');
 h.advance(10);h.boards.A.cells='AA'+'.'.repeat(254);h.sync.changed('A');
 const decision=h.sync.receive('A',{size:16,cells:'B'.repeat(256),revision:7});
 assert.equal(decision.reason,'rebased');
 assert.equal(h.boards.A.cells.slice(0,2),'AA');
 assert.equal(h.sent.at(-1).revision,8);
 assert.equal(h.sent.at(-1).cells.slice(0,2),'AA');
});
