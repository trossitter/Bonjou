import http from 'http';
import { Server } from 'socket.io';
import { env } from './env';
import { createApp } from './app';

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: env.CLIENT_ORIGIN, credentials: true }
});

server.on('request', createApp(io));

io.on('connection', (socket) => {
  socket.emit('connected', { ok: true });
});

server.listen(env.PORT, () => {
  console.log(`Bonjou API listening on :${env.PORT}`);
});
