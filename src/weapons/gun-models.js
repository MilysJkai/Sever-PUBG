/* global THREE */
import { WEAPONS } from '../config/constants.js';

/** Model sĂºng (nĂ²ng hÆ°á»›ng -z, gá»‘c á»Ÿ khung sĂºng). userData.muz = vá»‹ trĂ­ Ä‘áº§u nĂ²ng. */
export function makeGun(w) {
  const g = new THREE.Group(), acc = WEAPONS[w].color;
  const M = c => new THREE.MeshLambertMaterial({ color: c });
  const bx = (sx, sy, sz, x, y, z, c, rx) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), M(c)); m.position.set(x, y, z); if (rx) m.rotation.x = rx; g.add(m); return m; };
  const cy = (r, len, x, y, z, c) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), M(c)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); g.add(m); return m; };
  const D = 0x1b1d20, SIL = 0xa4a8ac, GRY = 0x2c3034;
  let muz;
  if (w === 0) {                                   // P92: sĂºng lá»¥c
    bx(0.034, 0.04, 0.2, 0, 0.03, -0.07, SIL);
    bx(0.03, 0.03, 0.17, 0, 0.0, -0.06, D);
    bx(0.032, 0.11, 0.05, 0, -0.06, 0.02, D, 0.22);
    bx(0.01, 0.012, 0.012, 0, 0.058, -0.16, D);
    cy(0.009, 0.04, 0, 0.03, -0.18, D);
    muz = -0.21;
  } else if (w === 1) {                            // UMP45: tiá»ƒu liĂªn
    bx(0.05, 0.075, 0.3, 0, 0.02, -0.1, GRY);
    cy(0.013, 0.14, 0, 0.035, -0.34, D);
    bx(0.03, 0.15, 0.04, 0, -0.085, -0.09, D, -0.08);
    bx(0.034, 0.1, 0.045, 0, -0.07, 0.06, D, 0.25);
    bx(0.03, 0.05, 0.22, 0, 0.005, 0.27, acc);
    bx(0.022, 0.02, 0.12, 0, 0.07, -0.1, D);
    muz = -0.42;
  } else if (w === 2) {                            // S12K: shotgun á»• Ä‘áº¡n trĂ²n
    bx(0.06, 0.08, 0.38, 0, 0.02, -0.08, GRY);
    cy(0.02, 0.4, 0, 0.045, -0.46, D);
    cy(0.017, 0.38, 0, 0.0, -0.46, D);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 12), M(acc)); drum.position.set(0, -0.075, -0.12); g.add(drum);
    bx(0.05, 0.06, 0.2, 0, -0.03, -0.32, acc);
    bx(0.034, 0.1, 0.045, 0, -0.07, 0.08, D, 0.25);
    bx(0.045, 0.085, 0.3, 0, 0.0, 0.3, acc);
    muz = -0.67;
  } else if (w === 3) {                            // M416: sĂºng trÆ°á»ng, ray + red dot
    bx(0.055, 0.085, 0.36, 0, 0.02, -0.05, GRY);
    bx(0.06, 0.07, 0.32, 0, 0.02, -0.4, acc);
    cy(0.012, 0.18, 0, 0.03, -0.65, D);
    cy(0.019, 0.07, 0, 0.03, -0.77, D);
    bx(0.036, 0.17, 0.05, 0, -0.1, -0.08, D, -0.2);
    bx(0.034, 0.1, 0.045, 0, -0.075, 0.1, D, 0.25);
    bx(0.045, 0.09, 0.26, 0, 0.0, 0.28, acc);
    bx(0.025, 0.02, 0.5, 0, 0.075, -0.2, D);
    bx(0.04, 0.05, 0.07, 0, 0.11, -0.05, 0x222222);
    muz = -0.82;
  } else {                                         // AWM: báº¯n tá»‰a, nĂ²ng dĂ i + kĂ­nh ngáº¯m
    bx(0.055, 0.085, 0.42, 0, 0.02, -0.02, GRY);
    cy(0.018, 0.8, 0, 0.03, -0.62, D);
    cy(0.028, 0.1, 0, 0.03, -1.05, D);
    cy(0.032, 0.3, 0, 0.115, -0.1, D);
    bx(0.03, 0.04, 0.03, 0, 0.075, -0.02, D); bx(0.03, 0.04, 0.03, 0, 0.075, -0.2, D);
    bx(0.036, 0.075, 0.07, 0, -0.065, -0.05, D);
    bx(0.034, 0.1, 0.045, 0, -0.075, 0.12, D, 0.25);
    bx(0.05, 0.11, 0.38, 0, 0.0, 0.34, acc);
    bx(0.02, 0.02, 0.07, 0.045, 0.05, 0.02, SIL);
    muz = -1.1;
  }
  g.userData.muz = muz;
  return g;
}
