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
  assert.match(await home.text(), /mobileSceneZoom/);

  const messages = [
    { t: 'board', id: 'p-test-user', mid: 'board-1', table: 'A', size: 16, cells: 'A'.repeat(256) },
    { t: 'gallery:add', id: 'p-test-user', mid: 'gallery-1', item: { id: 'wish-1', author: '测试玩家', pixels: 'AAAA' } },
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

  await running.app.close();
  running = await start(dataDir);
  t.after(() => running.app.server.listening && running.app.close());
  snapshot = await (await fetch(`${running.origin}/api/room?boards=1&gallery=1&drinks=1&player=p-test-user`)).json();
  assert.equal(snapshot.boards[0].mid, 'board-1');
  assert.equal(snapshot.gallery[0].id, 'wish-1');
  assert.equal(snapshot.player.hand.board, 'A');
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
