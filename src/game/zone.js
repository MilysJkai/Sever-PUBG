// VĂ²ng bo (bo an toĂ n): chá» -> co -> pha káº¿ tiáº¿p.
import { ZONE_R, ZONE_WAIT, ZONE_SHRINK } from '../config/constants.js';
import { rnd } from '../core/utils.js';

export function newZone() {
  const z = { cx: 0, cz: 0, r: ZONE_R[0], phase: 0, t: 0, shrinking: false, done: false, nx: 0, nz: 0, nr: 0, sx: 0, sz: 0, sr: 0 };
  z.plan = function () {
    if (this.phase + 1 >= ZONE_R.length) { this.done = true; return; }
    this.nr = ZONE_R[this.phase + 1];
    const a = rnd(0, 6.28), d = rnd(0, this.r - this.nr);
    this.nx = this.cx + Math.cos(a) * d; this.nz = this.cz + Math.sin(a) * d;
  };
  z.update = function (dt) {
    if (this.done) return;
    this.t += dt;
    if (!this.shrinking) {
      if (this.t >= ZONE_WAIT) { this.shrinking = true; this.t = 0; this.sx = this.cx; this.sz = this.cz; this.sr = this.r; }
    } else {
      const k = Math.min(1, this.t / ZONE_SHRINK);
      this.cx = this.sx + (this.nx - this.sx) * k;
      this.cz = this.sz + (this.nz - this.sz) * k;
      this.r = this.sr + (this.nr - this.sr) * k;
      if (k >= 1) { this.shrinking = false; this.t = 0; this.phase++; this.plan(); }
    }
  };
  z.dps = function () { return 1 + this.phase * 1.5; };
  z.plan();
  return z;
}
