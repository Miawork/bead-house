import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

// Same-origin multiplayer relay for the deployed game. Vercel owns the HTTP
// listener; exporting the server lets its runtime handle WebSocket upgrades.
const server = createServer((_request, response) => {
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify({ ok: true, service: 'bead-house-relay' }));
});

const MAX_MESSAGE_BYTES = 128 * 1024;
const galleryMessages = new Map();
const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });

wss.on('connection', socket => {
  for (const message of galleryMessages.values()) socket.send(message);
  socket.send(JSON.stringify({ t: 'hi', id: 'wish-wall-server' }));
  socket.on('message', data => {
    if (data.byteLength > MAX_MESSAGE_BYTES) return;
    try {
      const message = JSON.parse(data.toString());
      if (message?.t === 'gallery:add' && typeof message.item?.id === 'string') {
        galleryMessages.set(message.item.id, JSON.stringify({ ...message, sync: true }));
      }
    } catch (_error) {
      return;
    }
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === WebSocket.OPEN) client.send(data);
    }
  });
});

export default server;
