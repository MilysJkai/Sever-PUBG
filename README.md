# Mini PUBG server (tổ đội)

## Chạy thử trên máy mình
```
npm install
npm start
```
Server chạy ở cổng 8787. Trong game (`src/net/party.js`) giữ nguyên `ws://localhost:8787`.
Mở 2 cửa sổ game: 1 cửa sổ tạo tổ đội, cửa sổ kia nhập mã để thử.

## Đưa lên Render (miễn phí)
1. Tạo repo GitHub mới, đưa toàn bộ file trong thư mục này lên (không cần thư mục `node_modules`).
2. Vào render.com, đăng nhập bằng GitHub, chọn **New > Web Service**, chọn repo vừa tạo.
3. Điền: Runtime **Node**, Build Command `npm install`, Start Command `npm start`, Instance Type **Free**.
4. Bấm Deploy. Xong Render cho 1 địa chỉ dạng `https://ten-app.onrender.com`.
5. Mở `src/net/party.js` trong game, đổi dòng `SERVER_URL` thành `wss://ten-app.onrender.com` (đổi `https` thành `wss`).
6. Sửa server sau này: sửa file, đẩy lên GitHub, Render tự deploy lại.
