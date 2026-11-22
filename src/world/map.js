/* global THREE */
// Báº£n Ä‘á»“ phong cĂ¡ch Viá»‡t Nam: phá»‘ nhĂ  á»‘ng, lĂ ng quĂª, chá»£, chĂ¹a, Ä‘Ă¬nh, trá»¥ sá»Ÿ (cá» Ä‘á» sao vĂ ng),
// ruá»™ng lĂºa + trĂ¢u, ao sen, tre/dá»«a/chuá»‘i/Ä‘a, xe mĂ¡y, cá»™t Ä‘iá»‡n, nĂºi xa...
// Hiá»‡u nÄƒng: má»i váº­t thá»ƒ váº½ báº±ng InstancedMesh (~7 draw call). Va cháº¡m váº«n lĂ  há»™p theo trá»¥c
// {minX,maxX,minZ,maxZ,h} nĂªn raycast.js dĂ¹ng nguyĂªn, khĂ´ng cáº§n sá»­a.
import { HALF } from '../config/constants.js';
import { S, buildings, colliders } from '../core/state.js';
import { clamp } from '../core/utils.js';
import { mulberry32 } from '../core/rng.js';

const PI = Math.PI, RW = 8; // RW: bá» rá»™ng Ä‘Æ°á»ng chĂ­nh
// RNG cá»§a báº£n Ä‘á»“: seed cá»‘ Ä‘á»‹nh -> server vĂ  client dá»±ng ra CĂ™NG má»™t báº£n Ä‘á»“. NgoĂ i lĂºc dá»±ng thĂ¬ dĂ¹ng Math.random.
let R = Math.random;
const rnd = (a, b) => a + R() * (b - a);
const T = typeof THREE !== 'undefined' ? THREE : null;   // khĂ´ng cĂ³ THREE (server Node) -> chá»‰ dá»±ng va cháº¡m, bá» pháº§n váº½
const pick = a => a[(R() * a.length) | 0];
const chance = p => R() < p;
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const shade = (hex, k) => {
  const f = s => clamp(((hex >> s) & 255) * k, 0, 255) | 0;
  return (f(16) << 16) | (f(8) << 8) | f(0);
};

const WALLS = [0xf2e3b0, 0xf4d06f, 0xf3b6a3, 0x9fd3c7, 0xbcd9a0, 0xf0efe8, 0xe8a87c, 0xa9c8e8];
const ROOFS = [0xb5472c, 0x9c3b2a, 0x3f6f8a, 0xc0562f, 0x6b7d3a];
const GREENS = [0x3f8a3c, 0x4a9a45, 0x357a38, 0x5aa04a];
const SIGNS = [0xd9382c, 0x2f7fc1, 0xf2b632, 0x3aa655, 0x8e44ad];
const TARPS = [0xd9382c, 0x2f7fc1, 0xf2b632, 0x3aa655, 0xe86a92, 0xff8a3d];

// ---------- Batch instancing ----------
let B, F, CY, CO, PY, SP, GR; // há»™p, há»™p pháº³ng (decal), trá»¥, nĂ³n, chĂ³p 4 máº·t, cáº§u
let RX = 0, RZ = 0;
const taken = [], ponds = [], vill = [], paddies = [], labels = [];
export const ZONES = []; // {name,x,z,r}: cĂ¡c khu vá»±c cĂ³ tĂªn
let NV = [], NP = [], NO = [], ND = [];
const nm = (list, def) => list.splice(irnd(0, list.length - 1), 1)[0] || def;
function zone(name, x, z, r, h = 26) { ZONES.push({ name, x, z, r }); labels.push([name, x, h, z]); }


function mk(geo, decal) {
  if (!T) return { add() {}, build() {} };
  const it = [], e = new THREE.Euler(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  return {
    add(x, y, z, sx, sy, sz, color, ry, rz, rx) { it.push([x, y + gy(x, z), z, sx, sy, sz, color, ry || 0, rz || 0, rx || 0]); },
    build() {
      if (!it.length) return;
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      if (decal) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; }
      const im = new THREE.InstancedMesh(geo, mat, it.length);
      it.forEach((a, i) => {
        e.set(a[9], a[7], a[8], 'YXZ'); q.setFromEuler(e);
        m.compose(p.set(a[0], a[1], a[2]), q, s.set(a[3], a[4], a[5]));
        im.setMatrixAt(i, m); im.setColorAt(i, c.setHex(a[6]));
      });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      S.G.add(im);
    },
  };
}

// ---------- Helper cơ bản ----------
const col = (x, z, w, d, h, kind, y0) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: gy(x, z) + (y0 || 0) + h, kind: kind || 'concrete' }); // h = cao Ä‘á»™ Äá»ˆNH (tuyá»‡t Ä‘á»‘i, Ä‘Ă£ cá»™ng Ä‘á»‹a hĂ¬nh); kind: concrete | wood | metal | flesh
function box(x, z, w, d, h, c, solid, y0, kind) { B.add(x, (y0 || 0) + h / 2, z, w, h, d, c); if (solid) col(x, z, w, d, h, kind, y0); }
const flat = (x, z, w, d, c) => paintRect(x, z, w, d, c); // váº½ tháº³ng vĂ o texture máº·t Ä‘áº¥t
const hit = (x, z, w, d, m) => taken.some(r => x - w / 2 - m < r[1] && x + w / 2 + m > r[0] && z - d / 2 - m < r[3] && z + d / 2 + m > r[2]);
const take = (x, z, w, d) => taken.push([x - w / 2, x + w / 2, z - d / 2, z + d / 2]);
const free = (x, z, w, d) => !hit(x, z, w, d, 0);
function spot(w, d, m, lo = 12) {
  for (let i = 0; i < 80; i++) {
    const x = rnd(-HALF + lo + w / 2, HALF - lo - w / 2), z = rnd(-HALF + lo + d / 2, HALF - lo - d / 2);
    if (!hit(x, z, w, d, m)) return [x, z];
  }
  return null;
}
// Váº­t thá»ƒ cĂ³ hÆ°á»›ng dá»c trá»¥c x (ax=true) hoáº·c z; lx: dá»c thĂ¢n, lz: ngang thĂ¢n
function P(o, lx, y, lz, sx, sy, sz, c, wheel) {
  const x = o.ax ? o.x + lx : o.x + lz, z = o.ax ? o.z + lz : o.z + lx;
  if (wheel) CY.add(x, y, z, sx, sy, sz, c, 0, o.ax ? 0 : PI / 2, o.ax ? PI / 2 : 0);
  else B.add(x, y, z, o.ax ? sx : sz, sy, o.ax ? sz : sx, c);
}

// ---------- Äá»‹a hĂ¬nh (Ä‘á»“i, dá»‘c, sÆ°á»n nĂºi) ----------
// LÆ°á»›i Ä‘á»™ cao TH phá»§ [-LIM, LIM]. Quanh má»i Ä‘Æ°á»ng/cĂ´ng trĂ¬nh (taken) Ä‘á»‹a hĂ¬nh Ä‘Æ°á»£c á»§i pháº³ng vá» y=0 rá»“i dá»‘c dáº§n lĂªn,
// nĂªn nhĂ  cá»­a váº«n Ä‘áº·t á»Ÿ y=0; cĂ¢y, Ä‘Ă¡, cá»... tá»± bĂ¡m theo gy(x,z). Máº·t Ä‘áº¥t váº½ thĂ nh 1 texture (háº¿t z-fighting/nhĂ²e).
const GROUND_TEX = 4096; // giáº£m xuá»‘ng 2048 náº¿u mĂ¡y yáº¿u
let LIM = 0, TL = 0, NG = 2, GCELL = 4, TH = null, GX = null, TK = 1, SEED = 0;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hex = c => '#' + ((c | 0) | 0x1000000).toString(16).slice(1);
const GRASS = [0x5f8f47, 0x6a9a4a, 0x547f3f, 0x739f4b, 0x4d7a3c], DRY = [0xa3a85a, 0xb4ac60, 0x8f9f50, 0xc2b36a];

function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263 + SEED * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function rawH(x, z) {
  let h = (vnoise(x / 170 + 7.3, z / 170 + 3.1) - 0.5) * 30 + (vnoise(x / 64 + 1.7, z / 64 + 9.2) - 0.5) * 9 + (vnoise(x / 24 + 5.1, z / 24 + 2.3) - 0.5) * 2.2;
  if (h < 0) h *= 0.4; // thung lÅ©ng nĂ´ng hÆ¡n Ä‘á»‰nh Ä‘á»“i
  const e = Math.max(Math.abs(x), Math.abs(z)) - (HALF - 30);
  if (e > 0) h += (26 + 14 * vnoise(x / 90 + 2, z / 90 + 6)) * sstep(0, 190, e); // sÆ°á»n nĂºi bao quanh biĂªn báº£n Ä‘á»“
  return h;
}
/** Äá»™ cao Ä‘á»‹a hĂ¬nh táº¡i (x,z) â€” ná»™i suy Ä‘Ăºng theo tam giĂ¡c cá»§a mesh. */
export function gy(x, z) {
  if (!TH) return 0;
  const u = clamp((x + LIM) / GCELL, 0, NG - 1.001), v = clamp((z + LIM) / GCELL, 0, NG - 1.001);
  const i = u | 0, j = v | 0, fx = u - i, fz = v - j, k = j * NG + i;
  const h00 = TH[k], h10 = TH[k + 1], h01 = TH[k + NG], h11 = TH[k + NG + 1];
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
const slopeAt = (x, z) => Math.hypot(gy(x + 1.5, z) - gy(x - 1.5, z), gy(x, z + 1.5) - gy(x, z - 1.5)) / 3;

// ---- Váº½ lĂªn texture máº·t Ä‘áº¥t (thay cho cĂ¡c táº¥m decal pháº³ng) ----
const pX = x => (x + TL) * TK, pZ = z => (z + TL) * TK;
function paintRect(x, z, w, d, c) { if (!GX) return; GX.fillStyle = hex(c); GX.fillRect(pX(x - w / 2), pZ(z - d / 2), w * TK, d * TK); }
function paintDisc(x, z, r, c) { if (!GX) return; GX.fillStyle = hex(c); GX.beginPath(); GX.arc(pX(x), pZ(z), r * TK, 0, 2 * PI); GX.fill(); }

function initGround() {
  LIM = HALF + 420; TL = HALF + 40;
  NG = Math.min(321, Math.ceil((LIM * 2) / 3) + 1); GCELL = (LIM * 2) / (NG - 1);
  GX = null;
  if (typeof document === 'undefined') return;
  const cv = document.createElement('canvas'); cv.width = cv.height = GROUND_TEX;
  GX = cv.getContext('2d'); if (!GX) return;
  TK = GROUND_TEX / (2 * TL);
  GX.fillStyle = hex(0x5f8f47); GX.fillRect(0, 0, GROUND_TEX, GROUND_TEX);
  const area = (2 * TL) ** 2, B0 = TL - 24;
  for (let i = Math.min(5000, Math.round(area / 90)); i > 0; i--) { // máº£ng cá» lá»›n: xanh â†” vĂ ng khĂ´ theo Ä‘á»™ cao
    const x = rnd(-B0, B0), z = rnd(-B0, B0), dry = sstep(1, 11, rawH(x, z)), r = rnd(4, 18);
    GX.globalAlpha = rnd(0.12, 0.3); GX.fillStyle = hex(pick(chance(0.1 + 0.55 * dry) ? DRY : GRASS));
    GX.beginPath(); GX.ellipse(pX(x), pZ(z), r * TK, r * TK * rnd(0.5, 1), rnd(0, PI), 0, 2 * PI); GX.fill();
  }
  for (let i = Math.min(40000, Math.round(area / 12)); i > 0; i--) { // Ä‘á»‘m nhá» táº¡o vĂ¢n cá»
    const x = rnd(-B0, B0), z = rnd(-B0, B0), r = rnd(0.3, 1);
    GX.globalAlpha = 0.35; GX.fillStyle = hex(shade(pick(chance(0.25) ? DRY : GRASS), rnd(0.8, 1.15)));
    GX.beginPath(); GX.ellipse(pX(x), pZ(z), r * TK, r * TK * 0.6, rnd(0, PI), 0, 2 * PI); GX.fill();
  }
  GX.globalAlpha = 1;
}

/** Chá»‘t Ä‘á»‹a hĂ¬nh sau khi Ä‘Ă£ Ä‘áº·t xong má»i thá»© pháº£i náº±m pháº³ng (Ä‘Æ°á»ng, nhĂ , ruá»™ng, ao...). */
function freezeTerrain() {
  const n = NG, m = new Float32Array(n * n).fill(1), FR = GCELL * 1.5, M = 14;
  for (const r of taken) {
    const i0 = Math.max(0, Math.floor((r[0] - FR - M + LIM) / GCELL)), i1 = Math.min(n - 1, Math.ceil((r[1] + FR + M + LIM) / GCELL));
    const j0 = Math.max(0, Math.floor((r[2] - FR - M + LIM) / GCELL)), j1 = Math.min(n - 1, Math.ceil((r[3] + FR + M + LIM) / GCELL));
    for (let j = j0; j <= j1; j++) {
      const z = -LIM + j * GCELL, dz = Math.max(r[2] - z, 0, z - r[3]);
      for (let i = i0; i <= i1; i++) {
        const x = -LIM + i * GCELL, dx = Math.max(r[0] - x, 0, x - r[1]), dd = Math.hypot(dx, dz);
        if (dd >= FR + M) continue;
        const v = sstep(FR, FR + M, dd);
        if (v < m[j * n + i]) m[j * n + i] = v;
      }
    }
  }
  TH = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) TH[j * n + i] = rawH(-LIM + i * GCELL, -LIM + j * GCELL) * m[j * n + i];
}

// áº¨n máº·t pháº³ng/há»™p ná»n cÅ© cá»§a game (náº¿u cĂ³) vĂ¬ Ä‘á»‹a hĂ¬nh má»›i Ä‘Ă£ thay tháº¿ nĂ³
function hideOldGround() {
  let root = S.G; while (root && root.parent) root = root.parent;
  if (!root || !root.traverse) return;
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.parameters) return;
    const g = o.geometry, q = g.parameters, big = Math.max(q.width || 0, q.depth || 0, q.height || 0) >= HALF * 1.5;
    const plane = g.type === 'PlaneGeometry' || g.type === 'CircleGeometry' || (g.type === 'BoxGeometry' && (q.height || 0) < 2);
    if (big && plane && Math.abs(o.position.y) < 1.5) o.visible = false;
  });
}

function terrainMesh() {
  if (!T) return;
  const n = NG, pos = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2), cl = new Float32Array(n * n * 3), c = new THREE.Color();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = -LIM + i * GCELL, z = -LIM + j * GCELL;
    pos[k * 3] = x; pos[k * 3 + 1] = TH[k]; pos[k * 3 + 2] = z;
    uv[k * 2] = (x + TL) / (2 * TL); uv[k * 2 + 1] = (z + TL) / (2 * TL);
    const sx = (TH[j * n + Math.min(i + 1, n - 1)] - TH[j * n + Math.max(i - 1, 0)]) / (2 * GCELL);
    const sz = (TH[Math.min(j + 1, n - 1) * n + i] - TH[Math.max(j - 1, 0) * n + i]) / (2 * GCELL);
    const t = sstep(0.12, 0.5, Math.hypot(sx, sz)), o = sstep(TL - 10, TL + 90, Math.max(Math.abs(x), Math.abs(z)));
    c.setRGB((1 - 0.3 * t) * (1 - 0.22 * o), (1 - 0.4 * t) * (1 - 0.12 * o), (1 - 0.5 * t) * (1 - 0.25 * o)); // sÆ°á»n dá»‘c ngáº£ nĂ¢u/Ä‘Ă¡, xa tá»‘i nhÆ° rá»«ng
    cl[k * 3] = c.r; cl[k * 3 + 1] = c.g; cl[k * 3 + 2] = c.b;
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6); let p = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c2 = a + n, d = c2 + 1;
    idx[p++] = a; idx[p++] = c2; idx[p++] = b; idx[p++] = b; idx[p++] = c2; idx[p++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  let tex = null;
  if (GX) {
    tex = new THREE.CanvasTexture(GX.canvas); tex.flipY = false; tex.anisotropy = 8;
    const cm = THREE.ColorManagement; // chá»‰ Ä‘Ă¡nh dáº¥u sRGB khi color management báº­t; náº¿u khĂ´ng, váº­t liá»‡u khĂ¡c cÅ©ng Ä‘ang dĂ¹ng mĂ u 'thĂ´' â†’ Ä‘á»ƒ texture cĂ¹ng há»‡
    if (cm && cm.enabled && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  }
  const mat = new THREE.MeshLambertMaterial({ color: tex ? 0xffffff : 0x5f8f47, map: tex, vertexColors: true });
  mat.polygonOffset = true; mat.polygonOffsetFactor = -3; mat.polygonOffsetUnits = -3; // luĂ´n tháº¯ng má»i máº·t pháº³ng trĂ¹ng y=0
  hideOldGround();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; S.G.add(mesh);
}

// ---------- Táº§ng 2+ & cáº§u thang (Ä‘i lĂªn Ä‘Æ°á»£c) ----------
// ups: váº­t cáº£n cĂ³ cao Ä‘á»™ Ä‘Ă¡y/Ä‘á»‰nh (chá»‰ dĂ¹ng khi collidesAt nháº­n tham sá»‘ y) Â· floors: máº·t sĂ n Ä‘á»©ng Ä‘Æ°á»£c Â· ramps: máº·t dá»‘c cáº§u thang.
const STG = 0.75, SWD = 1.5, STEP = 0.45; // Ä‘á»™ dá»‘c cáº§u thang, bá» rá»™ng, bÆ°á»›c chĂ¢n tá»‘i Ä‘a
const ups = [], floors = [], ramps = [];
const ovl = (a, b, m) => a.x0 - m < b.x1 && a.x1 + m > b.x0 && a.z0 - m < b.z1 && a.z1 + m > b.z0;

// TĂ¬m chá»— Ä‘áº·t cáº§u thang bĂªn trong nhĂ  (khĂ´ng cháº¯n cá»­a). Tráº£ vá» máº£ng cáº§u thang theo tá»«ng táº§ng, hoáº·c null náº¿u khĂ´ng Ä‘á»§ chá»—.
function planStairs(cx, cz, w, d, door, dc, GAP, nfl, FH) {
  const xi0 = cx - w / 2 + 0.2, xi1 = cx + w / 2 - 0.2, zi0 = cz - d / 2 + 0.2, zi1 = cz + d / 2 - 0.2, LS = FH / STG;
  const f = [[0, -1], [0, 1], [-1, 0], [1, 0]][door], hf = (door < 2 ? d : w) / 2;
  const lanes = dc.map(g => (door < 2
    ? { x0: cx + g - GAP / 2 - 0.5, x1: cx + g + GAP / 2 + 0.5, z0: cz + f[1] * (hf - 1.1) - 1.1, z1: cz + f[1] * (hf - 1.1) + 1.1 }
    : { x0: cx + f[0] * (hf - 1.1) - 1.1, x1: cx + f[0] * (hf - 1.1) + 1.1, z0: cz + g - GAP / 2 - 0.5, z1: cz + g + GAP / 2 + 0.5 }));
  const axes = [['x', xi0, xi1, zi0, zi1], ['z', zi0, zi1, xi0, xi1]].sort((p, q) => (q[2] - q[1]) - (p[2] - p[1]));
  const sides = chance(0.5) ? [1, -1] : [-1, 1];
  for (const [ax, a0, a1, l0, l1] of axes) for (const s of sides) for (const off of [0, 1.6, 3]) for (const dir of [1, -1]) {
    const plan = []; let ok = true;
    for (let k = 0; k < nfl - 1 && ok; k++) {
      const odd = k % 2, sk = odd ? -s : s, dk = odd ? -dir : dir;
      let u0, u1;
      if (dir > 0) { u0 = a0 + off; u1 = u0 + LS; } else { u1 = a1 - off; u0 = u1 - LS; }
      if (odd) { u0 += dir * 0.3; u1 += dir * 0.3; }
      const lo = sk > 0 ? l1 - SWD : l0, hi = lo + SWD;
      ok = u0 >= a0 - 1e-6 && u1 <= a1 + 1e-6 && (dk > 0 ? a1 - u1 : u0 - a0) >= 0.9 - 1e-6; // chá»«a chiáº¿u nghá»‰ á»Ÿ Ä‘áº§u trĂªn
      const r = ax === 'x' ? { x0: u0, x1: u1, z0: lo, z1: hi } : { x0: lo, x1: hi, z0: u0, z1: u1 };
      if (ok && k === 0 && lanes.some(q => ovl(r, q, 0.1))) ok = false;
      if (ok && k > 0 && ovl(r, plan[k - 1], 0.05)) ok = false;
      if (ok) plan.push({ ...r, k, ax, dir: dk, s: sk, y0: k * FH, y1: (k + 1) * FH, len: LS });
    }
    if (ok && plan.length) return plan;
  }
  return null;
}

function slab(x0, x1, z0, z1, y, op) { // sĂ n dĂ y 0.25, Ä‘á»¥c lá»— cáº§u thang
  const parts = op ? [[x0, op.x0, z0, z1], [op.x1, x1, z0, z1], [op.x0, op.x1, z0, op.z0], [op.x0, op.x1, op.z1, z1]] : [[x0, x1, z0, z1]];
  for (const [a, b, c, e] of parts) if (b - a > 0.05 && e - c > 0.05) {
    B.add((a + b) / 2, y - 0.125, (c + e) / 2, b - a, 0.25, e - c, 0xb89564);
    ups.push({ minX: a, maxX: b, minZ: c, maxZ: e, y0: y - 0.25, h: y, up: true, kind: 'wood' });
    floors.push({ minX: a, maxX: b, minZ: c, maxZ: e, y });
  }
}

function steps(st, FH) {
  const len = st.len, ax = st.ax === 'x', a = ax ? st.x0 : st.z0, b = ax ? st.x1 : st.z1;
  const seg = (i, n) => { const run = len / n; return st.dir > 0 ? [a + i * run, a + (i + 1) * run] : [b - (i + 1) * run, b - i * run]; };
  const rc = (u0, u1) => (ax ? [u0, u1, st.z0, st.z1] : [st.x0, st.x1, u0, u1]);
  const N = Math.ceil(FH / 0.27), NC = Math.ceil(FH / 0.425);
  for (let i = 0; i < N; i++) { // báº­c nhĂ¬n tháº¥y
    const [u0, u1] = seg(i, N), [x0, x1, z0, z1] = rc(u0, u1), hh = ((i + 1) * FH) / N;
    B.add((x0 + x1) / 2, st.y0 + hh / 2, (z0 + z1) / 2, x1 - x0, hh, z1 - z0, shade(0xb08a5a, i % 2 ? 0.92 : 1.05));
  }
  for (let i = 1; i < NC; i++) { // khá»‘i cháº¯n thĂ´ (tháº¥p hÆ¡n báº­c tháº­t Ä‘á»ƒ Ä‘i lĂªn mÆ°á»£t)
    const [u0, u1] = seg(i, NC), [x0, x1, z0, z1] = rc(u0, u1);
    ups.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y0: st.y0, h: st.y0 + (i * FH) / NC, up: true, kind: 'wood' });
  }
  ramps.push({ ax: st.ax, dir: st.dir, x0: st.x0, x1: st.x1, z0: st.z0, z1: st.z1, y0: st.y0, y1: st.y1 });
}

function railing(st, y) { // lan can quanh lá»— cáº§u thang (chá»«a Ä‘áº§u trĂªn Ä‘á»ƒ bÆ°á»›c lĂªn sĂ n)
  const rail = (x, z, sx, sz) => {
    B.add(x, y + 0.5, z, sx, 1, sz, 0x6b4a2b);
    ups.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, y0: y, h: y + 1, up: true, kind: 'wood' });
  };
  const mx = (st.x0 + st.x1) / 2, mz = (st.z0 + st.z1) / 2, lx = st.x1 - st.x0, lz = st.z1 - st.z0;
  if (st.ax === 'x') { rail(mx, st.s > 0 ? st.z0 : st.z1, lx, 0.1); rail(st.dir > 0 ? st.x0 : st.x1, mz, 0.1, lz); }
  else { rail(st.s > 0 ? st.x0 : st.x1, mz, 0.1, lz); rail(mx, st.dir > 0 ? st.z0 : st.z1, lx, 0.1); }
}

function upperRoom(x0, x1, z0, z1, y, occ) { // ná»™i tháº¥t táº§ng trĂªn, trĂ¡nh cáº§u thang
  const placed = [];
  const spots = [[x0 + 1.3, z0 + 0.8, 2, 1.1, 0.55, 0xcfae7a], [x1 - 1.3, z1 - 0.8, 2, 1.1, 0.55, 0xcfae7a], [x1 - 1, z0 + 0.5, 1.6, 0.6, 1.8, 0x6b4a2b], [x0 + 1, z1 - 0.6, 1, 1, 0.75, 0x8a6a45], [(x0 + x1) / 2, (z0 + z1) / 2, 1, 1, 0.75, 0x8a6a45]];
  for (const [x, z, a, b, h, c] of spots) {
    const r = { x0: x - a / 2, x1: x + a / 2, z0: z - b / 2, z1: z + b / 2 };
    if (r.x0 < x0 + 0.1 || r.x1 > x1 - 0.1 || r.z0 < z0 + 0.1 || r.z1 > z1 - 0.1) continue;
    if (occ.some(o => ovl(r, o, 0.9)) || placed.some(o => ovl(r, o, 0.1))) continue;
    B.add(x, y + h / 2, z, a, h, b, c);
    ups.push({ minX: r.x0, maxX: r.x1, minZ: r.z0, maxZ: r.z1, y0: y, h: y + h, up: true, kind: 'wood' });
    placed.push(r);
  }
}

function buildUpper(cx, cz, w, d, plan, FH) {
  const xi0 = cx - w / 2 + 0.2, xi1 = cx + w / 2 - 0.2, zi0 = cz - d / 2 + 0.2, zi1 = cz + d / 2 - 0.2;
  plan.forEach((st, k) => {
    const y = (k + 1) * FH;
    slab(xi0, xi1, zi0, zi1, y, st); steps(st, FH); railing(st, y);
    upperRoom(xi0, xi1, zi0, zi1, y, [st, plan[k + 1]].filter(Boolean));
  });
}

// ---------- Đường ----------
function road(horiz, p, w, color, dash) {
  const L = HALF * 2, sh = dash ? 0x7c7b72 : shade(color, 0.8); // vai Ä‘Æ°á»ng
  if (horiz) { paintRect(0, p, L, w + 1.6, sh); paintRect(0, p, L, w, color); take(0, p, L, w + 2); }
  else { paintRect(p, 0, w + 1.6, L, sh); paintRect(p, 0, w, L, color); take(p, 0, w + 2, L); }
  if (!dash) return;
  for (let t = -HALF + 4; t < HALF - 4; t += 8)
    horiz ? paintRect(t, p, 4, 0.25, 0xe9e2b8) : paintRect(p, t, 0.25, 4, 0xe9e2b8);
}

// ---------- Cá»­a sá»• & nhĂ  ----------
// (x,z): tĂ¢m tÆ°á»ng; side: 0 -z, 1 +z, 2 -x, 3 +x (hÆ°á»›ng ra ngoĂ i)
function win(x, y, z, side) {
  const a = side < 2, g = side % 2 ? 1 : -1;
  B.add(a ? x : x + g * 0.24, y, a ? z + g * 0.24 : z, a ? 1.4 : 0.1, 1.6, a ? 0.1 : 1.4, 0xf5f2ea);
  B.add(a ? x : x + g * 0.3, y, a ? z + g * 0.3 : z, a ? 1.0 : 0.12, 1.2, a ? 0.12 : 1.0, 0x2b4a63);
}

function templeRoof(cx, cz, w, d, H, c, wall) {
  const w2 = w * 0.62, d2 = d * 0.62;
  B.add(cx, H + 0.15, cz, w + 3, 0.3, d + 3, shade(c, 0.85));
  PY.add(cx, H + 1.0, cz, w + 2.4, 1.4, d + 2.4, c);
  B.add(cx, H + 1.4, cz, w2, 2.2, d2, wall);
  B.add(cx, H + 2.625, cz, w2 + 2.4, 0.25, d2 + 2.4, shade(c, 0.85));
  PY.add(cx, H + 3.65, cz, w2 + 1.8, 1.8, d2 + 1.8, c);
  SP.add(cx, H + 4.7, cz, 0.6, 0.6, 0.6, 0xf2c14e);
}

function building(cx, cz, w, d, o = {}) {
  buildings.push([cx, cz, w, d]); take(cx, cz, w, d);
  const T = 0.4, FH = 3.4, GAP = Math.min(o.gap || 3.2, Math.min(w, d) - 1.6);
  let H = o.H || 3.2;
  const wc = o.color || pick(WALLS), door = o.door ?? irnd(0, 3), dc = o.doors || [0], sg = [-1, 1, -1, 1][door];
  const nfl = o.floors || 1, plan = nfl > 1 ? planStairs(cx, cz, w, d, door, dc, GAP, nfl, FH) : null;
  if (nfl > 1 && !plan && !o.keepH) H = Math.min(H, FH); // khĂ´ng Ä‘á»§ chá»— lĂ m cáº§u thang â†’ nhĂ  1 táº§ng
  floors.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, y: 0.15 });
  box(cx, cz, w, d, 0.15, 0xd8c9a3, false);
  // khung cá»­a + thá»m + vĂ¹ng trá»‘ng trÆ°á»›c cá»­a (khĂ´ng Ä‘áº·t váº­t cáº£n cháº¯n lá»‘i vĂ o)
  const deco = (horiz, fixed, c) => {
    for (const s of [-1, 1]) horiz ? B.add(c + s * GAP / 2, 1.35, fixed, 0.18, 2.7, T + 0.12, 0x6b3f22) : B.add(fixed, 1.35, c + s * GAP / 2, T + 0.12, 2.7, 0.18, 0x6b3f22);
    horiz ? B.add(c, 0.06, fixed + sg * 0.55, GAP + 0.4, 0.12, 0.7, 0xb8b2a4) : B.add(fixed + sg * 0.55, 0.06, c, 0.7, 0.12, GAP + 0.4, 0xb8b2a4);
    horiz ? take(c, fixed + sg * 2.6, GAP + 3, 5) : take(fixed + sg * 2.6, c, 5, GAP + 3);
  };
  const seg = (horiz, fixed, a, b) => { if (b - a > 0.05) horiz ? box((a + b) / 2, fixed, b - a, T, H, wc, true) : box(fixed, (a + b) / 2, T, b - a, H, wc, true); };
  const run = (horiz, fixed, mid, len, centers) => {
    let a = mid - len / 2;
    for (const g of centers ? [...centers].sort((p, q) => p - q) : []) {
      seg(horiz, fixed, a, mid + g - GAP / 2);
      if (H > 2.8) {
        horiz ? box(mid + g, fixed, GAP, T, H - 2.7, wc, false, 2.7) : box(fixed, mid + g, T, GAP, H - 2.7, wc, false, 2.7);
        if (plan) ups.push(horiz ? { minX: mid + g - GAP / 2, maxX: mid + g + GAP / 2, minZ: fixed - T / 2, maxZ: fixed + T / 2, y0: 2.7, h: H, up: true, kind: 'concrete' } : { minX: fixed - T / 2, maxX: fixed + T / 2, minZ: mid + g - GAP / 2, maxZ: mid + g + GAP / 2, y0: 2.7, h: H, up: true, kind: 'concrete' }); // lanh tĂ´ cá»­a: cháº·n ngÆ°á»i á»Ÿ táº§ng trĂªn chui ra
      }
      deco(horiz, fixed, mid + g);
      a = mid + g + GAP / 2;
    }
    seg(horiz, fixed, a, mid + len / 2);
  };
  run(true, cz - d / 2, cx, w, door === 0 ? dc : null); run(true, cz + d / 2, cx, w, door === 1 ? dc : null);
  run(false, cx - w / 2, cz, d, door === 2 ? dc : null); run(false, cx + w / 2, cz, d, door === 3 ? dc : null);
  // cửa sổ
  const nf = Math.max(1, Math.round(H / 3.3));
  for (let s = 0; s < 4; s++) {
    if (s === door || (o.noSide && s > 1)) continue;
    const len = s < 2 ? w : d, n = Math.max(1, Math.floor(len / 4.5));
    for (let k = 0; k < n; k++) for (let f = 0; f < nf; f++) {
      const off = ((k + 0.5) / n - 0.5) * len, y = f * 3.3 + 1.7;
      if (y > H - 0.6) continue;
      if (s < 2) win(cx + off, y, cz + (s ? d / 2 : -d / 2), s);
      else win(cx + (s === 3 ? w / 2 : -w / 2), y, cz + off, s);
    }
  }
  // mĂ¡i
  const rf = o.roof || 'hip';
  if (rf === 'hip') { const rh = o.rh || clamp(Math.min(w, d) * 0.28, 1.4, 2.6); PY.add(cx, H + rh / 2, cz, w + 1.4, rh, d + 1.4, o.roofColor || pick(ROOFS)); }
  else if (rf === 'temple') templeRoof(cx, cz, w, d, H, o.roofColor || 0xd9a21e, wc);
  else {
    B.add(cx, H + 0.15, cz, w + 0.3, 0.3, d + 0.3, 0x9b9a95);
    if (chance(0.75)) CY.add(cx + rnd(-w / 4, w / 4), H + 1.1, cz + rnd(-d / 4, d / 4), 1.2, 1.6, 1.2, 0xc8d4d8); // bồn nước inox
  }
  if (plan) buildUpper(cx, cz, w, d, plan, FH);
  furnish(cx, cz, w, d, door, o.kind || 'home', dc, plan ? [plan[0]] : null);
}

// ---------- Ná»™i tháº¥t (luĂ´n chá»«a lá»‘i Ä‘i tá»« cá»­a vĂ o giá»¯a nhĂ ) ----------
function furnish(cx, cz, w, d, door, kind, dc, av) {
  const f = [[0, -1], [0, 1], [-1, 0], [1, 0]][door], l = [f[1], f[0]];
  const hf = (door < 2 ? d : w) / 2, hl = (door < 2 ? w : d) / 2, back = -hf + 0.25, s = chance(0.5) ? 1 : -1;
  // a: dá»c theo hÆ°á»›ng cá»­a (Ă¢m = phĂ­a trong cĂ¹ng), b: ngang; sa/sb: kĂ­ch thÆ°á»›c theo a/b
  const it = (a, b, sa, sb, h, c, solid = true, y0 = 0) => {
    const x = cx + f[0] * a + l[0] * b, z = cz + f[1] * a + l[1] * b;
    const bw = door < 2 ? sb : sa, bd = door < 2 ? sa : sb;
    if (av && av.some(r => x - bw / 2 - 0.3 < r.x1 && x + bw / 2 + 0.3 > r.x0 && z - bd / 2 - 0.3 < r.z1 && z + bd / 2 + 0.3 > r.z0)) return; // chừa chỗ cầu thang
    box(x, z, bw, bd, h, c, solid, y0, 'wood');
  };
  const wood = 0x8a6a45;
  switch (kind) {
    case 'home':
      it(back + 0.4, 0, 0.8, 2, 1.1, 0x7a3a22); it(back + 0.4, 0, 0.5, 1.6, 0.12, 0xd9a21e, false, 1.1); // bĂ n thá»
      it(back + 2.1, s * (hl - 0.9), 2, 1.3, 0.55, 0xcfae7a);                                             // giường
      it(back + 2.1, -s * (hl - 1.3), 1, 1, 0.75, wood); it(back + 2.1, -s * (hl - 2.5), 0.4, 0.4, 0.4, 0xd9382c); // bĂ n + gháº¿
      if (hf > 4.6) it(back + 5, -s * (hl - 0.55), 1.6, 0.6, 1.8, 0x6b4a2b);                              // tủ
      break;
    case 'shop':
      it(back + 0.6, 0, 1, Math.min(2 * hl - 1.6, 3.2), 1, 0xb0502d);
      for (let a = back + 2.2; a < hf - 3.4; a += 2.4) for (const q of [-1, 1]) it(a, q * (hl - 0.35), 1.6, 0.5, 2, wood);
      break;
    case 'store':
      for (let a = back + 1.5; a < hf - 4.5; a += 3) for (const q of [-1, 1]) it(a, q * (hl - 1.3), 2, 2, 1.5 + rnd(0, 0.8), pick([0x9a7447, 0x2f6fb3, 0xd98b2b]));
      break;
    case 'temple':
      it(back + 0.9, 0, 1.4, 4, 1.2, 0xa8281e); it(back + 0.9, 0, 1, 3, 0.15, 0xd9a21e, false, 1.2); it(back + 2.2, 0, 0.8, 0.8, 1, 0x8a6a2a);
      break;
    case 'office':
      for (const b of [-4, 0, 4]) if (hl >= 6) it(back + 1.4, b, 0.9, 2, 0.8, wood);
      for (const q of [-1, 1]) it(back + 0.5, q * (hl - 0.5), 0.6, 1, 1.8, 0x7d8790);
      break;
    case 'school':
      for (const g of dc) {
        for (const a of [back + 3.2, back + 5]) for (const q of [-1, 1]) it(a, g + q * 2.6, 0.5, 1.5, 0.75, 0x9a7447);
        it(back + 0.7, g, 0.8, 1.6, 0.9, 0x6b4a2b); it(back + 0.12, g, 0.1, 3.2, 1.4, 0x1f3d2b, false, 0.9);
      }
      break;
    case 'clinic':
      for (const q of [-1, 1]) it(back + 1.1, q * (hl - 1.4), 2, 1.1, 0.6, 0xf5f5f0);
      it(back + 0.6, 0, 0.8, 1.8, 0.8, wood);
      break;
    case 'mill':
      for (const q of [-1, 1]) { it(back + 2.5, q * (hl - 2.8), 4, 3, 2.8, 0x4e7aa0); it(back + 7, q * (hl - 1.2), 1.4, 1.4, 1, 0xd8b44a); }
      break;
    case 'church':
      for (let a = back + 6; a < hf - 4.5; a += 1.7) for (const q of [-1, 1]) it(a, q * 2.3, 0.5, 2.2, 0.9, 0x7a4a2a);
      it(back + 0.8, 0, 1.2, 3, 1.1, 0xf2f2f2);
      break;
  }
}

function townHouse(cx, cz, w, d, n, dir) {
  const H = 3.4 * n, door = dir > 0 ? 1 : 0, zf = cz + dir * d / 2;
  building(cx, cz, w, d, { H, door, gap: 2.4, roof: 'flat', noSide: true, kind: 'shop', floors: n, keepH: true });
  B.add(cx, 3.05, zf + dir * 0.3, Math.min(w - 0.6, 3.4), 0.7, 0.16, pick(SIGNS)); // biển hiệu
  for (let f = 1; f < n; f++) {
    const y = 3.4 * f;
    B.add(cx, y, zf + dir * 0.55, w - 0.4, 0.16, 1.1, 0xcfc9bb);                 // ban cĂ´ng
    B.add(cx, y + 0.55, zf + dir * 1.08, w - 0.4, 0.9, 0.07, 0x3a3a3c);          // lan can
    if (chance(0.7)) SP.add(cx + rnd(-w / 3, w / 3), y + 1.1, zf + dir * 0.95, 0.7, 0.5, 0.5, pick(GREENS)); // cháº­u cĂ¢y
    win(cx - w / 4, y + 1.7, zf, door); win(cx + w / 4, y + 1.7, zf, door);
  }
}

function lamp(x, z) { CY.add(x, 3, z, 0.15, 6, 0.15, 0x444444); B.add(x, 6, z, 0.5, 0.2, 0.5, 0xfff1a0); }

function town() {
  const span = Math.min(64, HALF * 0.3), lo = Math.max(-HALF + 20, RX - span), hi = Math.min(HALF - 20, RX + span);
  for (const s of [-1, 1]) {
    for (let x = lo; x < hi;) {
      const w = rnd(4.4, 6.2), d = rnd(10, 13), cx = x + w / 2; x += w;
      if (Math.abs(cx - RX) < RW / 2 + w / 2 + 3) continue;
      townHouse(cx, RZ + s * (RW / 2 + 3 + d / 2), w, d, irnd(2, 4), -s);
    }
    for (const [a, b] of [[lo, RX - RW / 2 - 1], [RX + RW / 2 + 1, hi]])
      if (b > a) B.add((a + b) / 2, 0.1, RZ + s * (RW / 2 + 1.4), b - a, 0.2, 2.8, 0xb4ada0); // vá»‰a hĂ¨
  }
  for (let i = 0; i < 12; i++) { const x = rnd(lo, hi), z = RZ + (chance(0.5) ? 1 : -1) * (RW / 2 + 1.7); if (Math.abs(x - RX) > RW / 2 + 3 && free(x, z, 2.4, 1.4)) bike(x, z, true); }
  zone('Phố Huyện', RX, RZ, span + 12, 30);
  for (let x = lo + 6; x < hi; x += 18) if (Math.abs(x - RX) > RW / 2 + 4) for (const s of [-1, 1]) lamp(x, RZ + s * (RW / 2 + 0.9));
}

// ---------- Cá» Ä‘á» sao vĂ ng ----------
function flag(x, z, h, ry) {
  CY.add(x, h / 2, z, 0.16, h, 0.16, 0xdddddd);
  const fw = 3, fh = 2, c = Math.cos(ry), s = Math.sin(ry), cy = h - fh / 2 - 0.3, lx = fw / 2 + 0.08;
  B.add(x + lx * c, cy, z - lx * s, fw, fh, 0.05, 0xda251d, ry);
  for (const o of [-0.04, 0.04]) for (let k = 0; k < 5; k++)
    B.add(x + lx * c + o * s, cy, z - lx * s + o * c, 0.9, 0.12, 0.03, 0xffde00, ry, (k * PI) / 5);
}

// ---------- Phương tiện & vật cản ----------
function bike(x, z, ax) {
  const o = { x, z, ax }, c = pick([0xc0392b, 0x2c3e50, 0xf1c40f, 0x27ae60, 0xecf0f1, 0x8e44ad, 0x1f1f1f, 0xe67e22]);
  P(o, 0.65, 0.32, 0, 0.64, 0.14, 0.64, 0x1a1a1a, 1); P(o, -0.65, 0.32, 0, 0.64, 0.14, 0.64, 0x1a1a1a, 1);
  P(o, 0, 0.55, 0, 1.1, 0.38, 0.36, c); P(o, -0.2, 0.8, 0, 0.7, 0.14, 0.34, 0x151515);
  P(o, 0.62, 1.0, 0, 0.12, 0.1, 0.7, 0x222222); P(o, 0.75, 0.8, 0, 0.15, 0.22, 0.3, 0xfff2a0);
  col(x, z, ax ? 1.9 : 0.8, ax ? 0.8 : 1.9, 1.1, 'metal');
}
function truck(x, z, ax) {
  const o = { x, z, ax }, c = pick([0x2f6fb3, 0xc0392b, 0x3a7d44, 0xd98b2b, 0xdddddd]);
  P(o, -0.9, 1.9, 0, 4.6, 2.5, 2.4, c); P(o, 2.1, 1.5, 0, 1.9, 2.0, 2.3, shade(c, 0.8));
  for (const lx of [-1.7, 1.9]) for (const lz of [-1.15, 1.15]) P(o, lx, 0.5, lz, 0.9, 0.3, 0.9, 0x1a1a1a, 1);
  col(x, z, ax ? 6.4 : 2.5, ax ? 2.5 : 6.4, 2.9, 'metal');
}
function buffalo(x, z) {
  const o = { x, z, ax: chance(0.5) };
  P(o, 0, 1.05, 0, 2.0, 0.95, 0.85, 0x4b4b50); P(o, 1.25, 1.15, 0, 0.75, 0.55, 0.5, 0x44444a); P(o, 1.4, 1.55, 0, 0.12, 0.1, 1.1, 0xd9d2bc);
  for (const lx of [-0.7, 0.7]) for (const lz of [-0.28, 0.28]) P(o, lx, 0.4, lz, 0.24, 0.8, 0.24, 0x3c3c40);
  col(x, z, o.ax ? 2.6 : 1.0, o.ax ? 1.0 : 2.6, 1.6, 'flesh');
}
function haystack(x, z) { CY.add(x, 1.1, z, 2, 2.2, 2, 0xd8b44a); CO.add(x, 2.9, z, 2.4, 1.4, 2.4, 0xc99f32); col(x, z, 2, 2, 3.2, 'wood'); }
function crate(x, z) {
  const k = R();
  if (k < 0.3) box(x, z, 2.4, 1.1, 1.2, 0xb0502d, true);                              // chồng gạch
  else if (k < 0.65) { const s = rnd(1, 1.6); box(x, z, s, s, s, 0x9a7447, true, 0, 'wood'); }  // thĂ¹ng gá»—
  else { CY.add(x, 0.45, z, 0.7, 0.9, 0.7, pick([0x2e5fa3, 0xb03a2e, 0x3a7d44])); col(x, z, 0.7, 0.7, 0.9, 'metal'); } // thĂ¹ng phuy
}
function container(x, z) { const a = chance(0.5), l = 6, w = 2.4; box(x, z, a ? l : w, a ? w : l, 2.6, pick([0x2f6fb3, 0xc0392b, 0x3a7d44, 0xd98b2b]), true, 0, 'metal'); }

// ---------- CĂ¢y cá»‘i ----------
function coconut(x, z) {
  const h = rnd(8, 12), a = rnd(-0.14, 0.14), s = Math.sin(a), ty = h * Math.cos(a), tx = x - s * h;
  CY.add(x - (s * h) / 2, ty / 2, z, 0.38, h, 0.38, 0x8a6e4b, 0, a);
  for (let k = 0; k < 7; k++) {
    const f = (k / 7) * 2 * PI + rnd(-0.2, 0.2);
    B.add(tx + Math.cos(f) * 2, ty - 0.3, z + Math.sin(f) * 2, 4.2, 0.12, 0.9, shade(pick(GREENS), 1.1), -f, -0.35);
  }
  for (let k = 0; k < 3; k++) SP.add(tx + rnd(-0.4, 0.4), ty - 0.5, z + rnd(-0.4, 0.4), 0.35, 0.35, 0.35, 0x7a5a2a);
  col(x, z, 0.6, 0.6, h, 'wood');
}
function roundTree(x, z) {
  const h = rnd(2.2, 3.4), r = rnd(2.6, 4);
  CY.add(x, h / 2, z, 0.5, h, 0.5, 0x6b4a2b);
  for (let k = 0; k < 3; k++) { const d = r * 2 * rnd(0.8, 1.1); SP.add(x + rnd(-1.2, 1.2), h + r * 0.5 + rnd(0, 1.2), z + rnd(-1.2, 1.2), d, d * 0.85, d, shade(pick(GREENS), rnd(0.9, 1.1))); }
  col(x, z, 0.8, 0.8, 7, 'wood');
}
function banyan(x, z) {
  CY.add(x, 3, z, 2.2, 6, 2.2, 0x6b5a45);
  for (let k = 0; k < 7; k++) { const a = (k / 7) * 2 * PI, r = k ? rnd(2, 5) : 0, d = rnd(9, 13); SP.add(x + Math.cos(a) * r, rnd(8, 11), z + Math.sin(a) * r, d, d * 0.7, d, shade(0x2f6b34, rnd(0.9, 1.15))); }
  for (let k = 0; k < 8; k++) CY.add(x + rnd(-4, 4), 3.2, z + rnd(-4, 4), 0.15, 6.4, 0.15, 0x6b5a45);
  col(x, z, 2.6, 2.6, 10, 'wood');
}
function bamboo(x, z) {
  for (let k = irnd(7, 12); k > 0; k--) { const h = rnd(7, 11), w = rnd(0.12, 0.2); CY.add(x + rnd(-0.9, 0.9), h / 2, z + rnd(-0.9, 0.9), w, h, w, pick([0x8aa63a, 0x6f9a35, 0xa4b64a])); }
  for (let k = 0; k < 3; k++) SP.add(x + rnd(-1, 1), rnd(7, 10), z + rnd(-1, 1), 2.4, 1.4, 2.4, 0x5c9a32);
  col(x, z, 1.8, 1.8, 9, 'wood');
}
function banana(x, z) {
  CY.add(x, 1.1, z, 0.4, 2.2, 0.4, 0x86a85a);
  for (let k = 0; k < 5; k++) { const f = (k / 5) * 2 * PI + rnd(-0.3, 0.3); B.add(x + Math.cos(f), 2.3, z + Math.sin(f), 2.4, 0.07, 0.9, 0x62b13e, -f, -0.5); }
}
const bush = (x, z) => SP.add(x, 0.5, z, rnd(1.2, 2), 1.1, rnd(1.2, 2), shade(pick(GREENS), 0.9));

// ---------- Äá»‹a hĂ¬nh lá»›n ----------
function paddy(x, z, w, d) {
  take(x, z, w, d); paddies.push([x, z, w, d]);
  flat(x, z, w, d, 0x9b8a5c, 0.03, 0.04);
  const k = R();
  flat(x, z, w - 1.8, d - 1.8, k < 0.2 ? 0x6e9fb0 : 0x7fae4e, 0.05, 0.04);
  if (k >= 0.2) { const rc = k > 0.8 ? 0xd8b84a : 0x5fa23c; for (let q = z - d / 2 + 1.6; q < z + d / 2 - 1.2; q += 1.5) B.add(x, 0.25, q, w - 2.6, 0.4, 0.9, shade(rc, rnd(0.9, 1.1))); }
  if (chance(0.4)) buffalo(x + rnd(-w / 3, w / 3), z + rnd(-d / 3, d / 3));
  zone(nm(NP, 'Äá»“ng LĂºa ' + (ZONES.length % 9 + 1)), x, z, Math.max(w, d) * 0.5, 12);
}
function pond(x, z, r) {
  take(x, z, 2 * r + 4, 2 * r + 4); ponds.push([x, z, r]);
  paintDisc(x, z, r + 1.2, 0x9a8a5e); paintDisc(x, z, r, 0x4f95b5); paintDisc(x - r * 0.15, z - r * 0.15, r * 0.6, 0x5aa3c2);
  for (let i = 0; i < 10; i++) {
    const a = rnd(0, 2 * PI), q = rnd(0, r - 1.2), px = x + Math.cos(a) * q, pz = z + Math.sin(a) * q;
    CY.add(px, 0.1, pz, 1.3, 0.04, 1.3, 0x3d8a3e);
    if (chance(0.5)) SP.add(px, 0.22, pz, 0.35, 0.3, 0.35, 0xf08fb0); // hoa sen
  }
  zone(nm(NO, 'Ao LĂ ng'), x, z, r + 4, 10);
}

// ---------- CĂ´ng trĂ¬nh Ä‘áº·c trÆ°ng ----------
function cho(mx, mz) {
  const W = 40, D = 30; take(mx, mz, W + 4, D + 4);
  flat(mx, mz, W, D, 0xbdb199, 0.03, 0.04);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
    if (chance(0.1)) continue;
    const sx = mx - W / 2 + 5 + (c * (W - 10)) / 4, sz = mz - D / 2 + 6 + (r * (D - 12)) / 2;
    box(sx, sz, 3.6, 1.2, 1.0, 0x8a6a45, true, 0, 'wood');
    PY.add(sx, 3.4, sz, 5, 1.6, 5, pick(TARPS));            // dĂ¹/báº¡t che sáº¡p
    CY.add(sx, 1.4, sz, 0.12, 2.8, 0.12, 0x777777);
    for (let g = 0; g < 4; g++) B.add(sx - 1.3 + g * 0.85, 1.25, sz, 0.5, 0.5, 0.5, pick(TARPS)); // hĂ ng hĂ³a
  }
  for (const s of [-1, 1]) box(mx + s * 5, mz + D / 2, 0.8, 0.8, 5, 0xd9382c, true);
  B.add(mx, 5.3, mz + D / 2, 11, 1.4, 0.4, 0xd9382c); B.add(mx, 5.3, mz + D / 2 + 0.22, 8, 0.5, 0.05, 0xffd23f); // cổng chợ
  zone('Chá»£ QuĂª', mx, mz, 28);
  for (let i = 0; i < 10; i++) { const x = mx + rnd(-W / 2, W / 2), z = mz + D / 2 + rnd(3, 6); if (free(x, z, 2, 2)) bike(x, z, chance(0.5)); }
}

function chua(px, pz) {
  const W = 32, D = 36, gw = 6, l = (W - gw) / 2, wc = 0xe9dcb8;
  take(px, pz, W + 4, D + 4);
  flat(px, pz, W, D, 0xcfc3a4, 0.03, 0.04);
  box(px, pz - D / 2, W, 0.5, 1.5, wc, true); box(px - W / 2, pz, 0.5, D, 1.5, wc, true); box(px + W / 2, pz, 0.5, D, 1.5, wc, true);
  box(px - gw / 2 - l / 2, pz + D / 2, l, 0.5, 1.5, wc, true); box(px + gw / 2 + l / 2, pz + D / 2, l, 0.5, 1.5, wc, true);
  for (const s of [-1, 1]) box(px + s * (gw / 2 + 0.5), pz + D / 2, 1, 1, 5.5, 0xd9a21e, true); // cổng tam quan
  B.add(px, 5, pz + D / 2, gw + 2, 0.9, 1, 0xa8281e); PY.add(px, 6.6, pz + D / 2, gw + 4, 1.8, 3.6, 0xd9a21e);
  const hz = pz - D / 2 + 9; // chĂ­nh Ä‘iá»‡n
  building(px, hz, 14, 10, { H: 4.6, color: 0xe8c25a, door: 1, gap: 3.6, roof: 'temple', kind: 'temple' });
  for (const x of [-6, -3.5, 3.5, 6]) { CY.add(px + x, 2.3, hz + 6.3, 0.55, 4.6, 0.55, 0xa8281e); col(px + x, hz + 6.3, 0.6, 0.6, 4.6, 'wood'); }
  for (let x = -5; x <= 5; x += 2) SP.add(px + x, 3.8, hz + 6.6, 0.5, 0.7, 0.5, 0xd8281e);        // Ä‘Ă¨n lá»“ng
  CY.add(px, 0.75, pz + 3, 1.3, 1.5, 1.3, 0x8a6a2a); col(px, pz + 3, 1.4, 1.4, 1.5);               // lư hương
  const tx = px + 9, tz = pz + 2;                                                                    // thĂ¡p
  for (let i = 0; i < 5; i++) {
    const w = 3.6 - i * 0.4, y0 = 0.6 + i * 2.7;
    B.add(tx, y0 + 1, tz, w, 2, w, 0xe8c25a); B.add(tx, y0 + 2.125, tz, w + 1.6, 0.25, w + 1.6, 0xd9a21e); PY.add(tx, y0 + 2.75, tz, w + 1.2, 1, w + 1.2, 0xd9a21e);
  }
  B.add(tx, 0.3, tz, 4.6, 0.6, 4.6, 0xcfc3a4); SP.add(tx, 14.4, tz, 0.7, 0.9, 0.7, 0xf2c14e); col(tx, tz, 4, 4, 14);
  for (let i = 0; i < 4; i++) { // cĂ¢y hoa sá»© trong sĂ¢n
    const x = px + (i % 2 ? 9 : -10) + rnd(-1, 1), z = pz + (i < 2 ? 8 : -3) + rnd(-1, 1);
    if (Math.hypot(x - tx, z - tz) < 4) continue;
    CY.add(x, 1.2, z, 0.35, 2.4, 0.35, 0x7a6a5a); SP.add(x, 3.2, z, 3, 2.2, 3, 0x6fa04a); SP.add(x + 0.4, 3.9, z, 1.6, 1.2, 1.6, 0xf4eacc); col(x, z, 0.5, 0.5, 3, 'wood');
  }
  banyan(px - W / 2 - 8, pz + 4);
  zone('ChĂ¹a Linh Quang', px, pz, 26);
}

function dinh(px, pz) {
  take(px, pz, 28, 28);
  flat(px, pz, 26, 26, 0xc2b698, 0.03, 0.04);
  building(px, pz, 16, 11, { H: 4.2, color: 0x8a5a35, roofColor: 0x8c3b2a, door: 1, gap: 4, roof: 'temple', kind: 'temple' });
  for (const x of [-6.5, 6.5]) { CY.add(px + x, 2.1, pz + 6.6, 0.55, 4.2, 0.55, 0x7a2a1e); col(px + x, pz + 6.6, 0.6, 0.6, 4.2, 'wood'); }
  for (const s of [-1, 1]) box(px + s * 3.5, pz + 9, 1.2, 1.4, 1.2, 0x9a9a95, true); // tÆ°á»£ng Ä‘Ă¡
  banyan(px + 17, pz - 5);
  zone(nm(ND, 'ÄĂ¬nh LĂ ng'), px, pz, 18);
}

function ubnd(cx, cz) { // trá»¥ sá»Ÿ xĂ£/phÆ°á»ng cĂ³ cá»™t cá» lá»›n
  take(cx, cz, 30, 26);
  flat(cx, cz + 2, 30, 24, 0xcfc6aa, 0.03, 0.04);
  building(cx, cz - 4, 22, 10, { H: 6.8, floors: 2, color: 0xf0d27a, gap: 4.5, door: 1, rh: 2.4, roofColor: 0xb5472c, kind: 'office' });
  flag(cx + 12, cz + 8, 14, 0);
  for (let i = 0; i < 4; i++) bike(cx - 10 + i * 2.2, cz + 8, false);
  zone('Trung TĂ¢m XĂ£ TĂ¢n PhĂº', cx, cz, 20);
}

function house(cx, cz, w, d) {
  const door = irnd(0, 3);
  building(cx, cz, w, d, w >= 7.4 && chance(0.55) ? { door, H: 6.8, floors: 2, rh: 2.6 } : { door }); // 55% nhĂ  2 táº§ng cĂ³ cáº§u thang
  const f = [[0, -1], [0, 1], [-1, 0], [1, 0]][door], l = [f[1], f[0]], ex = door < 2 ? d / 2 : w / 2;
  const sg = chance(0.5) ? 1 : -1, L = 1.6 + 2.4 + rnd(0, 1.5); // lá»‡ch háº³n ra khá»i lá»‘i vĂ o
  const px = cx + f[0] * (ex + 2.6) + l[0] * sg * L, pz = cz + f[1] * (ex + 2.6) + l[1] * sg * L;
  if (chance(0.65) && free(px, pz, 2, 2)) { take(px, pz, 2.4, 2.4); bike(px, pz, l[0] !== 0); }
  if (chance(0.5)) { const bx = cx - f[0] * (ex + 3) + rnd(-2, 2), bz = cz - f[1] * (ex + 3) + rnd(-2, 2); take(bx, bz, 2, 2); banana(bx, bz); }
  const hx = cx - f[0] * (ex + 4) + l[0] * sg * 5, hz = cz - f[1] * (ex + 4) + l[1] * sg * 5;
  if (chance(0.3) && free(hx, hz, 3, 3)) { take(hx, hz, 3, 3); haystack(hx, hz); }
  const fx = cx + f[0] * (ex + 2.6) - l[0] * sg * L, fz = cz + f[1] * (ex + 2.6) - l[1] * sg * L;
  if (chance(0.15) && free(fx, fz, 1, 1)) { take(fx, fz, 1, 1); flag(fx, fz, 7, rnd(0, 2 * PI)); }
}


// ---------- CĂ´ng trĂ¬nh bá»• sung (Ä‘á»u vĂ o Ä‘Æ°á»£c) ----------
function school(px, pz) {
  take(px, pz, 40, 34); flat(px, pz, 38, 32, 0xc9c2ae, 0.03, 0.04);
  building(px, pz - 8, 30, 9, { H: 6.8, floors: 2, color: 0xf3e08c, door: 1, doors: [-9, 0, 9], gap: 3, rh: 2.4, roofColor: 0xb5472c, kind: 'school' });
  flat(px - 8, pz + 8, 15, 9, 0x3a7d5a, 0.05, 0.04); flat(px - 8, pz + 8, 0.2, 9, 0xeeeeee, 0.08, 0.03); // sĂ¢n bĂ³ng rá»•
  for (const s of [-1, 1]) { CY.add(px - 8 + s * 7, 1.6, pz + 8, 0.2, 3.2, 0.2, 0x555555); B.add(px - 8 + s * 6.6, 3.1, pz + 8, 0.1, 1, 1.4, 0xffffff); col(px - 8 + s * 7, pz + 8, 0.4, 0.4, 3.2, 'metal'); }
  flag(px + 10, pz + 12, 11, 0);
  zone('TrÆ°á»ng Tiá»ƒu Há»c TĂ¢n PhĂº', px, pz, 24);
}
function clinic(px, pz) {
  take(px, pz, 24, 20); flat(px, pz, 22, 18, 0xcfc6aa, 0.03, 0.04);
  building(px, pz - 3, 12, 8, { H: 3.4, color: 0xf5f5f0, roofColor: 0x3f6f8a, door: 1, gap: 3.2, kind: 'clinic' });
  CY.add(px + 8, 1.8, pz + 6, 0.2, 3.6, 0.2, 0x555555); B.add(px + 8, 3.6, pz + 6, 1.8, 0.5, 0.15, 0x2e9e4f); B.add(px + 8, 3.6, pz + 6, 0.5, 1.8, 0.15, 0x2e9e4f); // chữ thập xanh
  bike(px - 8, pz + 6, true);
  zone('Trạm Y Tế', px, pz, 16);
}
function mill(px, pz) {
  take(px, pz, 38, 28); flat(px, pz, 36, 26, 0xb4ada0, 0.03, 0.04);
  building(px - 4, pz, 20, 13, { H: 6, color: 0xb9c0c4, roofColor: 0x7a8a94, rh: 2.8, door: 1, gap: 5, kind: 'mill' });
  for (let i = 0; i < 3; i++) { const x = px + 12, z = pz - 8 + i * 6; CY.add(x, 5.5, z, 4.5, 11, 4.5, 0xd6dadc); CO.add(x, 12.2, z, 4.8, 2.4, 4.8, 0x9aa5ab); col(x, z, 4.5, 4.5, 11, 'metal'); } // silo
  CY.add(px - 18, 7, pz - 8, 1.4, 14, 1.4, 0xb0502d); col(px - 18, pz - 8, 1.4, 1.4, 14);                                                          // á»‘ng khĂ³i
  for (let i = 0; i < 4; i++) crate(px + 10 + rnd(-3, 3), pz + 10 + rnd(-2, 2));
  zone('NhĂ  MĂ¡y Xay XĂ¡t', px, pz, 22);
}
function church(px, pz) {
  take(px, pz, 30, 36); flat(px, pz, 28, 34, 0xc9c2ae, 0.03, 0.04);
  building(px, pz - 3, 11, 22, { H: 7, color: 0xf2ece0, roofColor: 0x8c3b2a, rh: 5, door: 1, gap: 3.6, kind: 'church' });
  const tx = px - 6.2, tz = pz + 10.5; // thĂ¡p chuĂ´ng
  box(tx, tz, 4.4, 4.4, 16, 0xf2ece0, true); PY.add(tx, 19.5, tz, 5.2, 7, 5.2, 0x3f6f8a);
  B.add(tx, 24, tz, 0.25, 1.8, 0.25, 0xffd23f); B.add(tx, 24.3, tz, 1.1, 0.25, 0.25, 0xffd23f);
  box(px + 9, pz + 6, 3, 3, 1.2, 0x9a9a95, true); box(px + 9, pz + 6, 2, 2, 2.2, 0x8a8a85, true); // hang Ä‘Ă¡
  zone('NhĂ  Thá» GiĂ¡o Xá»©', px, pz, 20);
}
function rong(px, pz) {
  take(px, pz, 26, 26); flat(px, pz, 24, 24, 0xb8a57a, 0.03, 0.04);
  building(px, pz, 10, 8, { H: 3.6, color: 0x8a5a35, roofColor: 0xc9a24a, rh: 9, door: 1, gap: 3.4, kind: 'temple' });
  CY.add(px + 8, 5, pz + 8, 0.4, 10, 0.4, 0x7a4a2a); col(px + 8, pz + 8, 0.6, 0.6, 10, 'wood'); B.add(px + 8.9, 9, pz + 8, 1.6, 0.8, 0.05, 0xd9382c);
  zone('NhĂ  RĂ´ng VÄƒn HĂ³a', px, pz, 16);
}
function kiln(px, pz) {
  take(px, pz, 24, 24); paintDisc(px, pz, 11, 0xb59a6a);
  CY.add(px, 7, pz, 5, 14, 5, 0xa5472c); for (let i = 0; i < 3; i++) CY.add(px, 3 + i * 4, pz, 5.4, 0.4, 5.4, 0x5a2a1a);
  col(px, pz, 5, 5, 14); box(px + 9, pz, 8, 4, 3, 0x9c4a2c, true); box(px - 9, pz, 8, 4, 3, 0x9c4a2c, true);
  for (let i = 0; i < 7; i++) box(px + rnd(-9, 9), pz + rnd(5, 9), 2.4, 1.1, 1.2, 0xb0502d, true);
  zone('LĂ² Gáº¡ch CÅ©', px, pz, 14, 22);
}
function wtower(px, pz) {
  take(px, pz, 12, 12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { CY.add(px + sx * 2.2, 7, pz + sz * 2.2, 0.6, 14, 0.6, 0x777777); col(px + sx * 2.2, pz + sz * 2.2, 0.7, 0.7, 14, 'metal'); }
  CY.add(px, 16, pz, 6, 4, 6, 0xc8d4d8); CO.add(px, 18.8, pz, 6.4, 1.6, 6.4, 0x9aa5ab);
  zone('ThĂ¡p NÆ°á»›c', px, pz, 10, 28);
}
function cafe(px, pz) {
  take(px, pz, 26, 22); flat(px, pz, 24, 20, 0xbdb199, 0.03, 0.04);
  building(px, pz - 7, 9, 5, { H: 3, color: 0x9fd3c7, door: 1, gap: 2.8, kind: 'shop' });
  for (let i = 0; i < 6; i++) {
    const x = px - 8 + (i % 3) * 8, z = pz + 3 + (i < 3 ? 0 : 6);
    CY.add(x, 0.375, z, 1.2, 0.75, 1.2, 0x8a6a45); col(x, z, 1.2, 1.2, 0.75, 'wood');
    CY.add(x, 1.5, z, 0.1, 3, 0.1, 0x777777); PY.add(x, 3.4, z, 3.6, 1.2, 3.6, pick(TARPS));
    for (let k = 0; k < 3; k++) { const a = (k / 3) * 2 * PI, sx = x + Math.cos(a) * 1.1, sz = z + Math.sin(a) * 1.1; CY.add(sx, 0.22, sz, 0.45, 0.45, 0.45, pick(TARPS)); col(sx, sz, 0.45, 0.45, 0.45, 'wood'); }
  }
  for (const z of [pz + 2.2, pz + 5.8]) { CY.add(px + 10, 0.8, z, 0.2, 1.6, 0.2, 0x7a4a2a); col(px + 10, z, 0.3, 0.3, 1.6, 'wood'); }
  B.add(px + 10, 1, pz + 4, 0.9, 0.1, 3.4, 0xe8a87c); // vĂµng
  zone('QuĂ¡n CĂ  PhĂª VĂµng', px, pz, 15, 18);
}
function gas() { // cĂ¢y xÄƒng sĂ¡t Ä‘Æ°á»ng chĂ­nh
  for (let t = 0; t < 40; t++) {
    const s = chance(0.5) ? 1 : -1, x = rnd(-HALF + 30, HALF - 30);
    if (Math.abs(x - RX) < 110) continue;
    const zc = RZ + s * (RW / 2 + 6), zs = zc + s * 9;
    if (hit(x, zc + s * 4, 22, 16, 1)) continue;
    take(x, zc + s * 4, 22, 16);
    flat(x, RZ + s * (RW / 2 + 5.5), 20, 11, 0x8d8d90, 0.06, 0.04);
    B.add(x, 5.4, zc, 14, 0.5, 8, 0xd9382c); B.add(x, 5.1, zc, 14.2, 0.2, 8.2, 0xffffff);
    for (const px of [-5.5, 5.5]) for (const pz of [-2.5, 2.5]) { CY.add(x + px, 2.6, zc + pz, 0.5, 5.2, 0.5, 0xdddddd); col(x + px, zc + pz, 0.5, 0.5, 5.2, 'metal'); }
    for (const px of [-2.2, 2.2]) box(x + px, zc, 0.7, 1, 1.5, 0x2f7fc1, true, 0, 'metal');
    building(x, zs, 10, 5, { H: 3.2, color: 0xf0efe8, roofColor: 0xd9382c, door: s > 0 ? 0 : 1, gap: 3, kind: 'shop' });
    zone('CĂ¢y XÄƒng 24h', x, zc + s * 4, 14, 14);
    return;
  }
}

// ---------- Hạ tầng ----------
function poles() {
  const lo = Math.min(64, HALF * 0.3) + 6, gap = 30;
  let a = null, b = null;
  for (let t = -HALF + 12; t < HALF - 12; t += gap) {
    if (Math.abs(t - RX) > lo) {
      const z = RZ - RW / 2 - 1.2;
      CY.add(t, 4, z, 0.22, 8, 0.22, 0x6f6f6f); B.add(t, 7.6, z, 0.15, 0.15, 2.4, 0x555555); col(t, z, 0.4, 0.4, 8, 'wood');
      if (a !== null) B.add(t - gap / 2, 7.6, z, gap, 0.05, 0.05, 0x222222);
      a = t;
    } else a = null;
    if (Math.abs(t - RZ) > 24) {
      const x = RX + RW / 2 + 1.2;
      CY.add(x, 4, t, 0.22, 8, 0.22, 0x6f6f6f); B.add(x, 7.6, t, 2.4, 0.15, 0.15, 0x555555); col(x, t, 0.4, 0.4, 8, 'wood');
      if (b !== null) B.add(x, 7.6, t - gap / 2, 0.05, 0.05, gap, 0x222222);
      b = t;
    } else b = null;
  }
}

function mountains() {
  const N = 13, span = HALF * 2 + 160;
  for (const [far, c] of [[40, 0x4f7f5c], [120, 0x6f93a3]])
    for (let s = 0; s < 4; s++) for (let i = 0; i < N; i++) {
      const t = -span / 2 + ((i + rnd(0.1, 0.9)) * span) / N, off = HALF + far + rnd(0, 40), base = rnd(70, 140), h = rnd(30, 80) * (far > 100 ? 1.5 : 1);
      CO.add(s < 2 ? t : s === 2 ? -off : off, h / 2, s < 2 ? (s ? off : -off) : t, base, h, base, shade(c, rnd(0.85, 1.1)));
    }
}

// ---------- CĂ¢y thĂ´ng & Ä‘Ă¡ (cáº£nh Ä‘á»“i) ----------
function pine(x, z) {
  const h = rnd(9, 15), r = rnd(2.2, 3.2), c = pick([0x2f6b3a, 0x3a7a42, 0x285c34]);
  CY.add(x, h * 0.2, z, 0.5, h * 0.4, 0.5, 0x5a3f28);
  for (let k = 0; k < 4; k++) { const t = k / 4, rr = r * (1 - t * 0.65), hh = h * 0.34; CO.add(x, h * 0.25 + k * h * 0.19 + hh / 2, z, rr * 2, hh, rr * 2, shade(c, 1 + t * 0.15)); }
  col(x, z, 0.8, 0.8, h, 'wood');
}
function rock(x, z) {
  const s = rnd(1.2, 3);
  SP.add(x, s * 0.3, z, s * 1.3, s * 0.8, s * 1.1, shade(pick([0x8d8d86, 0x7d7d78, 0x9a968b]), rnd(0.9, 1.1)), rnd(0, PI));
  col(x, z, s * 1.0, s * 0.9, s * 0.6);
}

// ---------- Sinh bản đồ ----------
/** Dá»±ng báº£n Ä‘á»“ tá»« `seed` (sá»‘ nguyĂªn). CĂ¹ng seed -> cĂ¹ng báº£n Ä‘á»“. Tráº£ vá» seed Ä‘Ă£ dĂ¹ng. KhĂ´ng truyá»n seed = ngáº«u nhiĂªn (chÆ¡i offline). */
export function buildMap(seed = (Math.random() * 4294967296) >>> 0) {
  seed = seed >>> 0; R = mulberry32(seed);
  let box1, py;
  if (T) { box1 = new T.BoxGeometry(1, 1, 1); py = new T.ConeGeometry(Math.SQRT1_2, 1, 4); py.rotateY(PI / 4); } // chĂ³p vuĂ´ng, cáº¡nh Ä‘Ă¡y = 1
  B = mk(box1); CY = mk(T && new T.CylinderGeometry(0.5, 0.5, 1, 10)); CO = mk(T && new T.ConeGeometry(0.5, 1, 8));
  PY = mk(py); SP = mk(T && new T.IcosahedronGeometry(0.5, 1)); GR = mk(T && new T.ConeGeometry(0.5, 1, 4, 1, true));
  taken.length = 0; ponds.length = 0; vill.length = 0; paddies.length = 0; labels.length = 0; ZONES.length = 0;
  ups.length = 0; floors.length = 0; ramps.length = 0; TH = null; gridN = -1;
  SEED = seed % 1000000; initGround();
  NV = ['LĂ ng Cá»• Má»™c', 'ThĂ´n Äá»“ng TĂ¢m', 'LĂ ng MĂ­a', 'XĂ³m CĂ¢y Äa', 'ThĂ´n Báº¿n ÄĂ²', 'LĂ ng Gá»‘m', 'XĂ³m Ráº¡ch Tre', 'ThĂ´n HĂ²a BĂ¬nh', 'LĂ ng Hoa Sen', 'ThĂ´n PhĂº Lá»™c', 'XĂ³m Dá»«a', 'LĂ ng Nghá»', 'ThĂ´n Cáº§u NgĂ³i', 'XĂ³m Tráº¡i'];
  NP = ['Äá»“ng ChiĂªm', 'CĂ¡nh Äá»“ng VĂ ng', 'Äá»“ng Cáº£', 'Äá»“ng Sau', 'Äá»“ng LĂºa Xanh', 'Äá»“ng TrÅ©ng', 'Äá»“ng CĂ²', 'Äá»“ng BĂ£i'];
  NO = ['Ao Sen', 'Ao LĂ ng', 'Há»“ Sen', 'Ao CĂ¡', 'Äáº§m Sen', 'Ao ChuĂ´m'];
  ND = ['ÄĂ¬nh LĂ ng', 'ÄĂ¬nh LĂ ng Háº¡', 'ÄĂ¬nh Cáº£'];

  const U = (HALF * 2) ** 2 / 40000, cap = (n, hi) => Math.min(hi, Math.round(n));
  RZ = rnd(-HALF * 0.18, HALF * 0.18); RX = rnd(-HALF * 0.18, HALF * 0.18);
  B.add(0, -14.5, 0, HALF * 2 + 2800, 11, HALF * 2 + 2800, 0x4a7a3c); // ná»n Ä‘Ă¡y (chá»‰ lá»™ ra ráº¥t xa)

  // 1. ÄÆ°á»ng: 2 trá»¥c nhá»±a + 2 Ä‘Æ°á»ng Ä‘áº¥t
  road(true, RZ, RW, 0x45464a, true); road(false, RX, RW, 0x45464a, true);
  road(true, RZ + (RZ > 0 ? -1 : 1) * HALF * 0.55, 4, 0xb59a6a); road(false, RX + (RX > 0 ? -1 : 1) * HALF * 0.55, 4, 0xb59a6a);

  // 2. Phá»‘ nhĂ  á»‘ng + cĂ¡c cĂ´ng trĂ¬nh lá»›n
  town();
  for (const [fn, w, d, m] of [[chua, 40, 44, 6], [cho, 46, 36, 5], [ubnd, 30, 26, 5], [school, 42, 36, 4], [church, 30, 36, 4], [mill, 40, 30, 4], [clinic, 26, 22, 4], [rong, 28, 28, 4], [kiln, 26, 26, 4], [cafe, 28, 24, 4], [wtower, 14, 14, 3]]) { const p = spot(w, d, m); if (p) fn(p[0], p[1]); }
  for (let i = cap(1 + U / 6, 3); i > 0; i--) { const p = spot(30, 28, 5); if (p) dinh(p[0], p[1]); }

  gas();

  // 3. Ruá»™ng lĂºa, ao sen
  for (let i = cap(2 + U * 1.2, 18); i > 0; i--) {
    let w = rnd(40, 70), d = rnd(30, 50); if (chance(0.5)) [w, d] = [d, w];
    const p = spot(w, d, 2); if (p) paddy(p[0], p[1], w, d);
  }
  for (let i = cap(1 + U * 0.6, 8); i > 0; i--) { const r = rnd(7, 13), p = spot(2 * r + 4, 2 * r + 4, 2); if (p) pond(p[0], p[1], r); }

  // 4. LĂ ng quĂª (nhĂ  cáº¥p 4 / nhĂ  2 táº§ng) + nhĂ  láº» + nhĂ  kho + container
  for (let i = cap(2 + U * 0.9, 14); i > 0; i--) {
    const c = spot(56, 56, 3); if (!c) continue;
    vill.push(c); zone(nm(NV, 'LĂ ng QuĂª'), c[0], c[1], 40, 20);
    paintDisc(c[0], c[1], 28, 0xb3a070); paintDisc(c[0] + 8, c[1] - 6, 20, 0xbfae7e);
    for (let j = irnd(6, 10); j > 0; j--) for (let t = 0; t < 20; t++) {
      const w = rnd(7, 11), d = rnd(6, 9), x = c[0] + rnd(-26, 26), z = c[1] + rnd(-26, 26);
      if (Math.abs(x) > HALF - 14 || Math.abs(z) > HALF - 14) continue;
      if (!hit(x, z, w + 11, d + 11, 1)) { house(x, z, w, d); break; }
    }
    take(c[0], c[1], 40, 40);
  }
  for (let i = cap(U * 3, 40); i > 0; i--) { const w = rnd(7, 11), d = rnd(6, 9), p = spot(w + 11, d + 11, 2); if (p) house(p[0], p[1], w, d); }
  for (let i = cap(U * 0.8, 10); i > 0; i--) { const p = spot(24, 18, 2); if (p) building(p[0], p[1], rnd(14, 19), rnd(10, 13), { H: 4.2, color: 0xd9d4c4, gap: 4.5, rh: 2, roofColor: 0x6f8794, kind: 'store' }); }
  for (let i = cap(3 + U * 0.8, 14); i > 0; i--) { const p = spot(8, 8, 2); if (p) { take(p[0], p[1], 8, 8); container(p[0], p[1]); } }

  freezeTerrain(); // tá»« Ä‘Ă¢y gy(x,z) cĂ³ giĂ¡ trá»‹: má»i thá»© thĂªm sau tá»± bĂ¡m Ä‘á»‹a hĂ¬nh

  // 5. Thá»±c váº­t (táº­p trung quanh lĂ ng; thĂ´ng + cĂ¢y trĂªn Ä‘á»“i)
  const plant = (n, fn, s, m, near, ok) => {
    for (let i = 0; i < n; i++) {
      let x, z;
      if (near && vill.length && chance(0.65)) { const c = pick(vill); x = c[0] + rnd(-34, 34); z = c[1] + rnd(-34, 34); }
      else { x = rnd(-HALF + 3, HALF - 3); z = rnd(-HALF + 3, HALF - 3); }
      if (Math.abs(x) < HALF - 3 && Math.abs(z) < HALF - 3 && !hit(x, z, s, s, m) && (!ok || ok(x, z))) fn(x, z);
    }
  };
  const gentle = (x, z) => slopeAt(x, z) < 0.35, hillOk = (x, z) => gy(x, z) > 2.5;
  plant(cap(22 * U, 420), coconut, 1.5, 1.5, true, gentle);
  plant(cap(14 * U, 220), bamboo, 2.5, 1.5, true, gentle);
  plant(cap(20 * U, 260), banana, 1.5, 1, true, gentle);
  plant(cap(30 * U, 420), roundTree, 3, 1.5, false);
  plant(cap(18 * U, 320), pine, 3.5, 1.5, false, hillOk);
  plant(cap(40 * U, 500), bush, 1.5, 1, false);
  plant(cap(1 + U * 0.3, 6), banyan, 8, 2, false, gentle);

  // 6. Váº­t cáº£n/cover: xe mĂ¡y dá»c Ä‘Æ°á»ng, xe táº£i, kho váº­t liá»‡u
  for (let i = cap(10 * U, 120); i > 0; i--) {
    const h = chance(0.5), t = rnd(-HALF + 8, HALF - 8), s = chance(0.5) ? 1 : -1;
    const bx = h ? t : RX + s * (RW / 2 + 1), bz = h ? RZ + s * (RW / 2 + 1) : t;
    if ((h ? Math.abs(t - RX) > RW : Math.abs(t - RZ) > 24) && free(bx, bz, 2.4, 2.4)) bike(bx, bz, h);
  }
  for (let i = cap(2 + U * 0.4, 8); i > 0; i--) {
    const h = chance(0.5), t = rnd(-HALF + 20, HALF - 20), s = chance(0.5) ? 1 : -1;
    if (h ? Math.abs(t - RX) > 70 : Math.abs(t - RZ) > 30) truck(h ? t : RX + s * (RW / 2 - 1.7), h ? RZ + s * (RW / 2 - 1.7) : t, h);
  }
  plant(cap(14 * U, 160), (x, z) => (chance(0.4) ? haystack(x, z) : crate(x, z)), 3, 2, false, (x, z) => slopeAt(x, z) < 0.12);

  poles(); mountains();

  // 7. ÄĂ¡ trĂªn sÆ°á»n dá»‘c + cá» tuft (cáº£nh quan)
  for (let t = 0, n = 0, want = cap(10 * U, 90); t < 4000 && n < want; t++) {
    const x = rnd(-HALF + 4, HALF - 4), z = rnd(-HALF + 4, HALF - 4);
    if (hit(x, z, 3, 3, 1) || slopeAt(x, z) < 0.22) continue;
    rock(x, z); n++;
  }
  const tuft = [0x7aa24a, 0x8fae52, 0xa3a85a, 0xb9b363, 0x6d9a45];
  for (let i = cap(350 * U, 6000); i > 0; i--) {
    const x = rnd(-HALF + 3, HALF - 3), z = rnd(-HALF + 3, HALF - 3);
    if (hit(x, z, 0.5, 0.5, 1.2) || slopeAt(x, z) > 0.5) continue;
    const c = shade(pick(tuft), rnd(0.85, 1.1));
    for (let k = 0; k < 3; k++) { const s = rnd(0.7, 1.5); GR.add(x + rnd(-0.5, 0.5), 0.35 * s, z + rnd(-0.5, 0.5), 0.5 * s, 0.75 * s, 0.5 * s, c, rnd(0, PI), rnd(-0.3, 0.3), rnd(-0.3, 0.3)); }
  }

  [B, CY, CO, PY, SP, GR].forEach(b => b.build());
  terrainMesh();
  labels.forEach(a => label(...a));
  R = Math.random;       // dá»±ng xong: cĂ¡c hĂ m cháº¡y lĂºc chÆ¡i (freePos...) dĂ¹ng ngáº«u nhiĂªn thÆ°á»ng
  return seed;
}

// ---------- NhĂ£n khu vá»±c (trong tháº¿ giá»›i + HUD) ----------
function label(name, x, y, z) {
  if (!T || typeof document === 'undefined') return;
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(name, 256, 48); g.fillStyle = '#fff6d0'; g.fillText(name, 256, 48);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
  sp.position.set(x, y + gy(x, z), z); sp.scale.set(34, 6.4, 1); S.G.add(sp);
}

/** TĂªn khu vá»±c táº¡i (x,z): khu nhá» nháº¥t chá»©a Ä‘iá»ƒm Ä‘Ă³. */
export function zoneAt(x, z) {
  let best = null;
  for (const q of ZONES) if (Math.hypot(x - q.x, z - q.z) < q.r && (!best || q.r < best.r)) best = q;
  return best ? best.name : 'VĂ¹ng Ngoáº¡i Ă”';
}

let hud = null, lastZone = '';
/** Gá»i má»—i frame vá»›i vá»‹ trĂ­ ngÆ°á»i chÆ¡i: hiá»‡n tĂªn khu vá»±c khi bÆ°á»›c vĂ o. */
export function updateZoneHud(x, z) {
  const n = zoneAt(x, z);
  if (n === lastZone || typeof document === 'undefined') return;
  lastZone = n;
  if (!hud) {
    hud = document.createElement('div');
    hud.style.cssText = 'position:fixed;top:48px;left:50%;transform:translateX(-50%);color:#fff;font:600 20px sans-serif;text-shadow:0 2px 6px #000;pointer-events:none;transition:opacity .6s;z-index:5';
    document.body.appendChild(hud);
  }
  hud.textContent = 'đŸ“ ' + n; hud.style.opacity = 1;
  clearTimeout(hud._t); hud._t = setTimeout(() => { hud.style.opacity = 0.5; }, 3500);
}

// ---------- Va cháº¡m (lÆ°á»›i khĂ´ng gian â†’ nhanh dĂ¹ cĂ³ hĂ ng nghĂ¬n há»™p) ----------
const CELL = 12, cells = new Map();
let gridN = -1;
const key = (gx, gz) => (gx + 2048) * 4096 + gz + 2048;
function buildGrid() {
  cells.clear(); gridN = colliders.length + ups.length;
  for (const c of colliders.concat(ups))
    for (let gx = Math.floor(c.minX / CELL); gx <= Math.floor(c.maxX / CELL); gx++)
      for (let gz = Math.floor(c.minZ / CELL); gz <= Math.floor(c.maxZ / CELL); gz++) {
        const k = key(gx, gz); let a = cells.get(k);
        if (!a) cells.set(k, (a = []));
        a.push(c);
      }
}

/**
 * Va cháº¡m táº¡i (x,z) bĂ¡n kĂ­nh r.
 * - KhĂ´ng truyá»n y: hĂ nh vi cÅ© (má»i há»™p tĂ­nh tá»« máº·t Ä‘áº¥t lĂªn h).
 * - Truyá»n y (cao Ä‘á»™ chĂ¢n) [+ ph = chiá»u cao ngÆ°á»i]: há»™p tháº¥p hÆ¡n chĂ¢n + STEP Ä‘Æ°á»£c bÆ°á»›c qua, sĂ n/lan can/báº­c táº§ng trĂªn chá»‰ cháº¯n Ä‘Ăºng Ä‘á»™ cao.
 */
export function collidesAt(x, z, r, y, ph = 1.7) {
  if (gridN !== colliders.length + ups.length) buildGrid();
  const v = y !== undefined && y !== null;
  for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++)
    for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++) {
      const a = cells.get(key(gx, gz));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const c = a[i];
        if (c.up) { if (!v || c.h <= y + STEP || c.y0 >= y + ph) continue; }
        else if (v && c.h <= y + STEP) continue;
        const dx = x - clamp(x, c.minX, c.maxX), dz = z - clamp(z, c.minZ, c.maxZ);
        if (dx * dx + dz * dz < r * r) return true;
      }
    }
  return false;
}

/**
 * Cao Ä‘á»™ máº·t Ä‘á»©ng Ä‘Æ°á»£c táº¡i (x,z): Ä‘á»‹a hĂ¬nh, sĂ n nhĂ , máº·t dá»‘c cáº§u thang.
 * Truyá»n y (cao Ä‘á»™ chĂ¢n hiá»‡n táº¡i) Ä‘á»ƒ chá»n Ä‘Ăºng táº§ng: láº¥y máº·t cao nháº¥t khĂ´ng vÆ°á»£t quĂ¡ y + STEP. KhĂ´ng truyá»n y â†’ chá»‰ Ä‘á»‹a hĂ¬nh.
 */
export function groundAt(x, z, y) {
  let best = gy(x, z);
  if (y === undefined || y === null) return best;
  const lim = y + STEP;
  for (const f of floors) if (f.y <= lim && f.y > best && x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) best = f.y;
  for (const r of ramps) {
    if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
    const ax = r.ax === 'x', a = ax ? x : z, lo = ax ? r.x0 : r.z0, hi = ax ? r.x1 : r.z1;
    const t = clamp(r.dir > 0 ? (a - lo) / (hi - lo) : (hi - a) / (hi - lo), 0, 1), h = r.y0 + t * (r.y1 - r.y0);
    if (h <= lim && h > best) best = h;
  }
  return best;
}
export const terrainAt = gy;

export function freePos() {
  for (let i = 0; i < 300; i++) {
    const x = rnd(-HALF + 6, HALF - 6), z = rnd(-HALF + 6, HALF - 6);
    // chá»‰ chá»n chá»— pháº³ng gáº§n y=0 Ä‘á»ƒ ai chÆ°a dĂ¹ng groundAt váº«n khĂ´ng bá»‹ chĂ´n xuá»‘ng Ä‘áº¥t
    if (Math.abs(gy(x, z)) > 0.35 || slopeAt(x, z) > 0.15) continue;
    if (!collidesAt(x, z, 1.5) && !ponds.some(p => (x - p[0]) ** 2 + (z - p[1]) ** 2 < (p[2] + 1) ** 2)) return [x, z];
  }
  return [0, 0];
}

/** Bá» máº·t táº¡i (x,z) cho tiáº¿ng bÆ°á»›c chĂ¢n: 'water' (ao, ruá»™ng) | 'concrete' (Ä‘Æ°á»ng nhá»±a) | 'gravel' (Ä‘Æ°á»ng Ä‘áº¥t) | 'sand' (sĂ¢n lĂ ng) | 'grass'. */
export function surfaceAt(x, z) {
  for (const p of ponds) if ((x - p[0]) ** 2 + (z - p[1]) ** 2 < p[2] * p[2]) return 'water';
  if (Math.abs(z - RZ) < RW / 2 || Math.abs(x - RX) < RW / 2) return 'concrete';
  const dz = RZ + (RZ > 0 ? -1 : 1) * HALF * 0.55, dx = RX + (RX > 0 ? -1 : 1) * HALF * 0.55;
  if (Math.abs(z - dz) < 2 || Math.abs(x - dx) < 2) return 'gravel';
  for (const p of paddies) if (Math.abs(x - p[0]) < p[2] / 2 - 0.9 && Math.abs(z - p[1]) < p[3] / 2 - 0.9) return 'water';
  for (const c of vill) if (Math.hypot(x - c[0], z - c[1]) < 28) return 'sand';
  if (slopeAt(x, z) > 0.4) return 'gravel'; // sÆ°á»n dá»‘c Ä‘Ă¡ sá»i
  return 'grass';
}
