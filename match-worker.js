// Chạy MỘT trận trong worker thread riêng (mỗi trận có bản sao riêng của state sim, nên nhiều trận chạy song song không đụng nhau).
// Vòng lặp 20 tick/giây: nhận phím/lệnh từ người chơi, chạy bot / đạn / lựu đạn / bo / máy bay, gửi ảnh chụp trạng thái cho từng người.
import { parentPort, workerData } from 'node:worker_threads';
import { S, ents, loots, grenades, feed } from './src/core/state.js';
import { hooks, snd } from './src/core/fx.js';
import { WP, ZONE_WAIT } from './src/config/constants.js';
import { newMatch, stepMatch } from './src/game/sim.js';
import { updatePlayer } from './src/player/player.js';
import { makeInput } from './src/player/input-source.js';
import { applyInput, applyAction } from './src/game/actions.js';
import { createLagComp } from './src/game/lagcomp.js';
import { takeLoot } from './src/items/loot.js';
import { kill } from './src/combat/combat.js';

const DT = 1 / 20, MS = 50;
const MAX_LAG = 8;                 // bù trễ tối đa 8 tick = 400 ms
const GRACE_S = workerData.graceS ?? 60;       // rớt mạng quá lâu thì coi như bỏ trận
const OVER_LINGER_S = workerData.overLingerS ?? 20;
const { seed, bots, players, countdown } = workerData;

const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------- dựng trận
const match = newMatch({ seed, bots, names: players.map(p => p.name), teams: players.map(p => p.team) });
ents.forEach((e, i) => { e.id = i; });
const P = match.players.map((e, i) => {
  e.in = makeInput();
  e.in.yaw = S.yaw; e.in.pitch = S.pitch;
  return { e, pid: i, connected: true, seq: 0, discT: 0, msgs: [], gone: false };
});

let tickN = 0, phase = 'cd', cdLeft = countdown, over = null, overT = 0, deadAllT = 0, noConnT = 0;
let evs = [];
const lag = createLagComp(MAX_LAG);
lag.record(0);

// ---------------------------------------------------------------- móc sự kiện: sim gọi vào đây, server gom lại gửi cho client
const push = o => { if (evs.length < 300) evs.push(o); };
snd.playGunshot = o => push({ k: 'shot', x: r2(o.pos.x), y: r2(o.pos.y), z: r2(o.pos.z), w: o.weapon, by: o.by ? o.by.id : -1 });
snd.playImpact = o => push({ k: 'imp', x: r2(o.pos.x), y: r2(o.pos.y), z: r2(o.pos.z), m: o.material });
snd.playReload = o => push({ k: 'rel', x: r2(o.pos.x), y: r2(o.pos.y), z: r2(o.pos.z), l: r2(o.long || 1) });
snd.playClink = o => push({ k: 'clk', x: r2(o.pos.x), y: r2(o.pos.y), z: r2(o.pos.z) });
snd.playExplosion = o => push({ k: 'exp', x: r2(o.pos.x), y: r2(o.pos.y), z: r2(o.pos.z) });
hooks.tracer = (x1, y1, z1, x2, y2, z2) => push({ k: 'trc', a: [r2(x1), r2(y1), r2(z1), r2(x2), r2(y2), r2(z2)] });
hooks.onDamage = (e, dmg, by) => push({ k: 'hit', to: e.id, by: by ? by.id : -1, d: Math.round(dmg) });
hooks.onKill = (e, by, alive) => push({ k: 'kill', who: e.id, by: by ? by.id : -1, wn: by ? (by.wn || WP(by).n) : null, alive });

// Thông điệp riêng ("Nhặt X", "Túi đồ đầy"...) do sim ghi vào bảng tin chung: chuyển thành tin gửi riêng cho người đang thao tác.
// Dòng hạ gục đã có sự kiện 'kill' nên bỏ qua.
let actor = null;
feed.push = o => {
  if (actor && !/ killed | died outside/.test(o.s)) { const p = P[actor.id]; if (p && p.msgs.length < 8) p.msgs.push(o.s); }
  return 0;
};

// ---------------------------------------------------------------- bù trễ khi bắn + điều khiển người chơi mạng
hooks.updatePlayer = (e, dt) => {
  const I = e.in;
  actor = e;
  let restore = null;
  if (I && I.fire && !e.air && e.cd <= 0 && typeof e.vt === 'number') restore = lag.rewind(e, e.vt, tickN);
  try { updatePlayer(e, dt); } finally { if (restore) restore(); actor = null; }
};

// ---------------------------------------------------------------- loot: server gửi thay đổi (thêm / mất) thay vì cả danh sách
const lootIds = new Map(), crateIds = new WeakMap();
let nextLoot = 1, nextCrate = 1;
const crateId = c => { let id = crateIds.get(c); if (!id) { id = nextCrate++; crateIds.set(c, id); } return id; };
const lootObj = (l, id) => ({ id, x: r2(l.x), z: r2(l.z), ty: l.type, w: l.w, c: l.crate ? crateId(l.crate) : 0 });
function diffLoot() {
  const seen = new Set();
  for (const l of loots) {
    seen.add(l);
    if (!lootIds.has(l)) { const id = nextLoot++; lootIds.set(l, id); push({ k: 'lp', ...lootObj(l, id) }); }
  }
  for (const [l, id] of lootIds) if (!seen.has(l)) { lootIds.delete(l); push({ k: 'lr', id }); }
}
diffLoot(); evs = [];

// ---------------------------------------------------------------- gửi dữ liệu
const post = (to, o) => parentPort.postMessage({ to, s: typeof o === 'string' ? o : JSON.stringify(o) });

function zoneArr() {
  const z = S.zone;
  return [r2(z.cx), r2(z.cz), r2(z.r), z.phase, z.shrinking ? 1 : 0, r2(z.t), r2(z.nx), r2(z.nz), r2(z.nr), z.done ? 1 : 0];
}
const planeArr = () => (S.plane ? [r2(S.plane.t), S.plane.done ? 1 : 0, S.plane.forced ? 1 : 0] : null);

function initMsg(p) {
  const pl = S.plane;
  return {
    t: 'init', n: tickN, you: p.pid, zoneWait: ZONE_WAIT,
    plane: pl ? { sx: r2(pl.sx), sz: r2(pl.sz), dx: r3(pl.dx), dz: r3(pl.dz), speed: pl.speed, len: r2(pl.len), L: r2(pl.L) } : null,
    loots: [...lootIds].map(([l, id]) => lootObj(l, id))
  };
}

function me(e) {
  let sc = 0; e.scopes.forEach((on, i) => { if (on) sc |= 1 << i; });
  return { hp: Math.round(e.hp), armor: Math.round(e.armor), alive: e.alive ? 1 : 0, air: e.air, w: e.w, mag: e.mag, reserve: e.reserve, w2: e.w2, mag2: e.mag2,
    scope: e.scope, scope2: e.scope2, scopes: sc, meds: e.meds, gren: e.gren, vest: e.vest, helmet: e.helmet, bag: e.bag, cur: e.cur,
    reload: r2(e.reload), zero: e.zero, kills: e.kills, place: e.placement || 0 };
}

function sendSnapshots() {
  const E = ents.map(e => [r2(e.x), r2(e.y), r2(e.z), r3(e.yaw), Math.round(e.hp), Math.round(e.armor), e.alive ? 1 : 0, e.crouch ? 1 : 0, e.air, e.w, r2(e.lean), e.in ? r2(e.in.pitch) : 0]);
  const base = { t: 's', n: tickN, ph: phase, cd: r2(Math.max(0, cdLeft)), gt: r2(S.gameTime), z: zoneArr(), pl: planeArr(),
    g: grenades.map(g => [r2(g.x), r2(g.y), r2(g.z)]), e: E, ev: evs };
  if (over) base.res = over;
  for (const p of P) {
    if (!p.connected) continue;
    const m = { ...base, ack: p.seq, me: me(p.e) };
    if (p.msgs.length) { m.msg = p.msgs; p.msgs = []; }
    post(p.pid, m);
  }
}

// ---------------------------------------------------------------- tick
function finish(winner) {
  if (over) return;
  over = { winner: winner ? winner.name : null, team: winner && winner.team != null ? winner.team : null };
  phase = 'over'; overT = 0;
}

function tick() {
  if (phase === 'play') stepMatch(DT);
  else if (phase === 'cd') { cdLeft -= DT; if (cdLeft <= 0) phase = 'play'; }
  else {
    overT += DT;
    if (overT > OVER_LINGER_S) { post(-1, { t: 'bye' }); parentPort.postMessage({ done: true }); process.exit(0); }
  }
  tickN++;
  lag.record(tickN);
  if (phase === 'play') {
    diffLoot();
    if (S.over) finish(S.winner);
    else if (P.every(p => !p.e.alive)) { deadAllT += DT; if (deadAllT > 5) finish(null); } else deadAllT = 0;
  }
  // rớt mạng: sau thời gian chờ thì coi như bỏ trận
  let anyConn = false;
  for (const p of P) {
    if (p.connected) { anyConn = true; continue; }
    p.discT += DT;
    if (!p.gone && p.discT > GRACE_S) { p.gone = true; if (p.e.alive) { actor = null; kill(p.e, null); } }
  }
  if (!anyConn) { noConnT += DT; if (noConnT > GRACE_S) { parentPort.postMessage({ done: true }); process.exit(0); } } else noConnT = 0;
  sendSnapshots();
  evs = [];
}

// ---------------------------------------------------------------- tin từ luồng chính
parentPort.on('message', msg => {
  const p = P[msg.pid];
  switch (msg.k) {
    case 'in': {
      if (!p || !msg.m) break;
      const seq = Number(msg.m.seq);
      if (Number.isFinite(seq) && seq > p.seq) p.seq = seq | 0;
      const vt = Number(msg.m.vt);
      p.e.vt = Number.isFinite(vt) ? vt : undefined;
      applyInput(p.e, msg.m);
      break;
    }
    case 'act': {
      if (!p || !msg.m) break;
      actor = p.e;
      try {
        if (msg.m.k === 'take') {                             // nhặt đồ theo id trong inventory / phím F
          const id = Number(msg.m.id);
          for (const [l, lid] of lootIds) {
            if (lid !== id) continue;
            if (p.e.alive && !p.e.air && Math.hypot(l.x - p.e.x, l.z - p.e.z) < 2.6) takeLoot(l, p.e);
            break;
          }
        } else applyAction(p.e, msg.m);
      } finally { actor = null; }
      break;
    }
    case 'disc':
      if (p) { p.connected = false; p.discT = 0; Object.assign(p.e.in, { fw: false, bk: false, l: false, r: false, run: false, jump: false, fire: false, lq: false, le: false, f: false }); }
      break;
    case 'resume':
      if (p && !p.gone) { p.connected = true; p.discT = 0; post(p.pid, initMsg(p)); }
      break;
    case 'quit':
      if (p) { p.connected = false; p.gone = true; if (p.e.alive) kill(p.e, null); }
      break;
    case 'dbg':                                               // chỉ dùng khi test (ALLOW_DEBUG=1 ở luồng chính)
      if (msg.cmd === 'killall') for (const q of P) if (q.e.alive) kill(q.e, null);
      if (msg.cmd === 'skipcd') cdLeft = 0;
      break;
  }
});

// ---------------------------------------------------------------- khởi động
for (const p of P) post(p.pid, initMsg(p));
let next = performance.now() + MS;
(function loop() {
  const now = performance.now();
  let n = 0;
  while (next <= now && n < 3) { tick(); next += MS; n++; }
  if (next < now - 200) next = now;                           // chậm quá thì bỏ qua, không đuổi theo
  setTimeout(loop, Math.max(1, next - performance.now()));
})();
