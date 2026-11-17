'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const test = require('node:test');
const { WebSocket } = require('ws');
const { createBeadHouseServer } = require('../server');

async function start(dataDir) {
  const app = createBeadHouseServer({ dataDir, legacyRoomUrl: null });
  await app.ready;
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address();
  return { app, origin: `http://127.0.0.1:${port}`, wsOrigin: `ws://127.0.0.1:${port}` };
}

async function post(origin, body) {
  return fetch(`${origin}/api/room`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('serves the game and persists the complete shared room', async t => {
  const dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bead-house-test-'));
  t.after(() => fsp.rm(dataDir, { recursive: true, force: true }));

  let running = await start(dataDir);
  assert.equal((await fetch(`${running.origin}/healthz`)).status, 200);
  const home = await fetch(running.origin);
  assert.equal(home.status, 200);
  const homeHtml = await home.text();
  assert.match(homeHtml, /mobileSceneZoom/);
  assert.match(homeHtml, /src\/board-sync\.js/);
  assert.match(homeHtml, /src\/mobile-controls\.js/);
  assert.match(homeHtml, /id="roomNavToggle"/);
  assert.match(homeHtml, /id="beadCoach"/);
  assert.match(homeHtml, /id="guideHelp"/);
  assert.match(homeHtml, /所有拼豆桌均为多人桌/);
  assert.doesNotMatch(homeHtml, /清空当前画板/);
  assert.match(homeHtml, /id="carryCupHit"/);
  assert.doesNotMatch(homeHtml, /id="carryDrink"/);
  const boardSyncSource = await fetch(`${running.origin}/src/board-sync.js`);
  assert.equal(boardSyncSource.status, 200);
  assert.match(await boardSyncSource.text(), /createBoardSync/);
  const mobileControlsSource = await fetch(`${running.origin}/src/mobile-controls.js`);
  assert.equal(mobileControlsSource.status, 200);
  assert.match(await mobileControlsSource.text(), /screenRelativeMove/);
  const sceneSource = await fetch(`${running.origin}/src/app.js`);
  assert.equal(sceneSource.status, 200);
  const sceneCode = await sceneSource.text();
  assert.match(sceneCode, /const CUTE_SCENE=/);
  assert.match(sceneCode, /ceiling:'#e8f0f3'/);
  assert.match(sceneCode, /CUTE_SCENE_HEX/);
  assert.match(sceneCode, /uniform float uInkPass/);

  const messages = [
    { t: 'board', id: 'p-test-user', mid: 'board-1', table: 'A', size: 16, cells: 'A'.repeat(256), revision: 1 },
    { t: 'gallery:add', id: 'p-test-user', mid: 'gallery-1', item: { id: 'wish-1', author: '测试玩家', pixels: 'AAAA', wallId: 'north', wallU: 1, wallY: 3 } },
    { t: 'table:drink', id: 'p-test-user', mid: 'drink-1', table: 'A', item: { id: 'latte', sips: 5 } },
    { t: 'player:save', id: 'p-test-user', mid: 'player-1', state: { nickname: '测试玩家', hand: { board: 'A' } } }
  ];
  for (const message of messages) assert.equal((await post(running.origin, message)).status, 202);

  let snapshot = await (await fetch(`${running.origin}/api/room?boards=1&gallery=1&drinks=1&player=p-test-user`)).json();
  assert.equal(snapshot.durable, true);
  assert.equal(snapshot.boards[0].table, 'A');
  assert.equal(snapshot.gallery[0].id, 'wish-1');
  assert.equal(snapshot.tableDrinks[0].item.id, 'latte');
  assert.equal(snapshot.player.nickname, '测试玩家');

  const heldProduct = { id: 'wish-1', size: 16, pixels: 'A'.repeat(256), mount: 'frame' };
  assert.equal((await post(running.origin, { t: 'gallery:remove', id: 'p-test-user', mid: 'gallery-remove-1', itemId: 'wish-1', state: { nickname: '测试玩家', hand: { product: heldProduct } } })).status, 202);
  snapshot = await (await fetch(`${running.origin}/api/room?gallery=1&player=p-test-user`)).json();
  assert.equal(snapshot.gallery.length, 0);
  assert.equal(snapshot.player.hand.product.id, 'wish-1');

  await running.app.close();
  running = await start(dataDir);
  t.after(() => running.app.server.listening && running.app.close());
  snapshot = await (await fetch(`${running.origin}/api/room?boards=1&gallery=1&drinks=1&player=p-test-user`)).json();
  assert.equal(snapshot.boards[0].mid, 'board-1');
  assert.equal(snapshot.boards[0].revision, 1);
  assert.equal(snapshot.gallery.length, 0);
  assert.equal(snapshot.player.hand.product.id, 'wish-1');

  assert.equal((await post(running.origin, { t: 'gallery:put', id: 'p-test-user', mid: 'gallery-put-2', item: { id: 'wish-1', author: '测试玩家', pixels: 'AAAA', wallId: 'east', wallU: 4, wallY: 2 }, state: { nickname: '测试玩家', hand: { product: null } } })).status, 202);
  await running.app.close();
  running = await start(dataDir);
  snapshot = await (await fetch(`${running.origin}/api/room?gallery=1`)).json();
  assert.equal(snapshot.gallery[0].wallId, 'east');
  assert.equal(snapshot.gallery[0].wallU, 4);
  snapshot = await (await fetch(`${running.origin}/api/room?player=p-test-user`)).json();
  assert.equal(snapshot.player.hand.product, null);
});

test('rejects stale board snapshots so placed beads cannot roll back', async t => {
  const dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bead-house-board-version-'));
  const { app, origin } = await start(dataDir);
  t.after(async () => {
    await app.close();
    await fsp.rm(dataDir, { recursive: true, force: true });
  });
  const latest = { t: 'board', id: 'p-board', mid: 'board-new', table: 'A', size: 16, cells: 'AA' + '.'.repeat(254), revision: 2 };
  const stale = { t: 'board', id: 'p-board', mid: 'board-old', table: 'A', size: 16, cells: 'A' + '.'.repeat(255), revision: 1 };
  assert.equal((await post(origin, latest)).status, 202);
  const staleResponse = await (await post(origin, stale)).json();
  assert.equal(staleResponse.stale, true);
  assert.equal(staleResponse.board.revision, 2);
  const snapshot = await (await fetch(`${origin}/api/room?boards=1`)).json();
  assert.equal(snapshot.boards[0].revision, 2);
  assert.equal(snapshot.boards[0].cells.slice(0, 2), 'AA');
});

test('merges simultaneous cell patches on every durable multiplayer table', async t => {
  const dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bead-house-collab-'));
  let running = await start(dataDir);
  t.after(async () => {
    if (running.app.server.listening) await running.app.close();
    await fsp.rm(dataDir, { recursive: true, force: true });
  });

  const patches = [
    { t: 'board:patch', id: 'p-collab-a', mid: 'collab-a-1', table: 'M', size: 64, changes: [[17, 'A'], [18, 'B']] },
    { t: 'board:patch', id: 'p-collab-b', mid: 'collab-b-1', table: 'M', size: 64, changes: [[19, 'C'], [20, 'D']] }
  ];
  const responses = await Promise.all(patches.map(message => post(running.origin, message)));
  assert.deepEqual(responses.map(response => response.status), [202, 202]);

  let snapshot = await (await fetch(`${running.origin}/api/room?boards=1`)).json();
  let board = snapshot.boards.find(item => item.table === 'M');
  assert.equal(board.size, 64);
  assert.equal(board.cells.slice(17, 21), 'ABCD');
  assert.equal(board.revision, 2);

  const smallTablePatches = [
    { t: 'board:patch', id: 'p-table-a', mid: 'table-a-1', table: 'A', size: 16, changes: [[41, 'E'], [42, 'F']] },
    { t: 'board:patch', id: 'p-table-b', mid: 'table-b-1', table: 'A', size: 16, changes: [[43, 'G'], [44, 'H']] }
  ];
  const smallResponses = await Promise.all(smallTablePatches.map(message => post(running.origin, message)));
  assert.deepEqual(smallResponses.map(response => response.status), [202, 202]);
  snapshot = await (await fetch(`${running.origin}/api/room?boards=1`)).json();
  const smallBoard = snapshot.boards.find(item => item.table === 'A');
  assert.equal(smallBoard.cells.slice(41, 45), 'EFGH');
  assert.equal(smallBoard.revision, 2);
  const staleReplace = await (await post(running.origin, {
    t: 'board', id: 'p-table-a', mid: 'table-a-stale-replace', table: 'A', size: 32,
    cells: '.'.repeat(32 * 32), baseRevision: 1
  })).json();
  assert.equal(staleReplace.stale, true);
  assert.equal(staleReplace.board.size, 16);
  assert.equal(staleReplace.board.cells.slice(41, 45), 'EFGH');

  assert.equal((await post(running.origin, { t: 'board', id: 'p-collab-a', mid: 'collab-full', table: 'M', size: 64, cells: '.'.repeat(4096), revision: 3 })).status, 400);

  await running.app.close();
  running = await start(dataDir);
  snapshot = await (await fetch(`${running.origin}/api/room?boards=1`)).json();
  board = snapshot.boards.find(item => item.table === 'M');
  assert.equal(board.cells.slice(17, 21), 'ABCD');
  assert.equal(board.revision, 2);
  assert.equal(snapshot.boards.find(item => item.table === 'A').cells.slice(41, 45), 'EFGH');
});

test('relays live multiplayer messages through the same-origin WebSocket', async t => {
  const dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'bead-house-ws-'));
  const { app, wsOrigin } = await start(dataDir);
  t.after(async () => {
    await app.close();
    await fsp.rm(dataDir, { recursive: true, force: true });
  });
  const a = new WebSocket(`${wsOrigin}/api/ws`);
  const b = new WebSocket(`${wsOrigin}/api/ws`);
  await Promise.all([a, b].map(socket => new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  })));
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('relay timeout')), 2000);
    b.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.mid === 'live-1') { clearTimeout(timer); resolve(message); }
    });
  });
  a.send(JSON.stringify({ t: 'state', id: 'p-live-a', mid: 'live-1', x: 2, z: 3 }));
  assert.equal((await received).x, 2);
  a.close();
  b.close();
});
