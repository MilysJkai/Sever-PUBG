# Mini PUBG server (tổ đội + trận đấu)

## Chạy thử trên máy mình
```
npm install
npm start
```
Server chạy ở cổng 8787. Trong game (`src/net/party.js`) đổi `SERVER_URL` thành `ws://localhost:8787` khi thử local.

## Cập nhật logic game lên server
Server dùng chung code mô phỏng với game (thư mục `src/` ở đây KHÔNG sửa tay). Mỗi khi sửa logic game, từ thư mục game chạy:
```
node tools/sync-to-server.mjs C:\Users\Lim\Desktop\mini-pubg-server
```
rồi đẩy server lên GitHub, Render tự deploy lại.

## Kiểm tra
```
node test/test-match.mjs
```
(mở server thật + client giả: ghép trận, đếm ngược, nhảy dù, vào lại khi rớt mạng, kết thúc trận).

## Biến môi trường (tuỳ chọn)
| Tên | Mặc định | Ý nghĩa |
|---|---|---|
| MATCH_TOTAL | 20 | tổng người + bot mỗi trận |
| QUEUE_WAIT_MS | 20000 | chờ ghép trận kể từ tổ đội đầu tiên |
| COUNTDOWN_S | 5 | đếm ngược trước khi máy bay cất cánh |
| GRACE_S | 60 | rớt mạng quá bao lâu thì bỏ trận |

## Giao thức (client <-> server), JSON qua WebSocket
Tổ đội (đã có): `create` `join` `profile` `sig` `chat` `leave` -> `party` `chat` `sig` `error` `left`.

**Tìm trận**
- `{t:'find', name, look}` (solo) hoặc `{t:'find'}` (chủ tổ đội, cả tổ cùng vào hàng đợi) -> `{t:'queue', state:'searching', size, humans, waitMs}`
- `{t:'cancel'}` -> `{t:'queue', state:'idle'}`
- Ghép xong -> `{t:'match', id, token, you, seed, humans, bots, total, roster:[{id,name,look,team}], countdown}`
  (id thực thể: người chơi theo thứ tự `roster`, bot đánh số tiếp theo; `seed` để dựng đúng bản đồ; giữ `token` để vào lại)
- Rồi `{t:'init', you, plane:{sx,sz,dx,dz,speed,len,L}, zoneWait, loots:[{id,x,z,ty,w,c}]}`

**Trong trận** (client -> server)
- `{t:'in', seq, vt, fw,bk,l,r,run,jump,crouch,lq,le,fire,ads,f, yaw,pitch}` ~30 lần/giây. `vt` = số tick của ảnh chụp client đang hiển thị (dùng để bù trễ).
- `{t:'act', k:'reload'|'slot'|'med'|'gren'|'zero'|'attach'|'detach'|'dropslot'|'dropscope'|'dropgear'|'take', i, b, id}`
- `{t:'leavematch'}` rời trận. Rớt mạng: mở kết nối mới rồi gửi `{t:'resume', token}` (trong GRACE_S giây).

**Trong trận** (server -> client), 20 lần/giây:
`{t:'s', n, ph:'cd'|'play'|'over', cd, gt, ack, z:[cx,cz,r,phase,shrinking,t,nx,nz,nr,done], pl:[t,done,forced], g:[[x,y,z]..],`
`e:[[x,y,z,yaw,hp,armor,alive,crouch,air,w,lean,pitch] .. theo id], me:{...trạng thái riêng}, ev:[sự kiện], msg:[tin riêng], res}`
- `ack` = seq phím cuối cùng server đã xử lý (để client dự đoán và sửa lại vị trí).
- Sự kiện `ev`: `shot` `imp` `rel` `clk` `exp` `trc` `hit` `kill` `lp` (loot xuất hiện) `lr` (loot biến mất).
- Cuối trận: `ph:'over'` kèm `res:{winner, team}`, rồi `{t:'matchend'}`.
