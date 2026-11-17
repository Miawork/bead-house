// Railway-ready single-process server for Bead House.
//
// It serves the game, relays WebSocket messages, exposes the durable room API,
// and stores every board/player/drink/wish-wall update on a mounted cloud disk.
// Existing Vercel data is imported lazily so returning players keep their work.

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');

const ROOT = __dirname;
const COLLAB_TABLE = 'M';
const TABLES = [...Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index)), COLLAB_TABLE];
const BOARD_SIZES = new Set([16, 29, 32, 48, 52, 58, 64, 78, 87, 96, 104, 116, 128, 156, 208, 256]);
const ALLOWED_TYPES = new Set(['hi', 'bye', 'state', 'board', 'board:patch', 'gallery:add', 'gallery:put', 'gallery:remove', 'table:drink', 'player:save']);
const CELL_CHARS = '.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+-:;=?@^_~<>()[]{}';
const MAX_MESSAGE_BYTES = 128 * 1024;
const DEFAULT_LEGACY_ROOM_URL = 'https://bead-house-stage2-1-preview.vercel.app/api/room';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
};

function emptyStore() {
  return { version: 2, legacySeeded: false, boards: {}, gallery: {}, galleryRemoved: {}, drinks: {}, players: {} };
}

function normalizeStore(value) {
  const clean = emptyStore();
  if (!value || typeof value !== 'object') return clean;
  clean.legacySeeded = Boolean(value.legacySeeded);
  for (const key of ['gallery', 'galleryRemoved', 'drinks', 'players']) {
    if (value[key] && typeof value[key] === 'object' && !Array.isArray(value[key])) clean[key] = value[key];
  }
  if (value.boards && typeof value.boards === 'object' && !Array.isArray(value.boards)) {
    for (const [table, board] of Object.entries(value.boards)) {
      if (TABLES.includes(table) && board && typeof board === 'object') clean.boards[table] = {
        ...board,
        revision: Number.isSafeInteger(board.revision) && board.revision >= 0 ? board.revision : 1
      };
    }
  }
  return clean;
}

function validMessage(message) {
  return message && ALLOWED_TYPES.has(message.t) && typeof message.id === 'string' && message.id.length <= 96 &&
    typeof message.mid === 'string' && message.mid.length <= 128;
}

function createBeadHouseServer(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(ROOT, '.data');
  const dataFile = path.join(dataDir, 'bead-house-state.json');
  const legacyRoomUrl = options.legacyRoomUrl === undefined
    ? (process.env.LEGACY_ROOM_URL || DEFAULT_LEGACY_ROOM_URL)
    : options.legacyRoomUrl;
  const store = emptyStore();
  const events = [];
  const seenMids = new Map();
  let writeChain = Promise.resolve();
  let readyError = null;

  function durableSnapshot() {
    return JSON.stringify({
      version: 2,
      legacySeeded: store.legacySeeded,
      boards: store.boards,
      gallery: store.gallery,
      galleryRemoved: store.galleryRemoved,
      drinks: store.drinks,
      players: store.players
    });
  }

  function persist() {
    const snapshot = durableSnapshot();
    writeChain = writeChain.then(async () => {
      await fsp.mkdir(dataDir, { recursive: true });
      const temporary = `${dataFile}.${process.pid}.tmp`;
      await fsp.writeFile(temporary, snapshot, 'utf8');
      await fsp.rename(temporary, dataFile);
    });
    return writeChain;
  }

  function trimEvents() {
    const cutoff = Date.now() - 120000;
    while (events.length && Number(events[0]?._roomAt || 0) < cutoff) events.shift();
    if (events.length > 240) events.splice(0, events.length - 240);
    for (const [mid, outcome] of seenMids) if (Number(outcome?.at || 0) < cutoff) seenMids.delete(mid);
  }

  function appendEvent(message) {
    trimEvents();
    if (!events.some(event => event?.mid === message.mid)) events.push(message);
    if (events.length > 240) events.splice(0, events.length - 240);
  }

  async function importLegacyPlayer(playerId) {
    if (!legacyRoomUrl || store.players[playerId]) return store.players[playerId] || null;
    try {
      const url = new URL(legacyRoomUrl);
      url.searchParams.set('player', playerId);
      const response = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { accept: 'application/json' } });
      if (!response.ok) return null;
      const payload = await response.json();
      if (payload?.player && typeof payload.player === 'object') {
        store.players[playerId] = payload.player;
        await persist();
        return payload.player;
      }
    } catch (error) {
      console.warn('Legacy player import skipped:', error.message);
    }
    return null;
  }

  async function seedLegacyRoom() {
    if (!legacyRoomUrl || store.legacySeeded) return;
    try {
      const url = new URL(legacyRoomUrl);
      for (const key of ['boards', 'gallery', 'drinks']) url.searchParams.set(key, '1');
      const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      for (const board of payload.boards || []) {
        if (TABLES.includes(board?.table) && !store.boards[board.table]) store.boards[board.table] = {
          ...board,
          revision: Number.isSafeInteger(board.revision) && board.revision >= 0 ? board.revision : 1
        };
      }
      for (const item of payload.gallery || []) {
        if (typeof item?.id === 'string' && !store.gallery[item.id] && !store.galleryRemoved[item.id]) store.gallery[item.id] = item;
      }
      for (const drink of payload.tableDrinks || []) {
        if (TABLES.includes(drink?.table) && !store.drinks[drink.table]) store.drinks[drink.table] = drink;
      }
      store.legacySeeded = true;
      await persist();
      console.log(`Imported legacy room: ${Object.keys(store.boards).length} boards, ${Object.keys(store.gallery).length} wall pieces.`);
    } catch (error) {
      // Keep legacySeeded false so the next restart can retry without overwriting new data.
      console.warn('Legacy room import will retry later:', error.message);
    }
  }

  async function initialize() {
    await fsp.mkdir(dataDir, { recursive: true });
    try {
      const loaded = normalizeStore(JSON.parse(await fsp.readFile(dataFile, 'utf8')));
      Object.assign(store, loaded);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await persist();
    }
    await seedLegacyRoom();
  }

  const ready = initialize().catch(error => {
    readyError = error;
    console.error('Persistent store failed to initialize:', error);
    throw error;
  });

  async function acceptMessage(message) {
    if (!validMessage(message)) return { accepted: false, reason: 'invalid-message' };
    trimEvents();
    if (seenMids.has(message.mid)) return { accepted: true, duplicate: true, ...seenMids.get(message.mid) };
    const received = { ...message, _roomAt: Date.now() };
    let changed = false;
    let stale = false;
    let authoritative = received;
    let authoritativeBoard = null;

    if (message.t === 'board' && message.table === COLLAB_TABLE) {
      return { accepted: false, reason: 'collab-board-requires-patches' };
    }
    if (message.t === 'board' && TABLES.includes(message.table) && BOARD_SIZES.has(message.size) &&
      typeof message.cells === 'string' && message.cells.length === message.size * message.size &&
      [...message.cells].every(value => CELL_CHARS.includes(value))) {
      const current = store.boards[message.table];
      const currentRevision = Number.isSafeInteger(current?.revision) ? current.revision : 0;
      const guardedReplace = Number.isSafeInteger(message.baseRevision) && message.baseRevision >= 0;
      const proposedRevision = guardedReplace
        ? currentRevision + 1
        : (Number.isSafeInteger(message.revision) && message.revision >= 0 ? message.revision : currentRevision + 1);
      if (current && ((guardedReplace && message.baseRevision !== currentRevision) || (!guardedReplace && proposedRevision <= currentRevision))) {
        stale = true;
        authoritative = current;
      } else {
        authoritative = { ...received, revision: proposedRevision };
        store.boards[message.table] = authoritative;
        changed = true;
      }
      authoritativeBoard = authoritative;
    } else if (message.t === 'board:patch' && TABLES.includes(message.table) && BOARD_SIZES.has(message.size) &&
      (message.table !== COLLAB_TABLE || message.size === 64) &&
      Array.isArray(message.changes) && message.changes.length > 0 && message.changes.length <= 1024) {
      const current = store.boards[message.table];
      if (current && (current.size !== message.size || typeof current.cells !== 'string' || current.cells.length !== message.size * message.size)) {
        stale = true;
        authoritative = current;
        authoritativeBoard = current;
      } else {
        const source = current?.size === message.size && typeof current.cells === 'string' && current.cells.length === message.size * message.size
          ? current.cells
          : '.'.repeat(message.size * message.size);
        const cells = source.split('');
        const validChanges = [];
        for (const change of message.changes) {
          const index = change?.[0], value = change?.[1];
          if (!Number.isInteger(index) || index < 0 || index >= cells.length || typeof value !== 'string' ||
            value.length !== 1 || !CELL_CHARS.includes(value)) continue;
          cells[index] = value;
          validChanges.push([index, value]);
        }
        if (!validChanges.length) return { accepted: false, reason: 'invalid-board-patch' };
        const revision = (Number.isSafeInteger(current?.revision) ? current.revision : 0) + 1;
        authoritative = { ...received, changes: validChanges, revision };
        authoritativeBoard = { t: 'board', id: message.id, mid: message.mid, table: message.table, size: message.size,
          cells: cells.join(''), revision, _roomAt: received._roomAt };
        store.boards[message.table] = authoritativeBoard;
        changed = true;
      }
    } else if (message.t === 'gallery:add' && message.item && typeof message.item.id === 'string') {
      if (!store.gallery[message.item.id] && !store.galleryRemoved[message.item.id]) store.gallery[message.item.id] = message.item;
      appendEvent(received);
      changed = true;
    } else if (message.t === 'gallery:put' && message.item && typeof message.item.id === 'string') {
      store.gallery[message.item.id] = message.item;
      delete store.galleryRemoved[message.item.id];
      if (message.state && typeof message.state === 'object') store.players[message.id] = message.state;
      appendEvent(received);
      changed = true;
    } else if (message.t === 'gallery:remove' && typeof message.itemId === 'string' && message.itemId.length <= 96) {
      delete store.gallery[message.itemId];
      store.galleryRemoved[message.itemId] = received._roomAt;
      if (message.state && typeof message.state === 'object') store.players[message.id] = message.state;
      appendEvent(received);
      changed = true;
    } else if (message.t === 'table:drink' && TABLES.includes(message.table) &&
      (message.item === null || typeof message.item === 'object')) {
      store.drinks[message.table] = { ...received, item: message.item || null };
      appendEvent(store.drinks[message.table]);
      changed = true;
    } else if (message.t === 'player:save' && message.state && typeof message.state === 'object') {
      store.players[message.id] = message.state;
      changed = true;
    } else {
      appendEvent(received);
    }

    const outcome = { received: authoritative, board: authoritativeBoard, stale, at: received._roomAt };
    seenMids.set(message.mid, outcome);
    if (changed) await persist();
    return { accepted: true, ...outcome };
  }

  function reply(response, status, value) {
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    });
    response.end(JSON.stringify(value));
  }

  async function readJson(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_MESSAGE_BYTES) throw new Error('payload-too-large');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }

  async function handleRoom(request, response, url) {
    await ready;
    if (request.method === 'OPTIONS') return reply(response, 204, {});
    if (request.method === 'GET') {
      trimEvents();
      const playerId = url.searchParams.get('player');
      const player = playerId && playerId.length <= 96
        ? (store.players[playerId] || await importLegacyPlayer(playerId))
        : null;
      const payload = { ok: true, durable: true, events: [...events] };
      if (url.searchParams.has('boards')) payload.boards = TABLES.map(table => store.boards[table]).filter(Boolean);
      if (url.searchParams.has('gallery')) payload.gallery = Object.values(store.gallery);
      if (url.searchParams.has('drinks')) payload.tableDrinks = TABLES.map(table => store.drinks[table] || { t: 'table:drink', table, item: null, _roomAt: 0 });
      if (playerId) payload.player = player || null;
      return reply(response, 200, payload);
    }
    if (request.method !== 'POST') return reply(response, 405, { ok: false, error: 'method-not-allowed' });
    try {
      const message = await readJson(request);
      const result = await acceptMessage(message);
      if (!result.accepted) return reply(response, 400, { ok: false, error: result.reason });
      return reply(response, 202, {
        ok: true,
        durable: true,
        mid: message.mid,
        ...(['board', 'board:patch'].includes(message.t) ? { stale: result.stale, board: result.board || result.received } : {})
      });
    } catch (error) {
      if (error.message === 'payload-too-large') return reply(response, 413, { ok: false, error: 'payload-too-large' });
      console.error('Room message failed:', error);
      return reply(response, 503, { ok: false, error: 'room-unavailable' });
    }
  }

  function publicFilePath(urlPath) {
    let pathname;
    try { pathname = decodeURIComponent(urlPath); } catch (_error) { return null; }
    if (pathname === '/') pathname = '/index.html';
    if (!/^\/(index\.html|src\/[^/]+|assets\/[^/]+)$/.test(pathname)) return null;
    const target = path.resolve(ROOT, `.${pathname}`);
    return target.startsWith(`${ROOT}${path.sep}`) ? target : null;
  }

  async function handleStatic(request, response, url) {
    if (!['GET', 'HEAD'].includes(request.method)) return reply(response, 405, { ok: false, error: 'method-not-allowed' });
    const target = publicFilePath(url.pathname);
    if (!target) return reply(response, 404, { ok: false, error: 'not-found' });
    try {
      const stat = await fsp.stat(target);
      const headers = {
        'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'content-length': stat.size,
        'cache-control': url.pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache'
      };
      response.writeHead(200, headers);
      if (request.method === 'HEAD') return response.end();
      fs.createReadStream(target).pipe(response);
    } catch (_error) {
      reply(response, 404, { ok: false, error: 'not-found' });
    }
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://bead-house.local');
    try {
      if (url.pathname === '/healthz') {
        return reply(response, readyError ? 503 : 200, { ok: !readyError, durable: true });
      }
      if (url.pathname === '/api/room') return await handleRoom(request, response, url);
      if (url.pathname === '/api/ws') return reply(response, 200, { ok: true, service: 'bead-house-relay' });
      return await handleStatic(request, response, url);
    } catch (error) {
      console.error('Request failed:', error);
      return reply(response, 503, { ok: false, error: 'service-unavailable' });
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });
  wss.on('connection', socket => {
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    for (const item of Object.values(store.gallery)) {
      socket.send(JSON.stringify({ t: 'gallery:put', id: 'wish-wall-server', item, sync: true }));
    }
    socket.send(JSON.stringify({ t: 'hi', id: 'wish-wall-server' }));
    socket.on('message', async data => {
      if (data.byteLength > MAX_MESSAGE_BYTES) return;
      let message;
      try { message = JSON.parse(data.toString()); } catch (_error) { return; }
      if (!validMessage(message)) return;
      let result;
      try { result = await acceptMessage(message); } catch (error) { console.error('WebSocket persistence failed:', error); return; }
      if (!result.accepted) return;
      const payload = JSON.stringify(result.received || message);
      for (const client of wss.clients) {
        const includeSender = message.t === 'board' || message.t === 'board:patch';
        if ((includeSender || client !== socket) && client.readyState === WebSocket.OPEN) client.send(payload);
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    let url;
    try { url = new URL(request.url, 'http://bead-house.local'); } catch (_error) { socket.destroy(); return; }
    if (url.pathname !== '/api/ws') { socket.destroy(); return; }
    ready.then(() => wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request))).catch(() => socket.destroy());
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 25000);
  heartbeat.unref();

  async function close() {
    clearInterval(heartbeat);
    for (const socket of wss.clients) socket.close(1001, 'server-shutdown');
    await writeChain;
    await new Promise(resolve => server.close(resolve));
  }

  return { server, wss, store, ready, acceptMessage, close, dataFile };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8787;
  const app = createBeadHouseServer();
  app.ready.then(() => {
    app.server.listen(port, '0.0.0.0', () => console.log(`Bead House listening on http://0.0.0.0:${port}`));
  }).catch(() => { process.exitCode = 1; });
}

module.exports = { createBeadHouseServer };
