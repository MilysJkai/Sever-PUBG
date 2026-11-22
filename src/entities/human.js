/* global THREE */
// MĂ´ hĂ¬nh ngÆ°á»i cĂ³ khá»›p (hĂ´ng, gá»‘i, thĂ¢n, cá»•, vai, khuá»·u) vĂ  hoáº¡t áº£nh Ä‘i / ngá»“i / nghiĂªng / nháº£y dĂ¹.
import { S } from '../core/state.js';
import { clamp } from '../core/utils.js';
import { makeGun } from '../weapons/gun-models.js';

export function makeChute(color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  m.scale.y = 0.55;
  return m;
}

/** NgÆ°á»i cĂ³ khá»›p: hĂ´ng, gá»‘i, thĂ¢n (nghiĂªng/cĂºi), cá»•, vai, khuá»·u. Máº·t hÆ°á»›ng -z. */
export function makeHuman(o) {
  const g = new THREE.Group(), M = c => new THREE.MeshLambertMaterial({ color: c });
  const bx = (w, h, d, c, x, y, z, p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); (p || g).add(m); return m; };
  const pel = new THREE.Group(); pel.position.y = 0.9; g.add(pel);
  const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const t = new THREE.Group(); t.position.set(sx * 0.1, 0, 0); pel.add(t);          // Ä‘Ă¹i (khá»›p hĂ´ng)
    bx(0.18, 0.4, 0.21, o.jeans, 0, -0.2, 0, t);
    const s = new THREE.Group(); s.position.set(0, -0.4, 0); t.add(s);                  // cáº³ng chĂ¢n (khá»›p gá»‘i)
    bx(0.155, 0.4, 0.18, o.jeans, 0, -0.2, 0, s); bx(0.19, 0.12, 0.3, 0x101010, 0, -0.44, -0.05, s);
    legs.push({ t, s });
  }
  const up = new THREE.Group(); pel.add(up);                                            // thĂ¢n trĂªn (xoay quanh hĂ´ng)
  bx(0.4, 0.52, 0.22, o.jacket, 0, 0.3, 0, up); bx(0.16, 0.46, 0.02, o.shirt, 0, 0.3, -0.115, up); bx(0.42, 0.07, 0.25, 0x85766a, 0, 0.05, 0, up);
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 0.27, 0.53, 0); up.add(p);
    bx(0.1, 0.3, 0.11, o.jacket, 0, -0.15, 0, p);
    const f = new THREE.Group(); f.position.set(0, -0.3, 0); p.add(f);
    bx(0.095, 0.26, 0.095, o.jacket, 0, -0.13, 0, f); bx(0.08, 0.1, 0.07, o.skin, 0, -0.31, 0, f);
    arms.push({ p, f });
  }
  const hd = new THREE.Group(); hd.position.y = 0.6; up.add(hd);                        // cổ/đầu
  bx(0.09, 0.1, 0.09, o.skin, 0, 0, 0, hd);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), M(o.skin)); head.position.y = 0.14; head.scale.set(0.92, 1.12, 1); hd.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M(o.hair)); hair.position.set(0, 0.165, 0.01); hair.scale.set(0.98, 1.1, 1.05); hd.add(hair);
  bx(0.24, 0.12, 0.1, o.hair, 0, 0.1, 0.08, hd);
  for (const sx of [-1, 1]) bx(0.075, 0.045, 0.02, 0x111111, sx * 0.05, 0.155, -0.108, hd);
  const gun = new THREE.Group(); gun.position.set(0.1, 0.35, -0.3); gun.visible = false; up.add(gun);
  const chute = makeChute(o.chuteColor); chute.position.y = 3.6; chute.visible = false; g.add(chute);
  return { group: g, legs, arms, gun, chute, pel, up, hd };
}

export function animEnt(e, dt) {
  const m = e.mesh, H = e.parts, [aL, aR] = H.arms, [lL, lR] = H.legs;
  const sp = Math.hypot(e.x - e.px, e.z - e.pz) / Math.max(dt, 0.001);
  e.px = e.x; e.pz = e.z; e.ph += Math.min(sp, 12) * dt * 1.5;
  e.cr += ((e.crouch && !e.air ? 1 : 0) - e.cr) * Math.min(1, dt * 10);
  const cr = e.cr, amp = e.air ? 0 : clamp(sp / 5, 0, 1), wk = amp * (1 - cr * 0.6);
  const s = Math.sin(e.ph), c = Math.cos(e.ph);
  const leg = (L, th, kn, z) => { L.t.rotation.set(th, 0, z || 0); L.s.rotation.set(kn, 0, 0); };
  let hipY = 0.9, bend = 0;
  if (e.air === 1) {
    aL.p.rotation.set(0, 0, -1.3); aR.p.rotation.set(0, 0, 1.3); aL.f.rotation.set(0, 0, 0); aR.f.rotation.set(0, 0, 0);
    leg(lL, 0.1, -0.2, -0.25); leg(lR, 0.1, -0.2, 0.25);
  } else if (e.air === 3) {
    aL.p.rotation.set(2.8, 0, 0.15); aR.p.rotation.set(2.8, 0, -0.15); aL.f.rotation.set(0, 0, 0); aR.f.rotation.set(0, 0, 0);
    leg(lL, 0.15, -0.1); leg(lR, -0.1, -0.1);
  } else {
    leg(lL, s * 0.8 * wk + cr * 1.45, -wk * (0.1 + 0.9 * Math.max(0, c)) - cr * 1.6);
    leg(lR, -s * 0.8 * wk + cr * 1.4, -wk * (0.1 + 0.9 * Math.max(0, -c)) - cr * 1.55);
    hipY = 0.9 - cr * 0.35 - Math.abs(s) * 0.035 * wk;
    bend = -cr * 0.3;
    if (e.w >= 0) {                                   // cáº§m sĂºng: hai tay giÆ¡ trÆ°á»›c
      aR.p.rotation.set(1.35, 0, -0.3); aL.p.rotation.set(1.25, 0, 0.3); aR.f.rotation.set(0.25, 0, 0); aL.f.rotation.set(0.25, 0, 0);
    } else {
      aL.p.rotation.set(-s * 0.9 * wk, 0, -0.08); aR.p.rotation.set(s * 0.9 * wk, 0, 0.08);
      aL.f.rotation.set(0.15 + Math.max(0, -s) * 0.4 * wk, 0, 0); aR.f.rotation.set(0.15 + Math.max(0, s) * 0.4 * wk, 0, 0);
    }
    if (e.throwT > 0) { const tt = e.throwT / 0.45; aR.p.rotation.set(2.9 * tt + 0.2 * (1 - tt), 0, -0.1); aR.f.rotation.set(0.3, 0, 0); }
  }
  const pl = e.isPlayer && !e.air ? S.pitch : 0;        // ngÆ°á»i chÆ¡i: thĂ¢n + Ä‘áº§u cĂºi/ngá»­a theo hÆ°á»›ng ngáº¯m
  const ub = bend + pl * 0.35;
  H.pel.position.y = hipY;
  H.up.rotation.set(ub, 0, -e.lean * 0.45);           // nghiĂªng tháº­t quanh hĂ´ng
  H.hd.rotation.set(pl * 0.6 - ub * 0.6, 0, e.lean * 0.2);
  H.gun.visible = e.w >= 0 && !e.air;
  if (e.gw !== e.w && e.w >= 0) { e.gw = e.w; while (H.gun.children.length) H.gun.remove(H.gun.children[0]); H.gun.add(makeGun(e.w)); }
  H.chute.visible = e.air === 3;
  if (!e.isPlayer) m.visible = e.air !== 2;
  m.position.set(e.x, e.y, e.z); m.rotation.set(0, e.yaw, 0);
}
