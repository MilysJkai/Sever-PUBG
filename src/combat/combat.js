// Báº¯n hitscan, sĂ¡t thÆ°Æ¡ng, giáº¿t, náº¡p Ä‘áº¡n vĂ  Ä‘Æ°á»ng Ä‘áº¡n.
import { WP } from '../config/constants.js';
import { S, addFeed } from '../core/state.js';
import { rnd } from '../core/utils.js';
import { ray } from '../world/raycast.js';
import { countAlive } from '../entities/entity.js';
import { spawnCrate } from '../items/loot.js';
import { snd, hooks } from '../core/fx.js';

export function startReload(e) {
  if (e.reload <= 0 && e.mag < WP(e).mag && e.reserve > 0) {
    e.reload = WP(e).reload;
    snd.playReload({ pos: { x: e.x, y: e.y + 1.1, z: e.z }, own: e.isPlayer, long: Math.max(0.6, e.reload - 0.35) });
  }
}

export function updateTracers(dt) { hooks.updateTracers(dt); }

/** Báº¯n hitscan. (ox,oy,oz) = máº¯t, (dx,dy,dz) = hÆ°á»›ng chuáº©n hoĂ¡, extra = Ä‘á»™ lá»‡ch thĂªm. */
export function shoot(e, ox, oy, oz, dx, dy, dz, extra) {
  const W = WP(e);
  if (!e.alive || e.air || e.w < 0 || e.reload > 0 || e.cd > 0) return false;
  if (e.mag <= 0) {
    startReload(e);
    if (e.isPlayer && e.reload <= 0 && e.cd <= 0) { snd.playClick({ own: true }); e.cd = 0.35; }   // háº¿t Ä‘áº¡n: lĂ¡ch cĂ¡ch
    return false;
  }
  e.mag--;
  e.cd = W.rate;
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
  const mx = ox + fx * 0.8 + rx * 0.25, my = oy - 0.2, mz = oz + fz * 0.8 + rz * 0.25;
  snd.playGunshot({ pos: { x: mx, y: my, z: mz }, weapon: W.n, own: e.isPlayer, by: e });
  const pl = S.player, hear = pl && pl.alive && !e.isPlayer;       // ngÆ°á»i chÆ¡i nghe Ä‘áº¡n vá»¥t qua
  let marked = false, impacts = 0;
  for (let i = 0; i < W.pellets; i++) {
    const s = W.spread + (extra || 0);
    let sx = dx + rnd(-1, 1) * s, sy = dy + rnd(-1, 1) * s, sz = dz + rnd(-1, 1) * s;
    const l = Math.hypot(sx, sy, sz);
    sx /= l; sy /= l; sz /= l;
    const h = ray(ox, oy, oz, sx, sy, sz, W.range, e);
    if (h.ent) {
      damage(h.ent, W.dmg * (h.head ? 2 - 0.25 * (h.ent.helmet || 0) : 1), e);
      if (e.isPlayer && !marked) { marked = true; snd.playHitMarker(h.head); }
    }
    if (h.t < W.range - 0.01 && impacts < 2) {                       // Ä‘áº¡n trĂºng váº­t / ngÆ°á»i
      impacts++;
      snd.playImpact({ pos: { x: ox + sx * h.t, y: oy + sy * h.t, z: oz + sz * h.t }, material: h.ent ? 'flesh' : (h.col && h.col.kind) || 'concrete' });
    }
    if (hear && h.ent !== pl) {                                      // Ä‘iá»ƒm Ä‘Æ°á»ng Ä‘áº¡n gáº§n Ä‘áº§u ngÆ°á»i chÆ¡i nháº¥t
      const px = pl.x - ox, py = pl.y + pl.eye - oy, pz = pl.z - oz;
      const tc = Math.max(0, Math.min(h.t, px * sx + py * sy + pz * sz));
      const cx = ox + sx * tc, cy = oy + sy * tc, cz = oz + sz * tc;
      if (Math.hypot(cx - pl.x, cy - (pl.y + pl.eye), cz - pl.z) < 4) snd.playBulletPass({ x: cx, y: cy, z: cz });
    }
    hooks.tracer(mx, my, mz, ox + sx * h.t, oy + sy * h.t, oz + sz * h.t);
  }
  return true;
}

export function damage(e, dmg, by) {   // PATCH:server-ready
  if (!e.alive) return;
  if (by && by !== e && e.team != null && by.team === e.team) return;   // PATCH:teams: không sát thương đồng đội
  if (e.armor > 0) {
    const a = Math.min(e.armor, dmg * 0.5);
    e.armor -= a;
    dmg -= a;
  }
  e.hp -= dmg;
  if (e === S.player) { S.hurtT = 0.4; snd.playHurt(dmg); }
  if (hooks.onDamage) hooks.onDamage(e, dmg, by);
  if (e.hp <= 0) kill(e, by);
}

export function kill(e, by) {
  e.alive = false;
  e.hp = 0;
  if (by && by !== e) by.kills++;
  if (by && by !== e && by === S.player) snd.playKill();
  addFeed(by ? by.name + ' [' + (by.wn || WP(by).n) + '] killed ' + e.name : e.name + ' died outside the zone');
  if (e.mesh) e.mesh.visible = false;
  spawnCrate(e);
  const alive = countAlive();
  e.placement = alive + 1;                            // hạng của người vừa chết (server gửi cho client)
  if (e === S.player) { S.state = 1; S.placement = alive + 1; }
  else if (S.state === 0 && S.player && S.player.alive && alive === 1) S.state = 2;
  if (hooks.onKill) hooks.onKill(e, by, alive);
}
