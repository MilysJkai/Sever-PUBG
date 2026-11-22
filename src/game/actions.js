// Lệnh của người chơi mạng, chạy trên SERVER: làm sạch dữ liệu client gửi lên rồi áp vào thực thể.
// Server không tin client: số liệu bị ép vào khoảng hợp lệ, tốc độ/đạn/hồi chiêu vẫn do sim tự tính.
import { ZEROS, SCOPES } from '../config/constants.js';
import { clamp, rnd } from '../core/utils.js';
import { startReload } from '../combat/combat.js';
import { useMed, dropGear, addLoot } from '../items/loot.js';
import { switchSlot, dropSlot } from '../weapons/slots.js';
import { playerThrow } from '../weapons/grenade.js';

const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);

/** Tin trạng thái phím (client gửi ~30 lần/giây): { fw,bk,l,r,run,jump,crouch,lq,le,fire,ads,f,yaw,pitch } */
export function applyInput(e, m) {
  const I = e.in;
  if (!I || !m) return;
  I.fw = !!m.fw; I.bk = !!m.bk; I.l = !!m.l; I.r = !!m.r;
  I.run = !!m.run; I.jump = !!m.jump; I.crouch = !!m.crouch;
  I.lq = !!m.lq; I.le = !!m.le; I.fire = !!m.fire;
  I.ads = num(m.ads, 0, 1, 0);
  if (m.f) I.f = true;                       // F là sự kiện 1 lần: giữ đến khi tick tiếp theo xử lý
  I.yaw = num(m.yaw, -1e4, 1e4, I.yaw);
  I.pitch = num(m.pitch, -1.5, 1.5, I.pitch);
  I.tpp = false;                             // camera TPP chỉ client biết, server luôn bắn từ mắt theo hướng nhìn
}

/** Lệnh rời rạc: { k: 'reload' | 'slot' | 'med' | 'gren' | 'zero' | 'attach' | 'detach' | 'dropslot' | 'dropscope' | 'dropgear', i, b } */
export function applyAction(e, a) {
  if (!e || !e.alive || !a || typeof a.k !== 'string') return;
  const i = Math.trunc(num(a.i, 0, 99, 0));
  switch (a.k) {
    case 'reload': if (!e.air) startReload(e); break;
    case 'slot': switchSlot(e, i === 1 ? 1 : 0); break;
    case 'med': useMed(e); break;
    case 'gren': if (e.in && !e.air) playerThrow(e, e.in.yaw, e.in.pitch); break;
    case 'zero': e.zero = clamp(i, 0, ZEROS.length - 1); break;
    case 'attach':
      if (i > 0 && i < SCOPES.length && e.scopes[i] && e.w >= 0) { if (e.scope2 === i) e.scope2 = 0; e.scope = e.scope === i ? 0 : i; }
      break;
    case 'detach': if (i === e.cur) e.scope = 0; else e.scope2 = 0; break;
    case 'dropslot': dropSlot(e, i === 1 ? 1 : 0); break;
    case 'dropscope':
      if (i > 0 && i < SCOPES.length && e.scopes[i]) {
        e.scopes[i] = false; if (e.scope === i) e.scope = 0; if (e.scope2 === i) e.scope2 = 0;
        addLoot(e.x + rnd(-0.8, 0.8), e.z + 0.8, 'scope', i);
      }
      break;
    case 'dropgear': if (a.b === 'helmet' || a.b === 'vest' || a.b === 'bag') dropGear(a.b, e); break;
  }
}
