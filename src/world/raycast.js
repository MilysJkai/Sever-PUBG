// Raycast hitscan: tia vs há»™p va cháº¡m (tÆ°á»ng, cĂ¢y, thĂ¹ng) vĂ  vs ngÆ°á»i (trá»¥ Ä‘á»©ng).
import { colliders, ents } from '../core/state.js';

export function rayBox(ox, oy, oz, dx, dy, dz, c) {
  let tmin = 0, tmax = 1e9, t1, t2, tmp;
  if (Math.abs(dx) < 1e-9) { if (ox < c.minX || ox > c.maxX) return null; }
  else { t1 = (c.minX - ox) / dx; t2 = (c.maxX - ox) / dx; if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return null; }
  if (Math.abs(dy) < 1e-9) { if (oy < 0 || oy > c.h) return null; }
  else { t1 = (0 - oy) / dy; t2 = (c.h - oy) / dy; if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return null; }
  if (Math.abs(dz) < 1e-9) { if (oz < c.minZ || oz > c.maxZ) return null; }
  else { t1 = (c.minZ - oz) / dz; t2 = (c.maxZ - oz) / dz; if (t1 > t2) { tmp = t1; t1 = t2; t2 = tmp; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return null; }
  return tmin;
}

/** Tráº£ vá» { t: khoáº£ng cĂ¡ch trĂºng, ent: thá»±c thá»ƒ bá»‹ trĂºng (hoáº·c null), head: cĂ³ trĂºng Ä‘áº§u khĂ´ng }. */
export function ray(ox, oy, oz, dx, dy, dz, maxT, ignore) {
  let best = maxT, ent = null, head = false, col = null;
  for (let i = 0; i < colliders.length; i++) {
    const t = rayBox(ox, oy, oz, dx, dy, dz, colliders[i]);
    if (t !== null && t < best) { best = t; col = colliders[i]; }
  }
  for (const e of ents) {
    if (!e.alive || e === ignore || e.air) continue;
    if (ignore && ignore.team != null && e.team === ignore.team) continue;   // PATCH:teams: đạn xuyên qua đồng đội
    const cx = e.x - ox, cy = 0.95 - oy, cz = e.z - oz;
    const tc = cx * dx + cy * dy + cz * dz;
    if (tc < 0 || tc > best) continue;
    const px = ox + dx * tc - e.x, py = oy + dy * tc, pz = oz + dz * tc - e.z;
    if (px * px + pz * pz < 0.36 * 0.36 && py > 0 && py < (e.crouch ? 1.4 : 1.95)) { best = tc; ent = e; col = null; head = py > (e.crouch ? 0.95 : 1.45); }
  }
  return { t: best, ent, head, col };
}
