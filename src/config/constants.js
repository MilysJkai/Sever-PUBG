// Háº±ng sá»‘ & dá»¯ liá»‡u cĂ¢n báº±ng game. Sá»­a sá»‘ liá»‡u sĂºng / á»‘ng ngáº¯m / vĂ²ng bo táº¡i Ä‘Ă¢y.

export const WORLD = 400, HALF = WORLD / 2, EYE = 1.7, RADIUS = 0.4, PLANE_H = 220;

export const WEAPONS = [
  { n: 'P92',   dmg: 22,  rate: 0.35, mag: 12, spread: 0.010, pellets: 1, range: 120, reload: 1.2, color: 0x888888 },
  { n: 'UMP45', dmg: 14,  rate: 0.09, mag: 30, spread: 0.030, pellets: 1, range: 100, reload: 1.8, color: 0x44aa44 },
  { n: 'S12K',  dmg: 9,   rate: 0.80, mag: 5,  spread: 0.060, pellets: 8, range: 45,  reload: 2.2, color: 0xaa7722 },
  { n: 'M416',  dmg: 22,  rate: 0.11, mag: 30, spread: 0.015, pellets: 1, range: 220, reload: 2.0, color: 0x3366cc },
  { n: 'AWM',   dmg: 110, rate: 1.30, mag: 5,  spread: 0.000, pellets: 1, range: 400, reload: 3.0, color: 0xcc2222 }
];

export const SCOPES = [
  { n: 'Iron Sight',  x: 1, fov: 60,   kind: 'iron',   color: 0x666666 },
  { n: 'Red Dot',     x: 1, fov: 55,   kind: 'reddot', color: 0xdd3333 },
  { n: 'Holographic', x: 1, fov: 55,   kind: 'holo',   color: 0xdd8833 },
  { n: '2x Scope',    x: 2, fov: 38,   kind: 'optic',  mil: false, color: 0x3377dd },
  { n: '3x Scope',    x: 3, fov: 26,   kind: 'optic',  mil: false, color: 0x33aadd },
  { n: '4x Scope',    x: 4, fov: 19,   kind: 'optic',  mil: true,  color: 0x33dd88 },
  { n: '6x Scope',    x: 6, fov: 12.5, kind: 'optic',  mil: true,  color: 0xaadd33 },
  { n: '8x Scope',    x: 8, fov: 9,    kind: 'optic',  mil: true, compass: true, color: 0xdd33aa }
];

export const FIST = { n: 'Tay khĂ´ng', dmg: 0, rate: 1, mag: 0, spread: 0, pellets: 0, range: 0, reload: 1, color: 0 };
/** VÅ© khĂ­ Ä‘ang cáº§m cá»§a má»™t thá»±c thá»ƒ (tay khĂ´ng náº¿u w < 0). */
export const WP = e => e.w < 0 ? FIST : WEAPONS[e.w];

export const ARMOR_MAX = [0, 70, 100, 130];
export const BAG_CAP = [12, 20, 28, 36];
export const ZEROS = [100, 200, 300, 400, 500];

// VĂ²ng bo: bĂ¡n kĂ­nh tá»«ng pha, thá»i gian chá» & thá»i gian co (giĂ¢y)
export const ZONE_R = [285, 150, 80, 40, 18, 6];
export const ZONE_WAIT = 30;
export const ZONE_SHRINK = 25;

export const BOT_OPTS = [10, 20, 40];

export const LOOT_COL = { weapon: 0xff9922, ammo: 0xf0dc3c, med: 0xeb3c3c, vest: 0x468ce6, helmet: 0xdddddd, bag: 0x8a6a30, scope: 0xaa55ff, gren: 0x556b2f };
