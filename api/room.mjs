import { getCache } from '@vercel/functions';
import { cloudAvailable, cloudPath, listCloudJson, readCloudJson, writeCloudJson } from './_cloud.mjs';

const cache = getCache({ namespace: 'bead-house-room-v1' });
const TABLES = Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index));
const ALLOWED_TYPES = new Set(['hi', 'bye', 'state', 'board', 'gallery:add', 'table:drink', 'player:save']);
const MAX_BODY_BYTES = 128 * 1024;
const EVENTS_KEY = 'events';
const GALLERY_KEY = 'gallery';
const CLOUD_SEEDED_KEY = 'cloud-seeded-v1';

function reply(response, status, value) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(value));
}

async function readMessage(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('payload-too-large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validMessage(message) {
  return message && ALLOWED_TYPES.has(message.t) && typeof message.id === 'string' && message.id.length <= 96 &&
    typeof message.mid === 'string' && message.mid.length <= 128;
}

async function cacheForever(key, value, name) {
  await cache.set(key, value, { ttl: 31536000, tags: ['bead-house-room'], name });
}

async function ensureCloudSeeded() {
  if (!cloudAvailable() || await cache.get(CLOUD_SEEDED_KEY)) return;
  const [gallery, ...boards] = await Promise.all([
    cache.get(GALLERY_KEY),
    ...TABLES.map(table => cache.get(`board:${table}`))
  ]);
  const writes = [];
  for (const board of boards) if (board?.table) writes.push(writeCloudJson(cloudPath('boards', board.table), board));
  for (const item of Array.isArray(gallery) ? gallery : []) if (item?.id) writes.push(writeCloudJson(cloudPath('gallery', item.id), item));
  await Promise.all(writes);
  await cacheForever(CLOUD_SEEDED_KEY, { at: Date.now() }, 'cloud-seeded');
}

async function loadBoards() {
  return (await Promise.all(TABLES.map(async table => {
    let board = await cache.get(`board:${table}`);
    if (!board && cloudAvailable()) {
      board = await readCloudJson(cloudPath('boards', table));
      if (board) await cacheForever(`board:${table}`, board, 'latest-board');
    }
    return board;
  }))).filter(Boolean);
}

async function loadGallery() {
  let gallery = await cache.get(GALLERY_KEY);
  gallery = Array.isArray(gallery) ? gallery : [];
  if (cloudAvailable()) {
    const cloudItems = await listCloudJson('gallery');
    const byId = new Map(gallery.filter(Boolean).map(item => [item.id, item]));
    for (const item of cloudItems) if (item?.id) byId.set(item.id, item);
    gallery = [...byId.values()];
    await cacheForever(GALLERY_KEY, gallery, 'wish-wall');
  }
  return gallery;
}

async function loadTableDrinks() {
  return Promise.all(TABLES.map(async table => {
    let record = await cache.get(`drink:${table}`);
    if (!record && cloudAvailable()) {
      record = await readCloudJson(cloudPath('table-drinks', table));
      if (record) await cacheForever(`drink:${table}`, record, 'table-drink');
    }
    return record || { t: 'table:drink', table, item: null, _roomAt: 0 };
  }));
}

async function loadPlayer(playerId) {
  if (!playerId || playerId.length > 96) return null;
  let record = await cache.get(`player:${playerId}`);
  if (!record && cloudAvailable()) {
    record = await readCloudJson(cloudPath('players', playerId));
    if (record) await cacheForever(`player:${playerId}`, record, 'player-progress');
  }
  return record?.state || null;
}

async function roomSnapshot({ includeBoards, includeGallery, includeDrinks, playerId }) {
  await ensureCloudSeeded();
  const events = (await cache.get(EVENTS_KEY)) || [];
  const result = { ok: true, durable: cloudAvailable(), events: Array.isArray(events) ? events : [] };
  if (includeBoards) result.boards = await loadBoards();
  if (includeGallery) result.gallery = await loadGallery();
  if (includeDrinks) result.tableDrinks = await loadTableDrinks();
  if (playerId) result.player = await loadPlayer(playerId);
  return result;
}

async function appendEvent(received) {
  const current = await cache.get(EVENTS_KEY);
  const events = (Array.isArray(current) ? current : []).filter(event => Date.now() - (event?._roomAt || 0) < 120000);
  if (!events.some(event => event?.mid === received.mid)) events.push(received);
  await cache.set(EVENTS_KEY, events.slice(-240), { ttl: 180, tags: ['bead-house-room'], name: 'room-events' });
}

async function persistMessage(message, received) {
  if (message.t === 'board' && TABLES.includes(message.table) && typeof message.cells === 'string') {
    await Promise.all([
      cacheForever(`board:${message.table}`, received, 'latest-board'),
      writeCloudJson(cloudPath('boards', message.table), received)
    ]);
    return;
  }

  if (message.t === 'gallery:add' && message.item && typeof message.item.id === 'string') {
    const current = await cache.get(GALLERY_KEY);
    const gallery = Array.isArray(current) ? current : [];
    if (!gallery.some(item => item?.id === message.item.id)) gallery.push(message.item);
    await Promise.all([
      cacheForever(GALLERY_KEY, gallery, 'wish-wall'),
      writeCloudJson(cloudPath('gallery', message.item.id), message.item),
      appendEvent(received)
    ]);
    return;
  }

  if (message.t === 'table:drink' && TABLES.includes(message.table) && (message.item === null || typeof message.item === 'object')) {
    const record = { ...received, item: message.item || null };
    await Promise.all([
      cacheForever(`drink:${message.table}`, record, 'table-drink'),
      writeCloudJson(cloudPath('table-drinks', message.table), record),
      appendEvent(record)
    ]);
    return;
  }

  if (message.t === 'player:save' && message.state && typeof message.state === 'object') {
    const record = { ...received, state: message.state };
    await Promise.all([
      cacheForever(`player:${message.id}`, record, 'player-progress'),
      writeCloudJson(cloudPath('players', message.id), record)
    ]);
    return;
  }

  await appendEvent(received);
}

export default async function room(request, response) {
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.setHeader('allow', 'GET, POST, OPTIONS');
    response.end();
    return;
  }

  if (request.method === 'GET') {
    const url = new URL(request.url, 'https://bead-house.local');
    try {
      reply(response, 200, await roomSnapshot({
        includeBoards: url.searchParams.has('boards'),
        includeGallery: url.searchParams.has('gallery'),
        includeDrinks: url.searchParams.has('drinks'),
        playerId: url.searchParams.get('player')
      }));
    } catch (error) {
      console.error('room snapshot failed', error);
      reply(response, 503, { ok: false, error: 'room-unavailable' });
    }
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('allow', 'GET, POST, OPTIONS');
    reply(response, 405, { ok: false, error: 'method-not-allowed' });
    return;
  }

  try {
    const message = await readMessage(request);
    if (!validMessage(message)) {
      reply(response, 400, { ok: false, error: 'invalid-message' });
      return;
    }

    const received = { ...message, _roomAt: Date.now() };
    await persistMessage(message, received);

    reply(response, 202, { ok: true, durable: cloudAvailable(), mid: message.mid });
  } catch (error) {
    if (error?.message === 'payload-too-large') reply(response, 413, { ok: false, error: 'payload-too-large' });
    else {
      console.error('room message failed', error);
      reply(response, 503, { ok: false, error: 'room-unavailable' });
    }
  }
}
