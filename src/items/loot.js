/* global THREE */
// Váº­t pháº©m trĂªn báº£n Ä‘á»“: model, hĂ²m xĂ¡c, sinh Ä‘á»“, nháº·t Ä‘á»“, tĂºi Ä‘á»“, sÆ¡ cá»©u.
import { WEAPONS, SCOPES, ARMOR_MAX, BAG_CAP, LOOT_COL } from '../config/constants.js';
import { S, buildings, ents, loots, addFeed } from '../core/state.js';
import { rnd } from '../core/utils.js';
import { collidesAt, freePos } from '../world/map.js';
import { makeGun } from '../weapons/gun-models.js';
import { makeGrenade } from '../weapons/grenade.js';
import { snd } from '../core/fx.js';

// ---------------------------------------------------------------- model
function makeLootMesh(type, w) {
  const g = new THREE.Group(), M = c => new THREE.MeshLambertMaterial({ color: c });
  const bx = (sx, sy, sz, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M(c)); m.position.set(x, y, z); g.add(m); return m; };
  if (type === 'weapon') {                                  // sĂºng náº±m ngang dÆ°á»›i Ä‘áº¥t
    const gun = makeGun(w); gun.scale.setScalar(1.5); gun.rotation.z = Math.PI / 2; gun.position.y = 0.11;
    gun.traverse(o => { if (o.material) { o.material.emissive.setHex(0xff9922); o.material.emissiveIntensity = 0.3; } });
    g.add(gun);
  } else if (type === 'ammo') {                             // há»™p Ä‘áº¡n quĂ¢n dá»¥ng
    bx(0.44, 0.2, 0.27, 0, 0.1, 0, 0x4b5320); bx(0.46, 0.035, 0.29, 0, 0.19, 0, 0x343b15); bx(0.2, 0.09, 0.012, 0, 0.1, 0.141, 0xf0dc3c);
    bx(0.17, 0.03, 0.035, 0, 0.23, 0, 0x2a2d2f); bx(0.46, 0.02, 0.03, 0, 0.1, 0.1, 0x343b15);
    for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 6), M(0xd4a017)); b.position.set(i * 0.045, 0.26, -0.06); g.add(b); }
    g.scale.setScalar(1.3);
  } else if (type === 'med') {                              // há»™p sÆ¡ cá»©u: tráº¯ng + chá»¯ tháº­p Ä‘á»
    bx(0.42, 0.22, 0.3, 0, 0.11, 0, 0xf2f2f2); bx(0.43, 0.03, 0.31, 0, 0.2, 0, 0xdcdcdc);
    bx(0.22, 0.012, 0.07, 0, 0.226, 0, 0xd8201c); bx(0.07, 0.012, 0.22, 0, 0.226, 0, 0xd8201c);
    bx(0.2, 0.07, 0.01, 0, 0.11, 0.156, 0xd8201c); bx(0.07, 0.2, 0.01, 0, 0.11, 0.157, 0xd8201c);
    bx(0.17, 0.035, 0.04, 0, 0.25, 0, 0x555555);
    g.scale.setScalar(1.3);
  } else if (type === 'gren') {                             // lựu đạn
    const q = makeGrenade(); q.scale.setScalar(1.7); q.position.y = 0.13; g.add(q);
  } else if (type === 'vest') {
    bx(0.44, 0.09, 0.46, 0, 0.045, 0, LOOT_COL.vest); bx(0.32, 0.03, 0.3, 0, 0.1, 0.02, 0x2b5a9a); bx(0.1, 0.03, 0.46, -0.16, 0.1, 0, 0x2b5a9a); bx(0.1, 0.03, 0.46, 0.16, 0.1, 0, 0x2b5a9a);
  } else if (type === 'helmet') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xdddddd)); g.add(h);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 14), M(0x999999)); r.position.y = 0.015; g.add(r);
  } else if (type === 'bag') {
    bx(0.36, 0.42, 0.2, 0, 0.21, 0, 0x8a6a30); bx(0.28, 0.2, 0.09, 0, 0.12, 0.14, 0x6e5326); bx(0.3, 0.04, 0.22, 0, 0.44, 0, 0x6e5326);
    bx(0.04, 0.3, 0.02, -0.12, 0.22, 0.11, 0x2a2a2a); bx(0.04, 0.3, 0.02, 0.12, 0.22, 0.11, 0x2a2a2a);
  } else if (type === 'scope') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 10), M(SCOPES[w].color)); c.rotation.z = Math.PI / 2; c.position.y = 0.06; g.add(c);
    for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 10), M(0x222222)); r.rotation.z = Math.PI / 2; r.position.set(sx * 0.15, 0.06, 0); g.add(r); }
    bx(0.08, 0.04, 0.05, 0, 0.015, 0, 0x222222);
  } else bx(0.4, 0.4, 0.4, 0, 0.2, 0, LOOT_COL[type] || 0xffffff);
  return g;
}

function makeCrate() {
  const g = new THREE.Group(), M = c => new THREE.MeshLambertMaterial({ color: c });
  const bx = (sx, sy, sz, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M(c)); m.position.set(x, y, z); g.add(m); };
  bx(1.0, 0.32, 0.58, 0, 0.16, 0, 0x34393d); bx(1.04, 0.07, 0.62, 0, 0.35, 0, 0x4b5258);
  bx(0.1, 0.08, 0.64, -0.33, 0.35, 0, 0xe6d84a); bx(0.1, 0.08, 0.64, 0.33, 0.35, 0, 0xe6d84a);
  bx(0.2, 0.05, 0.05, 0, 0.4, 0, 0x222222);
  return g;
}

function ringMesh(col, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.78, r, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; return m;
}

// ---------------------------------------------------------------- thĂªm / xoĂ¡ loot
export function addLoot(x, z, type, w, crate) {
  let m = null;
  if (typeof THREE !== 'undefined') {                          // server khĂ´ng cĂ³ mĂ´ hĂ¬nh
    m = new THREE.Group();
    m.add(makeLootMesh(type, w));
    m.position.set(x, 0, z);
    if (crate) m.visible = false;                              // Ä‘á»“ trong hĂ²m xĂ¡c: chá»‰ hiá»‡n trong tĂºi Ä‘á»“
    else { m.rotation.y = Math.random() * 6.28; const r = ringMesh(type === 'weapon' ? 0xff9922 : LOOT_COL[type], 0.42); r.rotation.z = 0; m.add(r); }
    S.G.add(m);
  }
  if (crate) crate.n++;
  loots.push({ x, z, type, w, mesh: m, crate });
}

export function removeLoot(l) {
  const i = loots.indexOf(l);
  if (i < 0) return;
  loots.splice(i, 1);
  if (l.mesh) S.G.remove(l.mesh);
  if (l.crate && --l.crate.n <= 0 && l.crate.mesh) S.G.remove(l.crate.mesh);
}

/** Khi má»™t thá»±c thá»ƒ cháº¿t: táº¡o hĂ²m chá»©a toĂ n bá»™ Ä‘á»“ cá»§a nĂ³. */
export function spawnCrate(e) {
  const c = { n: 0, mesh: null };
  if (typeof THREE !== 'undefined') {
    c.mesh = makeCrate();
    c.mesh.position.set(e.x, 0, e.z); c.mesh.rotation.y = e.yaw;
    c.mesh.add(ringMesh(0xff5555, 0.85));
    S.G.add(c.mesh);
  }
  const put = (t, w) => addLoot(e.x, e.z, t, w, c);
  if (e.w >= 0) put('weapon', e.w);
  if (e.w2 >= 0) put('weapon', e.w2);
  if (e.helmet > 0) put('helmet', e.helmet);
  if (e.vest > 0) put('vest', e.vest);
  if (e.bag > 0) put('bag', e.bag);
  const am = e.isPlayer ? Math.min(2, Math.floor(e.reserve / 30)) : 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < am; i++) put('ammo', 0);
  const md = e.isPlayer ? Math.min(2, e.meds) : (Math.random() < 0.35 ? 1 : 0);
  for (let i = 0; i < md; i++) put('med', 0);
  for (let i = 0; i < Math.min(3, e.gren); i++) put('gren', 0);
  if (c.n === 0 && c.mesh) S.G.remove(c.mesh);
}

function addMisc(x, z) {
  const r = Math.random();
  if (r < 0.35) return addLoot(x, z, 'ammo', 0);
  if (r < 0.55) return addLoot(x, z, 'med', 0);
  if (r < 0.7) return addLoot(x, z, 'gren', 0);
  const q = Math.random(), lv = q < 0.55 ? 1 : q < 0.88 ? 2 : 3, k = Math.random();
  addLoot(x, z, k < 0.4 ? 'vest' : k < 0.7 ? 'helmet' : 'bag', lv);
}

export function spawnLoot() {
  for (const b of buildings) {            // má»—i nhĂ  cĂ³ 2-3 mĂ³n Ä‘á»“, Ä‘a sá»‘ lĂ  sĂºng
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      let x = b[0], z = b[1];
      for (let i = 0; i < 10; i++) {
        x = b[0] + rnd(-b[2] / 2 + 1.2, b[2] / 2 - 1.2); z = b[1] + rnd(-b[3] / 2 + 1.2, b[3] / 2 - 1.2);
        if (!collidesAt(x, z, 0.7)) break;
      }
      const r = Math.random();
      if (r < 0.6) { const q = Math.random(); addLoot(x, z, 'weapon', q < 0.2 ? 0 : q < 0.45 ? 1 : q < 0.65 ? 2 : q < 0.92 ? 3 : 4); }
      else addMisc(x, z);
    }
  }
  for (let i = 0; i < 130; i++) {
    const p = freePos(), r = Math.random();
    if (r < 0.3) {
      const q = Math.random();
      addLoot(p[0], p[1], 'weapon', q < 0.15 ? 0 : q < 0.4 ? 1 : q < 0.6 ? 2 : q < 0.92 ? 3 : 4);
    } else addMisc(p[0], p[1]);
  }
  const W8 = [0.22, 0.20, 0.18, 0.15, 0.11, 0.09, 0.05];   // độ hiếm: Red Dot ... 8x
  for (let i = 0; i < 45; i++) {
    const p = freePos();
    let q = Math.random(), k = 0;
    while (k < W8.length - 1 && q > W8[k]) { q -= W8[k]; k++; }
    addLoot(p[0], p[1], 'scope', k + 1);
  }
}

// ---------------------------------------------------------------- tĂºi Ä‘á»“ (logic)
export function itemName(l) {
  switch (l.type) {
    case 'weapon': return WEAPONS[l.w].n;
    case 'scope': return SCOPES[l.w].n;
    case 'ammo': return 'Äáº¡n 5.56mm Ă—30';
    case 'med': return 'Bộ sơ cứu';
    case 'vest': return 'GiĂ¡p cáº¥p ' + l.w;
    case 'helmet': return 'Mũ cấp ' + l.w;
    case 'bag': return 'Ba lĂ´ cáº¥p ' + l.w;
    case 'gren': return 'Lựu đạn';
  }
  return '?';
}
export function bagLoad(e) { return e.meds + e.gren + Math.ceil(e.reserve / 30) + e.scopes.reduce((n, o, i) => n + (i && o ? 1 : 0), 0); }
export function cap(e) { return BAG_CAP[e.bag]; }

export function nearestLoot(e, r) {
  let b = null, bd = r;
  for (const l of loots) { const d = Math.hypot(l.x - e.x, l.z - e.z); if (d < bd) { bd = d; b = l; } }
  return b;
}

export function pickup(e, l, allowWeapon) {
  const P = e.isPlayer;
  switch (l.type) {
    case 'weapon':
      if (!allowWeapon) return false;
      if (!P && l.w <= e.w) return false;
      if (P) {
        S.fPressed = false;
        e.reserve += WEAPONS[l.w].mag;
        if (l.w === e.w || l.w === e.w2) return true;          // trĂ¹ng sĂºng -> chá»‰ láº¥y Ä‘áº¡n
        if (e.w < 0) { e.w = l.w; e.mag = WEAPONS[l.w].mag; e.scope = 0; e.reload = 0; addFeed('Nháº·t ' + WEAPONS[l.w].n + ' (sĂºng ' + (e.cur + 1) + ')'); }
        else if (e.w2 < 0) { e.w2 = l.w; e.mag2 = WEAPONS[l.w].mag; e.scope2 = 0; addFeed('Nháº·t ' + WEAPONS[l.w].n + ' (sĂºng ' + (2 - e.cur) + ') â€” phĂ­m ' + (2 - e.cur) + ' Ä‘á»ƒ Ä‘á»•i'); }
        else { addLoot(e.x + 0.01, e.z, 'weapon', e.w); e.w = l.w; e.mag = WEAPONS[l.w].mag; e.scope = 0; e.reload = 0; addFeed('Äá»•i sang ' + WEAPONS[l.w].n); }
        return true;
      }
      e.w = l.w; e.mag = WEAPONS[l.w].mag; e.reload = 0;
      return true;
    case 'scope':
      if (!P) return false;
      if (e.scopes[l.w]) { addFeed('Báº¡n Ä‘Ă£ cĂ³ ' + SCOPES[l.w].n); return false; }
      if (bagLoad(e) >= cap(e)) { addFeed('TĂºi Ä‘á»“ Ä‘áº§y!'); return false; }
      e.scopes[l.w] = true;
      if (e.scope === 0 && e.w >= 0) e.scope = l.w;
      addFeed('Nháº·t ' + SCOPES[l.w].n + (e.scope === l.w ? ' (Ä‘Ă£ láº¯p)' : ' â€” [TAB] Ä‘á»ƒ láº¯p'));
      return true;
    case 'ammo':
      if (!P) return false;
      if (bagLoad(e) >= cap(e)) { addFeed('TĂºi Ä‘á»“ Ä‘áº§y!'); return false; }
      e.reserve += 30; return true;
    case 'med':
      if (P) {
        if (bagLoad(e) >= cap(e)) { addFeed('TĂºi Ä‘á»“ Ä‘áº§y!'); return false; }
        e.meds++; addFeed('Nháº·t bá»™ sÆ¡ cá»©u  [H: dĂ¹ng]'); return true;
      }
      if (e.hp < 100) { e.hp = Math.min(100, e.hp + 45); return true; }
      return false;
    case 'gren':
      if (!P) return false;
      if (bagLoad(e) >= cap(e)) { addFeed('TĂºi Ä‘á»“ Ä‘áº§y!'); return false; }
      if (e.gren >= 6) { addFeed('Tối đa 6 lựu đạn'); return false; }
      e.gren++; addFeed('Nháº·t Lá»±u Ä‘áº¡n  [G: nĂ©m]'); return true;
    case 'vest':
    case 'helmet': {
      const k = l.type;
      if (!P && l.w <= e[k]) return false;
      if (P && e[k] > 0) addLoot(e.x + 0.6, e.z, k, e[k]);
      e[k] = l.w;
      if (k === 'vest') e.armor = ARMOR_MAX[l.w];
      if (P) addFeed('Trang bị ' + itemName(l));
      return true;
    }
    case 'bag':
      if (!P) return false;
      if (e.bag > 0) addLoot(e.x + 0.6, e.z, 'bag', e.bag);
      e.bag = l.w; addFeed('Trang bị ' + itemName(l) + ' (sức chứa ' + cap(e) + ')');
      return true;
  }
  return false;
}

export function takeLoot(l, p = S.player) {   // PATCH:server-ready
  const i = loots.indexOf(l);
  if (i < 0) return;
  if (pickup(p, l, true)) { removeLoot(l); snd.playPickup(); }
}
export function pickNearest(e) { const l = nearestLoot(e, 2.4); if (l) takeLoot(l, e); }

export function useMed(p = S.player) {
  if (!p.alive || p.air) return;
  if (p.meds <= 0) { addFeed('Hết bộ sơ cứu'); return; }
  if (p.hp >= 100) { addFeed('MĂ¡u Ä‘Ă£ Ä‘áº§y'); return; }
  p.meds--; p.hp = Math.min(100, p.hp + 45); addFeed('ÄĂ£ dĂ¹ng bá»™ sÆ¡ cá»©u (+45 HP)');
}

export function dropGear(k, p = S.player) {                       // helmet | vest | bag
  if (p[k] <= 0) return;
  addLoot(p.x + rnd(-0.8, 0.8), p.z + 0.8, k, p[k]);
  p[k] = 0; if (k === 'vest') p.armor = 0;
}

// ---------------------------------------------------------------- bot nhặt đồ
export function wanted(e, l) {
  if (e.w < 0 && l.type !== 'weapon') return false;
  return l.type === 'weapon' ? l.w > e.w : l.type === 'med' ? e.hp < 100 : l.type === 'vest' ? l.w > e.vest : l.type === 'helmet' ? l.w > e.helmet : false;
}

export function updateLoot(dt) {
  for (const e of ents) {
    if (!e.alive || e.air || e.isPlayer) continue;
    if (e.noLoot > 0) { e.noLoot -= dt; continue; }          // vừa tiếp đất: chưa nhặt được ngay
    let cand = null, bd = 1.6;
    for (const l of loots) {
      const d = Math.hypot(l.x - e.x, l.z - e.z);
      if (d < bd && wanted(e, l)) { bd = d; cand = l; }
    }
    if (!cand) { e.lootRef = null; continue; }
    if (e.lootRef !== cand) { e.lootRef = cand; e.lootT = rnd(1.2, 2.8); }     // Ä‘á»©ng láº¡i "nháº·t" máº¥t 1-3 giĂ¢y
    else if ((e.lootT -= dt) <= 0) {
      const i = loots.indexOf(cand);
      if (i >= 0 && pickup(e, cand, true)) removeLoot(cand);
      e.lootRef = null;
    }
  }
}
