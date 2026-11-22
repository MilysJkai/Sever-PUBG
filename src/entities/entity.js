/* global THREE */
// Táº¡o & quáº£n lĂ½ thá»±c thá»ƒ (ngÆ°á»i chÆ¡i vĂ  bot dĂ¹ng chung má»™t cáº¥u trĂºc dá»¯ liá»‡u).
import { EYE, HALF, RADIUS } from '../config/constants.js';
import { S, ents } from '../core/state.js';
import { rnd } from '../core/utils.js';
import { collidesAt, freePos } from '../world/map.js';
import { makeHuman } from './human.js';

export function mkEnt(name, isPlayer) {
  const e = {
    name, isPlayer, alive: true, hp: 100, armor: 0, w: -1, mag: 0, reserve: isPlayer ? 0 : 9999, air: 2, tgt: null, jr: 100, crouch: false, lean: 0, cr: 0, gren: isPlayer ? 0 : Math.floor(Math.random() * 3), throwCd: 0, throwT: 0, eye: EYE, w2: -1, mag2: 0, scope2: 0, cur: 0, px: 0, pz: 0, ph: 0, noLoot: 0, lootT: 0, lootRef: null,
    cd: 0, reload: 0, kills: 0, scopes: [true, false, false, false, false, false, false, false], scope: 0, meds: 0, vest: 0, helmet: 0, bag: 0, zero: 0, yaw: rnd(0, 6.28), y: 0, vy: 0,
    target: null, los: false, losT: rnd(0, 0.25), aim: 0, strafeDir: 1, strafeT: 0, slideT: 0, slideAng: 0, stuck: 0, wp: null
  };
  const p = freePos();
  e.x = p[0]; e.z = p[1];
  ents.push(e);
  if (typeof THREE === 'undefined') return e;        // server: khĂ´ng cáº§n mĂ´ hĂ¬nh
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const hm = makeHuman(isPlayer
    ? { jacket: 0xe0cd88, shirt: 0x9e8056, jeans: 0x4a4c50, hair: 0x4a2e20, skin: 0xd2a082, chuteColor: 0xffffff }
    : { jacket: new THREE.Color().setHSL(Math.random(), 0.45, 0.38).getHex(), shirt: pick([0x6b6b6b, 0x8a7a5a, 0x3b4a3b]), jeans: pick([0x33363a, 0x4a4c50, 0x3a3f2f, 0x2b3a55]),
        hair: pick([0x1a1a1a, 0x4a2e20, 0x7a5a2a, 0xb08a4a]), skin: pick([0xf0c8a0, 0xd2a082, 0xa87a5a, 0x7a5238]), chuteColor: new THREE.Color().setHSL(Math.random(), 0.7, 0.55).getHex() });
  S.G.add(hm.group);
  e.mesh = hm.group; e.parts = hm; e.chute = hm.chute; e.gunMesh = hm.gun;
  return e;
}

export function countAlive() { return ents.filter(e => e.alive).length; }
export function firstAlive() { return ents.find(e => e.alive); }

export function moveEnt(e, dx, dz) {
  let moved = false;
  const nx = e.x + dx;
  if (Math.abs(nx) < HALF - 1 && !collidesAt(nx, e.z, RADIUS)) { e.x = nx; moved = true; }
  const nz = e.z + dz;
  if (Math.abs(nz) < HALF - 1 && !collidesAt(e.x, nz, RADIUS)) { e.z = nz; moved = true; }
  return moved || (dx === 0 && dz === 0);
}
