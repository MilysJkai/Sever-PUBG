// Bù trễ mạng khi bắn (lag compensation), chạy trên SERVER.
// Người bắn nhìn thấy kẻ địch ở vị trí CŨ (trễ ~ ping/2 + độ trễ nội suy). Khi nhận lệnh bắn, server kéo các thực thể khác
// về đúng thời điểm người bắn đang nhìn, bắn xong rồi trả lại vị trí hiện tại.
import { ents } from '../core/state.js';

const HIST = 24;                       // nhớ 24 tick (~1,2 giây)

export function createLagComp(maxLag = 8) {
  const hist = new Array(HIST).fill(null);
  return {
    /** Gọi sau mỗi tick của sim, n = số tick đã chạy. */
    record(n) {
      const a = new Float32Array(ents.length * 4);
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i];
        a[i * 4] = e.x; a[i * 4 + 1] = e.y; a[i * 4 + 2] = e.z; a[i * 4 + 3] = e.crouch ? 1 : 0;
      }
      hist[n % HIST] = { n, a };
    },
    /**
     * Kéo mọi thực thể (trừ `except`) về tick vt (có thể lẻ; client gửi tick nó đang hiển thị). now = tick hiện tại.
     * Trả về hàm khôi phục, hoặc null nếu không cần / không có dữ liệu. Trễ tối đa maxLag tick để chống gian lận.
     */
    rewind(except, vt, now) {
      if (typeof vt !== 'number' || !Number.isFinite(vt)) return null;
      vt = Math.max(vt, now - maxLag);
      if (now - vt < 0.05) return null;
      const n0 = Math.floor(vt), f = vt - n0;
      const h0 = hist[n0 % HIST], h1 = hist[(n0 + 1) % HIST];
      if (!h0 || h0.n !== n0) return null;
      const A = h0.a, B = h1 && h1.n === n0 + 1 ? h1.a : A;
      const saved = [];
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i];
        if (e === except || !e.alive || e.air || i * 4 + 3 >= A.length) continue;
        saved.push([e, e.x, e.y, e.z, e.crouch]);
        e.x = A[i * 4] + (B[i * 4] - A[i * 4]) * f;
        e.y = A[i * 4 + 1] + (B[i * 4 + 1] - A[i * 4 + 1]) * f;
        e.z = A[i * 4 + 2] + (B[i * 4 + 2] - A[i * 4 + 2]) * f;
        e.crouch = (f < 0.5 ? A : B)[i * 4 + 3] === 1;
      }
      return () => { for (const s of saved) { s[0].x = s[1]; s[0].y = s[2]; s[0].z = s[3]; s[0].crouch = s[4]; } };
    }
  };
}
