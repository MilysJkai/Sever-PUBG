// Äiá»u khiá»ƒn ngÆ°á»i chÆ¡i: di chuyá»ƒn, nháº£y, ngá»“i, nghiĂªng, báº¯n; camera gĂ³c nhĂ¬n thá»© 3.
import { EYE, WP } from '../config/constants.js';
import { S, keys } from '../core/state.js';
import { collidesAt } from '../world/map.js';
import { ray } from '../world/raycast.js';
import { moveEnt } from '../entities/entity.js';
import { shoot } from '../combat/combat.js';
import { updatePlayerAir } from '../game/plane.js';
import { pickNearest } from '../items/loot.js';
import { inputOf } from './input-source.js';   // PATCH:server-ready
let rcN = 0, rcLast = -9, rcDir = 1;   // Ä‘áº¿m phĂ¡t báº¯n liĂªn tiáº¿p, hÆ°á»›ng lá»‡ch ngang
const RC = [0.012, 0.006, 0.02, 0.011, 0.03];   // P92, UMP45, S12K, M416, AWM

/** Camera gĂ³c nhĂ¬n thá»© 3 (qua vai pháº£i), tá»± kĂ©o láº¡i gáº§n náº¿u vÆ°á»›ng tÆ°á»ng. */
export function tppCam() {
  const { yaw, pitch, player } = S;
  const cp = Math.cos(pitch), fx = -Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = -Math.cos(yaw) * cp;
  const hx = player.x + Math.cos(yaw) * 0.55, hy = player.y + player.eye + 0.15, hz = player.z - Math.sin(yaw) * 0.55;
  let d = 3.4;
  while (d > 0.6 && collidesAt(hx - fx * d, hz - fz * d, 0.35)) d -= 0.4;
  return { x: hx - fx * d, y: Math.max(0.5, hy - fy * d), z: hz - fz * d };
}

export function updatePlayer(e, dt) {
  const I = inputOf(e);                               // e.in (người chơi mạng, trên server) hoặc bàn phím + chuột cục bộ
  const f = I.f;
  if (!I.local) I.f = false;                          // F chỉ có hiệu lực trong 1 tick
  if (e.air) { updatePlayerAir(e, dt, I, f); return; }
  if (f) { if (I.local) S.fPressed = false; pickNearest(e); }
  if (!I.local) e.crouch = !!I.crouch;                // cục bộ thì phím C đổi trực tiếp e.crouch (input.js)
  const yaw = I.yaw, pitch = I.pitch;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let dx = 0, dz = 0;
  if (I.fw) { dx += fx; dz += fz; }
  if (I.bk) { dx -= fx; dz -= fz; }
  if (I.r) { dx += rx; dz += rz; }
  if (I.l) { dx -= rx; dz -= rz; }
  const len = Math.hypot(dx, dz);
  if (len > 0) {
    const sp = (e.crouch ? 2.6 : I.run ? 9 : 5.5) * dt;
    moveEnt(e, (dx / len) * sp, (dz / len) * sp);
  }
  if (I.jump && e.y <= 0.001 && !e.crouch) e.vy = 7;
  e.vy -= 20 * dt;
  e.y = Math.max(0, e.y + e.vy * dt);
  if (e.y === 0 && e.vy < 0) e.vy = 0;
  e.yaw = yaw;
  e.eye += ((e.crouch ? 1.05 : EYE) - e.eye) * Math.min(1, dt * 12);
  let lt = (I.le ? 1 : 0) - (I.lq ? 1 : 0);           // nghiêng: E phải, Q trái (bị chặn nếu vướng tường)
  if (lt) { let k = 1; while (k > 0 && collidesAt(e.x + Math.cos(yaw) * 0.45 * lt * k, e.z - Math.sin(yaw) * 0.45 * lt * k, 0.12)) k -= 0.25; lt *= Math.max(0, k); }
  e.lean += (lt - e.lean) * Math.min(1, dt * 10);
  if (I.fire) {
    const cp = Math.cos(pitch), ox = e.x + Math.cos(yaw) * 0.45 * e.lean, oy = e.y + e.eye, oz = e.z - Math.sin(yaw) * 0.45 * e.lean;
    let sx = -Math.sin(yaw) * cp, sy = Math.sin(pitch), sz = -Math.cos(yaw) * cp;
    if (I.local && I.tpp && I.ads < 0.3) {            // TPP (chỉ cục bộ): tìm điểm tâm ngắm của camera rồi bắn từ mắt nhân vật tới đó
      const c = tppCam(), h = ray(c.x, c.y, c.z, sx, sy, sz, 400, e);
      const px = c.x + sx * h.t - ox, py = c.y + sy * h.t - oy, pz = c.z + sz * h.t - oz, l = Math.hypot(px, py, pz);
      if (l > 1.5) { sx = px / l; sy = py / l; sz = pz / l; }
    }
    const W = WP(e), ads = I.ads > 0.9;               // đã ngắm xong mới chính xác
    const ok = shoot(e, ox, oy, oz, sx, sy, sz, ads ? (W.pellets > 1 ? 0 : -W.spread) : 0.035);
    if (ok && I.local) {                              // giật súng chỉ áp cho người chơi cục bộ (client online tự giật rồi gửi hướng nhìn mới)
      S.flashT = 0.05;
      if (S.gameTime - rcLast > W.rate + 0.25) { rcN = 0; rcDir = Math.random() < 0.5 ? -1 : 1; }
      rcLast = S.gameTime; rcN++;
      const k = RC[e.w] * (1 + Math.min(rcN, 10) * 0.08) * (ads ? 0.8 : 1);
      S.pitch = Math.min(1.5, S.pitch + k);
      S.yaw += k * (rcDir * 0.25 + (Math.random() - 0.5) * 0.6);
    }
  }
}
