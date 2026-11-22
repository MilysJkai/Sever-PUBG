// Ghép trận: tổ đội cùng chế độ (SOLO / ĐÔI / 4 / 5) vào chung 1 hàng đợi, chờ một lúc rồi điền bot cho đủ chỗ, đếm ngược và bắt đầu.
// Mỗi trận chạy trong 1 worker thread (match-worker.js). Module này chỉ làm việc với "ws" có send() / readyState nên test được không cần mạng.
import { Worker } from 'node:worker_threads';
import { randomBytes } from 'node:crypto';

const cfg = {
  total: Number(process.env.MATCH_TOTAL) || 20,           // tổng số thực thể mỗi trận (người + bot)
  waitMs: Number(process.env.QUEUE_WAIT_MS) || 20000,     // chờ ghép trận kể từ khi có tổ đội đầu tiên
  countdown: Number(process.env.COUNTDOWN_S) || 5,
  graceS: Number(process.env.GRACE_S) || 60,              // rớt mạng quá bao lâu thì bỏ trận
  overLingerS: Number(process.env.OVER_LINGER_S) || 20
};

const queues = new Map();      // size -> { size, tickets: [], timer, deadline }
const tokens = new Map();      // token -> { match, pid }
const matches = new Set();
let nextMatchId = 1;

const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
const humansIn = q => q.tickets.reduce((n, t) => n + t.socks.length, 0);

function getQ(size) {
  let q = queues.get(size);
  if (!q) { q = { size, tickets: [], timer: null, deadline: 0 }; queues.set(size, q); }
  return q;
}

function notify(q) {
  const humans = humansIn(q), waitMs = Math.max(0, q.deadline - Date.now());
  for (const t of q.tickets) for (const w of t.socks) send(w, { t: 'queue', state: 'searching', size: q.size, humans, waitMs });
}

/** Đưa cả một tổ đội (hoặc 1 người chơi solo) vào hàng đợi. Trả về chuỗi lỗi hoặc null. */
export function enqueue(socks, size) {
  for (const w of socks) {
    if (w.mm) return 'Đang trong trận';
    if (w.ticket) return 'Đang tìm trận';
  }
  const q = getQ(size);
  if (humansIn(q) + socks.length > cfg.total) launch(q);   // hết chỗ: những người đang chờ vào trận trước
  const t = { size, socks: socks.slice() };
  for (const w of socks) w.ticket = t;
  q.tickets.push(t);
  if (!q.timer) { q.deadline = Date.now() + cfg.waitMs; q.timer = setTimeout(() => launch(q), cfg.waitMs); }
  if (humansIn(q) >= cfg.total) launch(q); else notify(q);
  return null;
}

/** Huỷ tìm trận (cả tổ đội cùng bị huỷ). */
export function cancel(ws) {
  const t = ws.ticket;
  if (!t) return;
  const q = queues.get(t.size);
  if (q) {
    q.tickets = q.tickets.filter(x => x !== t);
    if (!q.tickets.length && q.timer) { clearTimeout(q.timer); q.timer = null; }
  }
  for (const w of t.socks) { w.ticket = null; send(w, { t: 'queue', state: 'idle' }); }
  if (q && q.tickets.length) notify(q);
}

function launch(q) {
  if (q.timer) { clearTimeout(q.timer); q.timer = null; }
  const tickets = q.tickets; q.tickets = [];
  if (!tickets.length) return;
  startMatch(tickets);
}

function startMatch(tickets) {
  const players = [];
  tickets.forEach((t, ti) => {
    for (const w of t.socks) { w.ticket = null; players.push({ ws: w, name: w.name || 'PLAYER', look: w.look || 0, team: ti }); }
  });
  const bots = Math.max(0, cfg.total - players.length);
  const id = nextMatchId++;
  const seed = (Math.random() * 2 ** 31) >>> 0;
  const worker = new Worker(new URL('./match-worker.js', import.meta.url), {
    workerData: { seed, bots, countdown: cfg.countdown, graceS: cfg.graceS, overLingerS: cfg.overLingerS, players: players.map(p => ({ name: p.name, team: p.team })) }
  });
  const roster = players.map((p, i) => ({ id: i, name: p.name, look: p.look, team: p.team }));
  const match = { id, worker, socks: players.map(p => p.ws), hello: [], tokens: [], ended: false };
  matches.add(match);
  players.forEach((p, i) => {
    const token = randomBytes(8).toString('hex');
    match.tokens.push(token);
    tokens.set(token, { match, pid: i });
    match.hello[i] = { t: 'match', id, token, you: i, seed, humans: players.length, bots, total: cfg.total, roster, countdown: cfg.countdown };
    p.ws.mm = { match, pid: i };
    send(p.ws, match.hello[i]);
  });
  worker.on('message', m => {
    if (m.done) return end(match);
    if (m.to === -1) { for (const w of match.socks) send(w, m.s); }
    else send(match.socks[m.to], m.s);
  });
  worker.on('error', err => { console.error('Lỗi trận', id, err); for (const w of match.socks) send(w, { t: 'error', msg: 'Lỗi máy chủ trận đấu' }); end(match); });
  worker.on('exit', () => end(match));
}

function end(match) {
  if (match.ended) return;
  match.ended = true;
  matches.delete(match);
  for (const tk of match.tokens) tokens.delete(tk);
  for (const w of match.socks) if (w && w.mm && w.mm.match === match) { w.mm = null; send(w, { t: 'matchend' }); }
  match.worker.terminate().catch(() => {});
}

/** Tin điều khiển từ client trong trận: 'in' (phím + hướng nhìn) hoặc 'act' (lệnh rời rạc). */
export function forward(ws, msg, allowDebug = false) {
  const mm = ws.mm;
  if (!mm || mm.match.ended) return;
  if (msg.t === 'in' || msg.t === 'act') mm.match.worker.postMessage({ k: msg.t, pid: mm.pid, m: msg });
  else if (msg.t === 'dbg' && allowDebug) mm.match.worker.postMessage({ k: 'dbg', cmd: msg.cmd });
}

/** Rớt kết nối: huỷ hàng đợi, giữ chỗ trong trận để vào lại. */
export function onClose(ws) {
  cancel(ws);
  const mm = ws.mm;
  if (!mm) return;
  const { match, pid } = mm;
  if (match.socks[pid] === ws) { match.socks[pid] = null; if (!match.ended) match.worker.postMessage({ k: 'disc', pid }); }
  ws.mm = null;
}

/** Vào lại trận bằng token đã nhận lúc bắt đầu. */
export function resume(ws, token) {
  const ent = tokens.get(String(token));
  if (!ent || ent.match.ended) { send(ws, { t: 'resume_fail', msg: 'Trận đã kết thúc' }); return; }
  if (ws.mm) return;
  const { match, pid } = ent;
  const old = match.socks[pid];
  if (old && old !== ws) old.mm = null;
  match.socks[pid] = ws;
  ws.mm = { match, pid };
  send(ws, { ...match.hello[pid], resumed: true });
  match.worker.postMessage({ k: 'resume', pid });
}

/** Chủ động rời trận. */
export function leaveMatch(ws) {
  const mm = ws.mm;
  if (!mm) return;
  const { match, pid } = mm;
  if (!match.ended) match.worker.postMessage({ k: 'quit', pid });
  tokens.delete(match.tokens[pid]);
  match.socks[pid] = null;
  ws.mm = null;
  send(ws, { t: 'matchend' });
}

export const stats = () => ({ matches: matches.size, queued: [...queues.values()].reduce((n, q) => n + humansIn(q), 0) });
export const config = cfg;
