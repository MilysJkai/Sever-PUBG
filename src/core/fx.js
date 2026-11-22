// MĂ³c (hook) Ă¢m thanh & hiá»‡u á»©ng. Logic game chá»‰ gá»i snd.xxx / hooks.xxx, máº·c Ä‘á»‹nh khĂ´ng lĂ m gĂ¬
// (server Node khĂ´ng cĂ³ loa, khĂ´ng cĂ³ mĂ n hĂ¬nh). Client gáº¯n hĂ m tháº­t á»Ÿ audio/bind.js vĂ  render/tracer.js.
const noop = () => {};

export const snd = {
  playGunshot: noop, playImpact: noop, playBulletPass: noop, playHitMarker: noop, playHurt: noop,
  playKill: noop, playClick: noop, playReload: noop, playChute: noop, playClink: noop,
  playExplosion: noop, playPickup: noop
};

export const hooks = {
  tracer: noop,          // (x1,y1,z1,x2,y2,z2) váº½ Ä‘Æ°á»ng Ä‘áº¡n
  updateTracers: noop,   // (dt)
  updatePlayer: null,    // (e, dt) Ä‘iá»u khiá»ƒn ngÆ°á»i chÆ¡i cá»¥c bá»™; server sáº½ gáº¯n hĂ m xá»­ lĂ½ input máº¡ng á»Ÿ pháº§n sau
  entPost: null          // (e, dt) sau khi cáº­p nháº­t 1 thá»±c thá»ƒ: client gáº¯n tiáº¿ng bÆ°á»›c chĂ¢n + hoáº¡t áº£nh
};

// PATCH:server-ready — server gắn hàm vào đây để gửi sự kiện cho client
hooks.onDamage = null;   // (e, dmg, by) sau khi trừ máu
hooks.onKill = null;     // (e, by, soNguoiConSong) khi có người chết
