/* global THREE */
// Lá»±u Ä‘áº¡n: model, nĂ©m, váº­t lĂ½ báº­t náº£y, ná»• gĂ¢y sĂ¡t thÆ°Æ¡ng vĂ  hiá»‡u á»©ng ná»•.
import { HALF } from '../config/constants.js';
import { S, ents, grenades, fxs, addFeed } from '../core/state.js';
import { clamp } from '../core/utils.js';
import { collidesAt } from '../world/map.js';
import { ray } from '../world/raycast.js';
import { damage } from '../combat/combat.js';
import { snd } from '../core/fx.js';

export function makeGrenade() {
  const g = new THREE.Group(), M = c => new THREE.MeshLambertMaterial({ color: c });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), M(0x4a5d23)); b.scale.y = 1.15; g.add(b);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.045, 8), M(0x8a8d90)); t.position.y = 0.09; g.add(t);
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.1), M(0x9a9da0)); l.position.set(0, 0.108, 0.03); g.add(l);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 10), M(0xd0b040)); r.position.set(0.038, 0.1, 0); g.add(r);
  return g;
}

export function throwGrenade(e, ox, oy, oz, vx, vy, vz) {
  if (!e.alive || e.air || e.gren <= 0 || e.throwCd > 0) return false;
  e.gren--; e.throwCd = 1.2; e.throwT = 0.45;
  let m = null;
  if (typeof THREE !== 'undefined') { m = makeGrenade(); m.position.set(ox, oy, oz); S.G.add(m); }
  grenades.push({ x: ox, y: oy, z: oz, vx, vy, vz, t: 2.8, by: e, mesh: m });
  return true;
}

export function playerThrow(p = S.player, yaw = S.yaw, pitch = S.pitch) {   // PATCH:server-ready
  const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
  if (p.gren <= 0) { addFeed('Hết lựu đạn'); return; }
  throwGrenade(p, p.x + dx * 0.7, p.y + p.eye - 0.1 + dy * 0.7, p.z + dz * 0.7, dx * 15, dy * 15 + 2.5, dz * 15);
}

export function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.t -= dt; g.vy -= 20 * dt;
    const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt;
    if (g.y < 3.2 && collidesAt(nx, g.z, 0.1)) { g.vx *= -0.45; snd.playClink({ pos: g }); } else g.x = nx;
    if (g.y < 3.2 && collidesAt(g.x, nz, 0.1)) { g.vz *= -0.45; snd.playClink({ pos: g }); } else g.z = nz;
    g.x = clamp(g.x, -HALF + 1, HALF - 1); g.z = clamp(g.z, -HALF + 1, HALF - 1);
    g.y += g.vy * dt;
    if (g.y <= 0.08) { g.y = 0.08; if (g.vy < -2) { g.vy *= -0.35; snd.playClink({ pos: g }); } else g.vy = 0; const f = Math.max(0, 1 - 4 * dt); g.vx *= f; g.vz *= f; }
    if (g.mesh) {
      g.mesh.position.set(g.x, g.y, g.z);
      if (Math.hypot(g.vx, g.vz) > 0.5) g.mesh.rotation.x += dt * 12;
    }
    if (g.t <= 0) { explode(g); if (g.mesh) S.G.remove(g.mesh); grenades.splice(i, 1); }
  }
}

function explode(g) {
  const R = 9, oy = Math.max(g.y, 0.4);
  snd.playExplosion({ pos: { x: g.x, y: oy, z: g.z } });
  for (const e of ents) {
    if (!e.alive || e.air) continue;
    const ty = e.y + (e.crouch ? 0.7 : 1.1), dx = e.x - g.x, dy = ty - oy, dz = e.z - g.z, d = Math.hypot(dx, ty - g.y, dz);
    if (d > R) continue;
    const l = Math.hypot(dx, dy, dz) || 1, h = ray(g.x, oy, g.z, dx / l, dy / l, dz / l, l, {});
    if (!h.ent && h.t < l - 0.3) continue;                    // bá»‹ tÆ°á»ng cháº¯n
    if (g.by) g.by.wn = 'Lựu đạn';
    damage(e, 140 * (1 - d / R), g.by);
    if (g.by) g.by.wn = null;
  }
  if (typeof THREE === 'undefined') return;
  const mk = (c, r, dur) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.set(g.x, Math.max(g.y, 0.4), g.z); S.G.add(m); fxs.push({ m, t: 0, dur, r });
  };
  mk(0xffa030, 6, 0.35); mk(0x555555, 8, 0.9);
}

export function updateFx(dt) {
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i]; f.t += dt;
    const k = f.t / f.dur;
    if (k >= 1) { S.G.remove(f.m); fxs.splice(i, 1); continue; }
    f.m.scale.setScalar(f.r * (0.2 + 0.8 * Math.sqrt(k))); f.m.material.opacity = 0.9 * (1 - k);
  }
}
