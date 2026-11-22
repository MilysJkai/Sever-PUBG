// Chạy trong thư mục server (cạnh match-worker.js):  node tools\fix-lag-server.mjs
// Giảm tải CPU khi gửi snapshot + ghi log tick chậm (xem trong Render > Logs).
import fs from 'node:fs';
const f = 'match-worker.js';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('LAGFIX-v1')) { console.log('Đã vá rồi.'); process.exit(0); }
function rep(a, b) { if (!s.includes(a)) { console.error('KHÔNG TÌM THẤY:\n' + a); process.exit(1); } s = s.replace(a, () => b); }

rep(`  for (const p of P) {
    if (!p.connected) continue;
    const m = { ...base, ack: p.seq, me: me(p.e) };
    if (p.msgs.length) { m.msg = p.msgs; p.msgs = []; }
    post(p.pid, m);
  }`,
`  // LAGFIX-v1: stringify phần chung 1 lần, mỗi người chỉ ghép thêm ack/me/msg
  const head = JSON.stringify(base).slice(0, -1);
  for (const p of P) {
    if (!p.connected) continue;
    let tail = ',"ack":' + p.seq + ',"me":' + JSON.stringify(me(p.e));
    if (p.msgs.length) { tail += ',"msg":' + JSON.stringify(p.msgs); p.msgs = []; }
    post(p.pid, head + tail + '}');
  }`);

rep(`function tick() {
  if (phase === 'play') stepMatch(DT);`,
`let slowN = 0, slowLog = 0;
function tick() { const _t0 = performance.now(); tick0(); const d = performance.now() - _t0; if (d > 40) { slowN++; if (performance.now() - slowLog > 5000) { slowLog = performance.now(); console.log('[tick chậm] ' + d.toFixed(1) + ' ms (ngân sách 50 ms), đã gặp ' + slowN + ' lần'); } } }
function tick0() {
  if (phase === 'play') stepMatch(DT);`);
fs.writeFileSync(f, s, 'utf8');
console.log('Đã vá match-worker.js');
