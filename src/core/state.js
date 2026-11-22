// Tráº¡ng thĂ¡i dĂ¹ng chung cá»§a game. CĂ¡c module import `S` vĂ  Ä‘á»c/ghi qua S.xxx
// (ES module khĂ´ng cho gĂ¡n láº¡i biáº¿n import, nĂªn gom háº¿t vĂ o 1 object).
// CĂ¡c máº£ng bĂªn dÆ°á»›i chá»‰ Ä‘Æ°á»£c sá»­a táº¡i chá»— (push/splice/length = 0), khĂ´ng gĂ¡n láº¡i.

export const S = {
  G: null,            // THREE.Group chá»©a má»i thá»© cá»§a 1 vĂ¡n
  player: null,
  zone: null,
  zoneMesh: null,
  state: 0,           // 0 = đang chơi, 1 = chết, 2 = thắng
  placement: 0,
  gameTime: 0,
  flashT: 0,          // lá»­a Ä‘áº§u nĂ²ng
  hurtT: 0,           // hiá»‡u á»©ng Ä‘á» mĂ n hĂ¬nh khi trĂºng Ä‘áº¡n
  zoomed: false,      // chuột phải: ngắm
  yaw: 0,
  pitch: 0,
  fPressed: false,
  mouseDown: false,
  adsT: 0,            // 0..1 má»©c Ä‘á»™ Ä‘Ă£ ngáº¯m
  frameDt: 0.016,
  scopeDrawn: false,
  mode: 'lobby',      // 'lobby' | 'game'
  plane: null,
  playerChute: null,
  tpp: false,         // gĂ³c nhĂ¬n thá»© 3
  invOpen: false,
  BOTS: 20,
  lobbyMX: 0.5        // vá»‹ trĂ­ chuá»™t (0..1) Ä‘á»ƒ xoay nhĂ¢n váº­t á»Ÿ sáº£nh
};

export const buildings = [];
export const colliders = [];
export const ents = [];
export const loots = [];
export const tracers = [];
export const feed = [];
export const grenades = [];
export const fxs = [];
export const keys = {};

export function addFeed(s) { feed.push({ s, life: 6 }); }
