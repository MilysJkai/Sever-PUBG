// MĂ´ phá»ng má»™t vĂ¡n (THUáº¦N LOGIC, khĂ´ng THREE/Ă¢m thanh/DOM) â€” cháº¡y Ä‘Æ°á»£c cáº£ á»Ÿ trĂ¬nh duyá»‡t láº«n server Node.
// Client vĂ  server cĂ¹ng dĂ¹ng: newMatch() táº¡o vĂ¡n, stepMatch(dt) cháº¡y 1 tick.
import { S, buildings, colliders, ents, loots, feed, grenades, fxs } from '../core/state.js';
import { WP } from '../config/constants.js';
import { hooks } from '../core/fx.js';
import { buildMap } from '../world/map.js';
import { mkEnt, countAlive, firstAlive } from '../entities/entity.js';
import { botAI } from '../ai/bot.js';
import { kill } from '../combat/combat.js';
import { spawnLoot, updateLoot } from '../items/loot.js';
import { throwGrenade, updateGrenades, updateFx } from '../weapons/grenade.js';
import { newZone } from './zone.js';
import { startPlane, updatePlane } from './plane.js';
import { rnd } from '../core/utils.js';

/**
 * Táº¡o vĂ¡n má»›i. seed: sá»‘ nguyĂªn (bá» trá»‘ng = ngáº«u nhiĂªn). names: tĂªn cĂ¡c ngÆ°á»i chÆ¡i tháº­t; bots: sá»‘ bot.
 * Tráº£ vá» { seed, players } â€” players lĂ  cĂ¡c thá»±c thá»ƒ cá»§a ngÆ°á»i chÆ¡i, theo thá»© tá»± names.
 */
export function newMatch({ seed, bots = 20, names = [], teams = null } = {}) {   // PATCH:teams
  buildings.length = 0; colliders.length = 0; ents.length = 0; loots.length = 0; feed.length = 0; grenades.length = 0; fxs.length = 0;
  const used = buildMap(seed);
  S.zone = newZone();
  const players = names.map((n, i) => { const e = mkEnt(n, true); e.team = teams && teams[i] != null ? teams[i] : null; return e; });
  for (let i = 0; i < bots; i++) { const b = mkEnt('Bot ' + (i + 1), false); b.team = 1000 + i; }
  spawnLoot();
  S.state = 0; S.gameTime = 0; S.over = false; S.winner = null;
  startPlane();
  return { seed: used, players };
}

/** Cháº¡y 1 tick (dt giĂ¢y): mĂ¡y bay, vĂ²ng bo, bot, Ä‘áº¡n Ä‘ang bay, lá»±u Ä‘áº¡n, loot, sĂ¡t thÆ°Æ¡ng bo. */
export function aliveTeamCount() {
  const t = new Set();
  for (const e of ents) if (e.alive) t.add(e.team != null ? e.team : e);
  return t.size;
}

export function stepMatch(dt) {
  const zone = S.zone;
  S.gameTime += dt;
  updatePlane(dt);
  if (!S.plane || S.plane.forced) zone.update(dt);

  for (const e of ents) {
    if (!e.alive) continue;
    e.cd = Math.max(0, e.cd - dt);
    if (e.reload > 0) {
      e.reload -= dt;
      if (e.reload <= 0) {
        e.reload = 0;
        const take = Math.min(WP(e).mag - e.mag, e.reserve);
        e.mag += take; e.reserve -= take;
      }
    }
    if (e.isPlayer) { if (hooks.updatePlayer) hooks.updatePlayer(e, dt); } else botAI(e, dt);
    e.throwCd = Math.max(0, e.throwCd - dt); e.throwT = Math.max(0, e.throwT - dt);
    if (!e.isPlayer && e.alive && !e.air && e.gren > 0 && e.throwCd <= 0 && e.los && e.target && e.target.alive) {
      const dx = e.target.x - e.x, dz = e.target.z - e.z, d = Math.hypot(dx, dz);
      if (d > 9 && d < 28 && Math.random() < dt * 0.25) {
        const T = 1.1, ux = dx / d, uz = dz / d, off = rnd(-0.06, 0.06) * d;
        throwGrenade(e, e.x + ux * 0.6, 1.5, e.z + uz * 0.6, ux * d / T - uz * off / T, (10 * T * T - 1.3) / T, uz * d / T + ux * off / T);
      }
    }
    if (e.alive && !e.air && Math.hypot(e.x - zone.cx, e.z - zone.cz) > zone.r) {
      e.hp -= zone.dps() * dt;
      if (e === S.player) S.hurtT = Math.max(S.hurtT, 0.15);   // PATCH:server-ready
      if (e.hp <= 0) kill(e, null);
    }
    if (e.alive && hooks.entPost) hooks.entPost(e, dt);
  }
  updateLoot(dt); updateGrenades(dt); updateFx(dt);
  for (let i = feed.length - 1; i >= 0; i--) { feed[i].life -= dt; if (feed[i].life <= 0) feed.splice(i, 1); }

  if (!S.over && !S.player && S.gameTime > 1 && aliveTeamCount() <= 1) { S.over = true; S.winner = firstAlive() || null; }   // cháº¿ Ä‘á»™ server: háº¿t ngÆ°á»i sá»‘ng sĂ³t
}
