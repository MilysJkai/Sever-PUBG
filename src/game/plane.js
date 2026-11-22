/* global THREE */
// MĂ¡y bay tháº£ dĂ¹, rÆ¡i tá»± do, lÆ°á»£n dĂ¹ vĂ  tiáº¿p Ä‘áº¥t.
import { HALF, EYE, RADIUS, PLANE_H } from '../config/constants.js';
import { S, buildings, ents, keys } from '../core/state.js';
import { rnd, clamp } from '../core/utils.js';
import { collidesAt, freePos } from '../world/map.js';
import { makeChute } from '../entities/human.js';
import { snd } from '../core/fx.js';
import { inputOf } from '../player/input-source.js';   // PATCH:server-ready

export function startPlane() {
  const a = rnd(0, Math.PI * 2), L = HALF + 30, off = rnd(-80, 80), dx = Math.cos(a), dz = Math.sin(a);
  const plane = { sx: -dx * L - dz * off, sz: -dz * L + dx * off, dx, dz, t: 0, speed: 35, len: 2 * L, L, x: 0, z: 0, done: false, forced: false };
  S.plane = plane;
  plane.x = plane.sx; plane.z = plane.sz;
  if (typeof THREE !== 'undefined') buildPlaneMesh(plane);
  S.yaw = Math.atan2(-dx, -dz); S.pitch = -0.1;
  const spots = buildings.length ? buildings : [[0, 0]];
  for (const e of ents) {
    e.air = 2; e.y = PLANE_H; e.vy = 0;
    if (!e.isPlayer) {
      if (Math.random() < 0.75) { const b = spots[Math.floor(Math.random() * spots.length)]; e.tgt = [b[0], b[1]]; }
      else e.tgt = freePos();
      e.jr = rnd(60, 190);
    }
  }
}

function buildPlaneMesh(plane) {
  const dx = plane.dx, dz = plane.dz;
  const m = new THREE.Group(), mat = c => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 16), mat(0x8a9099));
  const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 0.4, 3.2), mat(0x6e747c)); wing.position.set(0, 0.2, 1);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 2), mat(0x6e747c)); tail.position.set(0, 0.8, 7);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 2), mat(0x6e747c)); fin.position.set(0, 2.2, 7);
  m.add(body, wing, tail, fin);
  m.rotation.y = Math.atan2(-dx, -dz);
  m.position.set(plane.x, PLANE_H, plane.z);
  S.G.add(m); plane.mesh = m;
  S.playerChute = makeChute(0xffffff); S.playerChute.visible = false; S.G.add(S.playerChute);
}

/** Cáº­p nháº­t vá»‹ trĂ­ mĂ¡y bay má»—i frame; Ă©p ngÆ°á»i chÆ°a nháº£y xuá»‘ng khi mĂ¡y bay rá»i Ä‘áº£o. */
export function updatePlane(dt) {
  const plane = S.plane;
  if (!plane || plane.done) return;
  plane.t += dt;
  const trav = plane.t * plane.speed;
  plane.x = plane.sx + plane.dx * trav; plane.z = plane.sz + plane.dz * trav;
  if (plane.mesh) plane.mesh.position.set(plane.x, PLANE_H, plane.z);
  if (!plane.forced && trav >= plane.L + HALF - 15) {            // mĂ¡y bay rá»i Ä‘áº£o: ai chÆ°a nháº£y bá»‹ Ä‘áº©y xuá»‘ng
    plane.forced = true; S.zone.t = -10;
    for (const e of ents) if (e.air === 2) jump(e);
  }
  if (trav >= plane.len) { plane.done = true; if (plane.mesh) plane.mesh.visible = false; }
}

export function jump(e) {
  if (e.air !== 2) return;
  e.air = 1; e.x = S.plane.x; e.z = S.plane.z; e.y = PLANE_H - 2; e.vy = 0;
}

function land(e) {
  e.air = 0; e.y = 0; e.vy = 0; e.wp = null; e.noLoot = rnd(1.5, 3.5); e.lootRef = null;
  if (collidesAt(e.x, e.z, RADIUS)) {        // lá»¡ rÆ¡i vĂ o tÆ°á»ng/cĂ¢y -> Ä‘áº©y ra chá»— trá»‘ng gáº§n nháº¥t
    outer: for (let r = 1; r < 25; r++) for (let a = 0; a < 6.28; a += 0.4) {
      const x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r;
      if (Math.abs(x) < HALF - 1 && Math.abs(z) < HALF - 1 && !collidesAt(x, z, RADIUS)) { e.x = x; e.z = z; break outer; }
    }
  }
}

/** Di chuyá»ƒn trĂªn khĂ´ng: rÆ¡i tá»± do (air=1) hoáº·c lÆ°á»£n dĂ¹ (air=3). dx,dz Ä‘Ă£ chuáº©n hoĂ¡. */
function airMove(e, dt, dx, dz, pit) {
  if (e.air === 1 && e.y <= 110) { e.air = 3; if (e.isPlayer) snd.playChute(); }      // tá»± má»Ÿ dĂ¹ á»Ÿ Ä‘á»™ cao 110m
  const fall = e.air === 1, dive = fall && pit < -0.5;
  const desc = fall ? (dive ? 72 : 50) : 7, sp = fall ? (dive ? 30 : 24) : 12;
  e.x = clamp(e.x + dx * sp * dt, -HALF + 2, HALF - 2);
  e.z = clamp(e.z + dz * sp * dt, -HALF + 2, HALF - 2);
  e.y -= desc * dt;
  if (e.y <= 0) land(e);
}

export function botAir(e, dt) {
  const plane = S.plane;
  if (e.air === 2) {
    e.x = plane.x; e.z = plane.z; e.y = PLANE_H;
    if (Math.abs(plane.x) < HALF && Math.abs(plane.z) < HALF && Math.hypot(plane.x - e.tgt[0], plane.z - e.tgt[1]) < e.jr) jump(e);
    return;
  }
  const dx = e.tgt[0] - e.x, dz = e.tgt[1] - e.z, d = Math.hypot(dx, dz) || 1, near = d < 5;
  airMove(e, dt, near ? 0 : dx / d, near ? 0 : dz / d, d > 70 ? -0.7 : 0);
  e.yaw = Math.atan2(-dx, -dz);
}

export function updatePlayerAir(e, dt, I = inputOf(e), f = I.f) {
  const plane = S.plane, yaw = I.yaw;
  e.yaw = yaw; e.crouch = false; e.lean = 0; e.eye = EYE;
  if (e.air === 2) { e.x = plane.x; e.z = plane.z; e.y = PLANE_H; if (f) jump(e); return; }
  if (e.air === 1 && f && e.y < 200) { e.air = 3; snd.playChute(); }
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  let dx = 0, dz = 0;
  if (I.fw) { dx += fx; dz += fz; }
  if (I.bk) { dx -= fx; dz -= fz; }
  if (I.r) { dx += rx; dz += rz; }
  if (I.l) { dx -= rx; dz -= rz; }
  const len = Math.hypot(dx, dz);
  airMove(e, dt, len ? dx / len : 0, len ? dz / len : 0, I.pitch);
}
