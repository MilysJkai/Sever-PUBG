// 2 Ă´ sĂºng: e.w/e.mag/e.scope = sĂºng Ä‘ang cáº§m; e.w2/e.mag2/e.scope2 = sĂºng Ä‘eo.
import { WEAPONS } from '../config/constants.js';
import { S, addFeed } from '../core/state.js';
import { rnd } from '../core/utils.js';
import { addLoot } from '../items/loot.js';
import { snd } from '../core/fx.js';   // PATCH:server-ready

export function getSlot(e, i) {
  return i === e.cur ? { w: e.w, mag: e.mag, scope: e.scope } : { w: e.w2, mag: e.mag2, scope: e.scope2 };
}

export function slotName(i) {
  const s = getSlot(S.player, i);
  return (i === S.player.cur ? '▶' : '') + (s.w < 0 ? '—' : WEAPONS[s.w].n);
}

export function switchSlot(e, i) {
  if (i === e.cur || e.air) return;
  if (getSlot(e, i).w < 0) { if (e.isPlayer) addFeed('Ă” sĂºng ' + (i + 1) + ' Ä‘ang trá»‘ng'); return; }
  let t = e.w; e.w = e.w2; e.w2 = t; t = e.mag; e.mag = e.mag2; e.mag2 = t; t = e.scope; e.scope = e.scope2; e.scope2 = t;
  e.cur = i; e.reload = 0; e.cd = 0.4;
  if (e.isPlayer) snd.playClick({ own: true });
}

export function dropSlot(p, i) {
  const s = getSlot(p, i);
  if (s.w < 0) return;
  addLoot(p.x + rnd(-0.8, 0.8), p.z + 0.8, 'weapon', s.w);
  if (i === p.cur) { p.w = -1; p.mag = 0; p.reload = 0; p.scope = 0; } else { p.w2 = -1; p.mag2 = 0; p.scope2 = 0; }
  if (p.w < 0 && p.w2 >= 0) switchSlot(p, 1 - p.cur);
}
