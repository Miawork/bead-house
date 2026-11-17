'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createBoardSync } = require('../src/board-sync');

function harness(){
 let nextTimer=1;
 const timers=new Map(),boards={A:{size:4,cells:'.'.repeat(16)},B:{size:4,cells:'.'.repeat(16)}},patches=[],replacements=[];
 const sync=createBoardSync({tables:['A','B'],delay:80,maxChanges:4,localId:'local',
  setTimer:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),
  read:table=>boards[table],sendPatch:(table,snapshot)=>{patches.push({table,...snapshot});return true;},sendReplace:(table,snapshot)=>{replacements.push({table,...snapshot});return true;}});
 function runTimers(){for(const [id,timer] of [...timers]){timers.delete(id);timer.fn();}}
 return{boards,patches,replacements,sync,runTimers};
}

test('rapid local placement is sent as per-cell patches',()=>{
 const h=harness();
 h.boards.A.cells='A'+'.'.repeat(15);h.sync.changed('A');
 h.boards.A.cells='AB'+'.'.repeat(14);h.sync.changed('A');
 h.runTimers();
 assert.deepEqual(h.patches,[{table:'A',size:4,changes:[[0,'A'],[1,'B']]}]);
 assert.equal(h.sync.inspect('A').pending,2);
});

test('remote players can merge different cells without replacing local pending work',()=>{
 const h=harness();
 h.boards.A.cells='A'+'.'.repeat(15);h.sync.changed('A');
 const decision=h.sync.receivePatch('A',{id:'remote',table:'A',size:4,revision:2,changes:[[0,'B'],[2,'C']]});
 assert.equal(decision.apply,true);
 assert.equal(decision.cells,'A.C'+'.'.repeat(13));
 h.boards.A.cells=decision.cells;
 h.runTimers();
 assert.deepEqual(h.patches[0].changes,[[0,'A']]);
});

test('server snapshots preserve unsent local cells and acknowledge the sender',()=>{
 const h=harness();
 h.boards.A.cells='A'+'.'.repeat(15);h.sync.changed('A');h.runTimers();
 let decision=h.sync.receiveBoard('A',{size:4,cells:'.B'+'.'.repeat(14),revision:3});
 assert.equal(decision.cells,'AB'+'.'.repeat(14));
 h.boards.A.cells=decision.cells;
 decision=h.sync.receivePatch('A',{id:'local',size:4,revision:4,changes:[[0,'A']]});
 assert.equal(h.sync.inspect('A').pending,0);
});

test('changing an empty shared board size uses a revision-guarded replacement',()=>{
 const h=harness();
 h.sync.receiveBoard('A',{size:4,cells:'.'.repeat(16),revision:7});
 h.boards.A={size:8,cells:'.'.repeat(64)};h.sync.changed('A');
 assert.equal(h.replacements.length,1);
 assert.deepEqual(h.replacements[0],{table:'A',size:8,cells:'.'.repeat(64),baseRevision:7});
 assert.equal(h.sync.inspect('A').replacePending,true);
});

test('finishing a shared work sends one atomic replacement instead of thousands of clear patches',()=>{
 const h=harness();
 h.sync.receiveBoard('A',{size:4,cells:'ABCD'+'.'.repeat(12),revision:9});
 h.boards.A.cells='.'.repeat(16);h.sync.replace('A');
 assert.deepEqual(h.replacements.at(-1),{table:'A',size:4,cells:'.'.repeat(16),baseRevision:9});
 assert.equal(h.patches.length,0);
});

test('patch throttling stays independent for every multiplayer table',()=>{
 const h=harness();
 h.boards.A.cells='A'+'.'.repeat(15);h.sync.changed('A');
 h.boards.B.cells='B'+'.'.repeat(15);h.sync.changed('B');h.runTimers();
 assert.deepEqual(h.patches.map(message=>message.table).sort(),['A','B']);
});

test('large collaborative edits are chunked without dropping cells',()=>{
 const h=harness();
 h.boards.A.cells='ABCDEFGHI'+'.'.repeat(7);h.sync.changed('A');h.runTimers();
 assert.deepEqual(h.patches.map(message=>message.changes.length),[4,4,1]);
 assert.deepEqual(h.patches.flatMap(message=>message.changes).map(change=>change[0]),[0,1,2,3,4,5,6,7,8]);
});
