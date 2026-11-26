'use strict';

const clients = new Set();

function broadcast(message) {
  for (const client of clients) {
    if (!client.write(message)) client.destroy();
  }
}

function subscribe(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'X-Accel-Buffering': 'no'
  });
  res.on('close', () => clients.delete(res));
  clients.add(res);
  res.write(': connected\n\n');
}

function publish(resource) {
  broadcast(`event: update\ndata: ${resource}\n\n`);
}

setInterval(() => broadcast(': heartbeat\n\n'), 15000).unref();

module.exports = { publish, subscribe };
