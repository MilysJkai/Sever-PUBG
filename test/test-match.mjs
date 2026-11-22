// Chạy: node test/test-match.mjs   — mở server thật + client giả, thử ghép trận, bắn tick, vào lại trận...
import { spawn } from 'node:child_process';

const PORT = 18787;
const srv = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), MATCH_TOTAL: '8', QUEUE_WAIT_MS: '1500', COUNTDOWN_S: '1', GRACE_S: '3', OVER_LINGER_S: '2', ALLOW_DEBUG: '1' },
  stdio: ['ignore', 'inherit', 'inherit']
});
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  OK   ' : '  LỖI  ') + msg); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Client {
  constructor(name) {
    this.name = name; this.msgs = []; this.snaps = 0; this.last = null; this.waiters = [];
    this.ws = new WebSocket('ws://localhost:' + PORT);
    this.ready = new Promise(r => { this.ws.onopen = r; });
    this.ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.t === 's') { this.snaps++; this.last = m; } else this.msgs.push(m);
      for (const w of this.waiters.slice()) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m); }
    };
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(pred, ms = 6000) {
    const old = this.msgs.find(pred); if (old) return Promise.resolve(old);
    if (this.last && pred(this.last)) return Promise.resolve(this.last);
    return new Promise((res, rej) => { const w = { pred, res }; this.waiters.push(w); setTimeout(() => { const i = this.waiters.indexOf(w); if (i >= 0) { this.waiters.splice(i, 1); rej(new Error(this.name + ': hết giờ chờ')); } }, ms); });
  }
  close() { try { this.ws.close(); } catch {} }
}
const mk = async n => { const c = new Client(n); await c.ready; return c; };

async function run() {
  await sleep(700);
  console.log('1) Solo: tìm trận -> điền bot -> đếm ngược -> chơi');
  const s = await mk('solo');
  s.send({ t: 'find', name: 'Solo', look: 2 });
  const q = await s.wait(m => m.t === 'queue' && m.state === 'searching');
  ok(q.size === 1 && q.humans === 1, 'server báo đang xếp hàng (1 người)');
  const match = await s.wait(m => m.t === 'match');
  ok(match.humans === 1 && match.bots === 7 && match.total === 8, 'ghép trận: 1 người + 7 bot = 8');
  ok(match.roster[0].name === 'Solo' && match.you === 0 && typeof match.seed === 'number' && typeof match.token === 'string', 'có seed, token, danh sách người chơi');
  const init = await s.wait(m => m.t === 'init');
  ok(init.loots.length > 100 && init.plane && init.you === 0, 'init: ' + init.loots.length + ' món đồ, máy bay, id của mình');
  const first = await s.wait(m => m.t === 's');
  ok(first.ph === 'cd', 'đang đếm ngược (ph=cd)');
  const play = await s.wait(m => m.t === 's' && m.ph === 'play', 4000);
  ok(play.e.length === 8 && play.me && play.z.length === 10, 'ảnh chụp: 8 thực thể, trạng thái riêng, vòng bo');
  const n0 = s.snaps, t0 = Date.now();
  await sleep(2000);
  const rate = (s.snaps - n0) / ((Date.now() - t0) / 1000);
  ok(rate > 17 && rate < 23, 'tốc độ gửi ' + rate.toFixed(1) + ' ảnh chụp / giây (20Hz)');
  ok(s.last.e[0][8] === 2, 'người chơi đang trên máy bay (air=2)');
  s.send({ t: 'in', seq: 7, yaw: 1, pitch: -0.2, fw: true, f: true, vt: s.last.n });
  const jumped = await s.wait(m => m.t === 's' && m.e[0][8] === 1, 3000);
  ok(jumped.e[0][8] === 1 && jumped.ack >= 7, 'phím F: nhảy dù; ack=' + jumped.ack);
  await sleep(300);
  ok(s.last.e[0][1] < 220, 'đang rơi (y=' + s.last.e[0][1] + ')');
  s.send({ t: 'in', seq: 8, yaw: NaN, pitch: 1e9, fw: 'x', speed: 999 }); s.ws.send('khong phai json'); s.ws.send('{"t":123}'); s.send({ t: 'act', k: 'bậy' });
  await sleep(300);
  ok(s.last && s.last.me.alive === 1, 'dữ liệu rác không làm sập trận');

  console.log('2) Hàng đợi + huỷ');
  const c = await mk('c');
  c.send({ t: 'find', name: 'C' });
  await c.wait(m => m.t === 'queue' && m.state === 'searching');
  c.send({ t: 'cancel' });
  await c.wait(m => m.t === 'queue' && m.state === 'idle');
  await sleep(2000);
  ok(!c.msgs.some(m => m.t === 'match'), 'huỷ tìm trận: không bị ghép');
  c.close();

  console.log('3) Tổ đội đôi: cùng trận, cùng đội');
  const a = await mk('a'), b = await mk('b');
  a.send({ t: 'create', name: 'Alice', max: 2 });
  const party = await a.wait(m => m.t === 'party');
  b.send({ t: 'join', code: party.code, name: 'Bob' });
  await b.wait(m => m.t === 'party' && m.members.length === 2);
  b.send({ t: 'find' });
  const err = await b.wait(m => m.t === 'error');
  ok(/chủ/.test(err.msg), 'chỉ chủ tổ đội được bấm tìm trận');
  a.send({ t: 'find' });
  const ma = await a.wait(m => m.t === 'match'), mb = await b.wait(m => m.t === 'match');
  ok(ma.id === mb.id && ma.you !== mb.you, 'cả hai vào cùng 1 trận (id ' + ma.id + ')');
  ok(ma.roster.length === 2 && ma.roster[0].team === ma.roster[1].team, 'cùng tổ đội: ' + ma.roster.map(r => r.name + '/' + r.team).join(', '));
  ok(ma.bots === 6, 'điền 6 bot');
  // tin nhắn tổ đội vẫn chạy trong trận
  a.send({ t: 'chat', text: 'xin chao' });
  const chat = await b.wait(m => m.t === 'chat');
  ok(chat.text === 'xin chao', 'chat tổ đội hoạt động trong trận');
  await b.wait(m => m.t === 's' && m.ph === 'play', 4000);

  console.log('4) Rớt mạng và vào lại trận');
  const token = mb.token, bid = mb.you;
  b.close();
  await sleep(600);
  const b2 = await mk('b2');
  b2.send({ t: 'resume', token });
  const hello = await b2.wait(m => m.t === 'match');
  ok(hello.resumed && hello.you === bid, 'vào lại đúng chỗ cũ (you=' + hello.you + ')');
  const init2 = await b2.wait(m => m.t === 'init');
  ok(init2.loots.length > 50, 'nhận lại toàn bộ trạng thái (init)');
  const snap2 = await b2.wait(m => m.t === 's', 3000);
  ok(snap2.me.alive === 1, 'tiếp tục nhận ảnh chụp, vẫn sống');
  const bad = await mk('bad'); bad.send({ t: 'resume', token: 'khongdung' });
  ok((await bad.wait(m => m.t === 'resume_fail')).t === 'resume_fail', 'token sai bị từ chối'); bad.close();

  console.log('5) Kết thúc trận');
  a.send({ t: 'dbg', cmd: 'killall' });
  const over = await a.wait(m => m.t === 's' && m.ph === 'over', 12000);
  ok(over.res && 'winner' in over.res, 'ph=over kèm kết quả');
  const end = await a.wait(m => m.t === 'matchend', 9000);
  ok(end.t === 'matchend', 'trận kết thúc, người chơi được thả về sảnh');
  const http = await (await fetch('http://localhost:' + PORT)).text();
  console.log('   ' + http);
  ok(/"matches":\d+/.test(http), 'server vẫn sống sau khi trận kết thúc');
  for (const x of [s, a, b2]) x.close();
}

try { await run(); } catch (e) { fails++; console.log('  LỖI  ' + e.message); }
srv.kill();
console.log(fails ? `\n${fails} kiểm tra LỖI` : '\nTất cả kiểm tra đều đạt');
process.exit(fails ? 1 : 0);
