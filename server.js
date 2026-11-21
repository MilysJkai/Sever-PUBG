// Server tổ đội cho Mini PUBG 3D. Chạy:  npm install  rồi  npm start   (mặc định cổng 8787)
// Chỉ làm 1 việc: tạo phòng theo mã, báo danh sách thành viên cho mọi người trong phòng.
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8787;
const MAX_MEMBERS = 4;
const LOOKS = 6;                                  // số bộ màu nhân vật (khớp LOOKS ở client)
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ O/0/I/1 cho dễ đọc

const rooms = new Map();                          // code -> { code, hostId, members: Map(id -> member) }
let nextId = 1;

const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

function genCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    if (!rooms.has(c)) return c;
  }
}

function cleanName(s) {
  s = String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return s || 'PLAYER';
}
const cleanLook = n => { n = Number(n); return Number.isInteger(n) && n >= 0 && n < LOOKS ? n : 0; };

function broadcast(room) {
  const members = [...room.members.values()].map(m => ({ id: m.id, name: m.name, look: m.look }));
  for (const m of room.members.values()) send(m.ws, { t: 'party', code: room.code, selfId: m.id, hostId: room.hostId, members });
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.members.delete(ws.id);
  ws.room = null;
  if (room.members.size === 0) { rooms.delete(room.code); return; }
  if (room.hostId === ws.id) room.hostId = room.members.keys().next().value;
  broadcast(room);
}

function enter(ws, room, msg) {
  ws.room = room;
  room.members.set(ws.id, { id: ws.id, ws, name: cleanName(msg.name), look: cleanLook(msg.look) });
  if (!room.hostId) room.hostId = ws.id;
  broadcast(room);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('mini-pubg-server ok');
});

const wss = new WebSocketServer({ server, maxPayload: 16384 });

wss.on('connection', ws => {
  ws.id = nextId++;
  ws.room = null;
  ws.alive = true;
  ws.hits = 0;
  ws.on('pong', () => { ws.alive = true; });

  ws.on('message', raw => {
    if (++ws.hits > 120) return;                  // chống spam (120 tin / giây, voice cần gửi nhiều tin ICE)
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    switch (msg.t) {
      case 'ping': send(ws, { t: 'pong' }); break;
      case 'create': {
        leave(ws);
        const room = { code: genCode(), hostId: null, members: new Map() };
        rooms.set(room.code, room);
        enter(ws, room, msg);
        break;
      }
      case 'join': {
        const code = String(msg.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        let room = rooms.get(code);
        if (!room && msg.rejoin && code.length === 5) {   // server vừa khởi động lại: dựng lại phòng cũ
          room = { code, hostId: null, members: new Map() };
          rooms.set(code, room);
        }
        if (!room) { send(ws, { t: 'error', msg: 'Mã tổ đội không tồn tại' }); break; }
        if (room.members.size >= MAX_MEMBERS && !room.members.has(ws.id)) { send(ws, { t: 'error', msg: 'Tổ đội đã đầy (tối đa ' + MAX_MEMBERS + ')' }); break; }
        if (ws.room !== room) { leave(ws); enter(ws, room, msg); }
        break;
      }
      case 'profile': {
        const m = ws.room && ws.room.members.get(ws.id);
        if (m) { m.name = cleanName(msg.name); if (msg.look !== undefined) m.look = cleanLook(msg.look); broadcast(ws.room); }
        break;
      }
      case 'sig': {                                   // chuyển tin báo hiệu voice (WebRTC) tới đúng 1 người cùng phòng
        const target = ws.room && ws.room.members.get(Number(msg.to));
        if (target && msg.data && typeof msg.data === 'object') send(target.ws, { t: 'sig', from: ws.id, data: msg.data });
        break;
      }
      case 'leave': leave(ws); send(ws, { t: 'left' }); break;
    }
  });

  ws.on('close', () => leave(ws));
  ws.on('error', () => {});
});

setInterval(() => { for (const ws of wss.clients) ws.hits = 0; }, 1000);
setInterval(() => {                               // dọn kết nối chết
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log('Mini PUBG server đang chạy ở cổng ' + PORT));
