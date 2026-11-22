// AI bot: nháº£y dĂ¹, tĂ¬m Ä‘á»“, phĂ¡t hiá»‡n Ä‘á»‹ch (line-of-sight), báº¯n, nĂ©, cháº¡y bo.
import { HALF } from '../config/constants.js';
import { S, ents, loots } from '../core/state.js';
import { rnd, clamp, normA } from '../core/utils.js';
import { ray } from '../world/raycast.js';
import { moveEnt } from '../entities/entity.js';
import { shoot, startReload } from '../combat/combat.js';
import { botAir } from '../game/plane.js';
import { wanted } from '../items/loot.js';

function pickWaypoint(e) {
  const zone = S.zone;
  let best = null, bd = e.w < 0 ? 250 : 60;
  for (const l of loots) {
    const d = Math.hypot(l.x - e.x, l.z - e.z);
    if (d < bd && wanted(e, l)) { bd = d; best = l; }
  }
  if (best && (e.w < 0 || Math.random() < 0.7)) e.wp = [best.x, best.z];
  else {
    const a = rnd(0, 6.28), d = rnd(0, zone.r * 0.8);
    e.wp = [clamp(zone.cx + Math.cos(a) * d, -HALF + 5, HALF - 5), clamp(zone.cz + Math.sin(a) * d, -HALF + 5, HALF - 5)];
  }
}

export function botAI(e, dt) {
  if (e.air) { botAir(e, dt); return; }
  const zone = S.zone;
  const armed = e.w >= 0;
  e.losT -= dt;
  if (e.losT <= 0) {
    e.losT = 0.25;
    let t = null, bd = e.w === 4 ? 120 : e.w === 2 ? 25 : 70;
    for (const o of ents) {
      if (!o.alive || o === e || o.air || !armed) continue;
      const d = Math.hypot(o.x - e.x, o.z - e.z);
      if (d < bd) { bd = d; t = o; }
    }
    e.target = t;
    e.los = false;
    if (t) {
      const dx = t.x - e.x, dy = 0.95 - 1.5, dz = t.z - e.z, l = Math.hypot(dx, dy, dz);
      e.los = ray(e.x, 1.5, e.z, dx / l, dy / l, dz / l, l + 1, e).ent === t;
    }
  }
  const t = e.target && e.target.alive ? e.target : null;
  let mx = 0, mz = 0, sp = 4;
  const dzone = Math.hypot(zone.cx - e.x, zone.cz - e.z);

  if (t && e.los) {
    const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz);
    const diff = normA(Math.atan2(-dx, -dz) - e.yaw);
    e.yaw += clamp(diff, -4 * dt, 4 * dt);
    e.aim += dt;
    if (Math.abs(diff) < 0.15 && e.aim > 0.5) {
      const l = Math.hypot(dx, -0.55, dz);
      shoot(e, e.x, 1.5, e.z, dx / l, -0.55 / l, dz / l, 0.02 + d * 0.0007);
    }
  } else e.aim = 0;
  if (e.mag === 0) startReload(e);

  if (e.slideT > 0) {
    e.slideT -= dt;
    mx = Math.cos(e.slideAng); mz = Math.sin(e.slideAng);
  } else if (dzone > zone.r - 15) {
    mx = (zone.cx - e.x) / dzone; mz = (zone.cz - e.z) / dzone; sp = 6;
  } else if (t && e.los) {
    const dx = t.x - e.x, dz = t.z - e.z, d = Math.max(0.1, Math.hypot(dx, dz));
    const f = d > 18 ? 1 : d < 8 ? -1 : 0;
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafeT = rnd(1, 2.5); e.strafeDir = Math.random() < 0.5 ? -1 : 1; }
    mx = (dx / d) * f + (-dz / d) * e.strafeDir * 0.7;
    mz = (dz / d) * f + (dx / d) * e.strafeDir * 0.7;
    sp = 3.5;
  } else {
    if (!e.wp || Math.hypot(e.wp[0] - e.x, e.wp[1] - e.z) < 2) pickWaypoint(e);
    const dx = e.wp[0] - e.x, dz = e.wp[1] - e.z, d = Math.max(0.1, Math.hypot(dx, dz));
    mx = dx / d; mz = dz / d;
  }
  if (e.lootRef && !(t && e.los)) { mx = 0; mz = 0; }       // Ä‘ang nháº·t Ä‘á»“ thĂ¬ Ä‘á»©ng yĂªn
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  if (!(t && e.los) && len > 0) e.yaw = Math.atan2(-mx, -mz);
  const moved = moveEnt(e, mx * sp * dt, mz * sp * dt);
  if (len > 0 && !moved) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt);
  if (e.stuck > 0.35) { e.stuck = 0; e.slideT = 0.7; e.slideAng = rnd(0, 6.28); e.wp = null; }
}
