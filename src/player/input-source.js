// Nguồn đầu vào của một người chơi, dùng chung cho client và server.
//  - Người chơi mạng (chạy trên server): e.in là object do makeInput() tạo, được applyInput() cập nhật từ tin nhắn.
//  - Người chơi cục bộ (chế độ solo hiện tại): không có e.in, đọc thẳng từ bàn phím + chuột (keys / S).
import { S, keys } from '../core/state.js';

/** Tạo bộ đầu vào rỗng cho một người chơi mạng. */
export function makeInput() {
  return { local: false, fw: false, bk: false, l: false, r: false, run: false, jump: false, crouch: false,
    lq: false, le: false, fire: false, ads: 0, tpp: false, f: false, yaw: 0, pitch: 0 };
}

const L = makeInput();
L.local = true;

/** Trả về đầu vào hiện tại của thực thể e (đối tượng dùng lại, đừng giữ tham chiếu qua frame). */
export function inputOf(e) {
  if (e.in) return e.in;
  L.fw = !!(keys.KeyW || keys.ArrowUp);
  L.bk = !!(keys.KeyS || keys.ArrowDown);
  L.r = !!(keys.KeyD || keys.ArrowRight);
  L.l = !!(keys.KeyA || keys.ArrowLeft);
  L.run = !!(keys.ShiftLeft || keys.ShiftRight);
  L.jump = !!keys.Space;
  L.lq = !!keys.KeyQ;
  L.le = !!keys.KeyE;
  L.fire = !!S.mouseDown;
  L.ads = S.adsT;
  L.tpp = !!S.tpp;
  L.f = !!S.fPressed;
  L.yaw = S.yaw;
  L.pitch = S.pitch;
  return L;
}
