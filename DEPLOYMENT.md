# Hướng dẫn Deploy — Quiz Contest (Cuộc thi tri thức)

Tài liệu đề xuất phương án triển khai ứng dụng dựa trên kiến trúc hiện tại.

## 1. Tóm tắt kiến trúc & ràng buộc

Trước khi chọn công nghệ, cần nắm rõ những đặc điểm sau (chúng quyết định
phương án nào khả thi):

| Đặc điểm | Ảnh hưởng đến deploy |
|---|---|
| Node.js (ESM) + Express, **server là nguồn dữ liệu duy nhất** của state game & timer | Cần **long-running process**, không phải serverless |
| Realtime qua **Socket.IO (WebSocket)** | Reverse proxy phải hỗ trợ WebSocket |
| **SQLite** dạng file tại `server/data/` | Cần **ổ đĩa bền vững** cho file DB |
| Upload media (hình/video) vào `server/uploads/` | Cần thư mục ghi được bền vững |
| Frontend React + Vite, build thành static | Có thể server trực tiếp hoặc tách static |

Hệ thống chạy trên **một node duy nhất** (server vừa phục vụ API, vừa giữ
realtime) → kiến trúc rất phù hợp với **1 instance / container**, không cần
mở rộng ngang.

> Lưu ý quan trọng: DB mặc định là SQLite (file). Nếu deploy lên nền tảng
> serverless hoặc PaaS không có ổ đĩa bền vững, dữ liệu sẽ bị mất mỗi lần
> restart/redeploy.

---

## 2. Các phương án khả thi (xếp theo độ phù hợp)

### Phương án A — VPS Linux + PM2 (khuyến nghị)

**Phù hợp nhất** với kiến trúc hiện tại: tự chủ hoàn toàn, hỗ trợ tốt
Socket.IO + SQLite + upload.

Chuẩn bị:

- Một VPS (DigitalOcean / Vultr / Hetzner) — 1GB RAM là đủ cho lượng nhỏ.
- Node.js 18+ (bản có sẵn `node:sqlite`), Nginx, PM2.

Quy trình tóm tắt:

```bash
# 1. Trên VPS: cài Node, Nginx, PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs nginx
npm i -g pm2

# 2. Copy mã nguồn lên VPS, cài deps
cd /var/www/cuoc-thi
npm ci

# 3. Build frontend (tạo static assets)
npm run build

# 4. Chạy server bằng PM2 (service luôn sống, tự restart khi crash)
pm2 start server/index.js --name cuoc-thi
pm2 save
pm2 startup   # tự chạy lại khi reboot
```

Cấu hình Nginx (reverse proxy + WebSocket) — file `/etc/nginx/sites-available/cuoc-thi`:

```nginx
server {
    listen 80;
    server_name ban.hocsinh.example;

    # Frontend static (đã build)
    root /var/www/cuoc-thi/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri /index.html;
    }

    # API + Socket.IO proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }
}
```

> Tuỳ theo server có tự serve static hay không: nếu server đã serve cả frontend
> lẫn API ở cổng 3001, chỉ cần proxy mọi thứ về đó và không cần dùng `root` ở trên.

Ưu điểm: rẻ, nhanh, toàn quyền; không bị giới hạn bởi nền tảng.
Nhược điểm: tự quản trị server (update, backup, bảo mật).

---

### Phương án B — Docker + Docker Compose

Dễ tái tạo, chuyển hosting, cô lập môi trường. Chạy được trên VPS, máy local,
hay Raspberry Pi.

Cấu trúc 2 container:

- `app`: hình Node chạy server.
- `nginx`: làm reverse proxy (WebSocket) phục vụ static + proxy API.

File `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    environment:
      - PORT=3001
    volumes:
      - ./server/data:/app/server/data   # giữ DB SQLite
      - ./server/uploads:/app/server/uploads # giữ media
    expose:
      - "3001"

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./dist:/usr/share/nginx/html:ro     # static đã build
    depends_on:
      - app
```

`Dockerfile` mẫu:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build frontend nếu cần (hoặc build riêng trước)
RUN npm run build
EXPOSE 3001
CMD ["node", "server/index.js"]
```

Ưu điểm: nhất quán giữa môi trường, dễ backup bằng cách copy `server/data`.
Nhược điểm: cần kiến thức Docker cơ bản.

---

### Phương án C — PaaS (Render / Railway / Fly.io)

Phù hợp nếu muốn nền tảng quản lý hạ tầng thay mình, và hỗ trợ mở khối/đĩa
bền vững cho SQLite.

- **Render**: dùng **Web Service** chạy `node server/index.js`, bật
  **Persistent Disk** và mount vào `server/data` (và `server/uploads`).
- **Railway**: tạo volume gắn vào `server/data`.
- **Fly.io**: hỗ trợ volumes + WebSocket rất tốt.

Điểm bắt buộc phải làm: **luôn mount volume cho `server/data`**, nếu không
dữ liệu SQLite mất sau mỗi deploy.

Ưu điểm: ít vận hành, có free tier giới hạn, deploy bằng git.
Nhược điểm: có giới hạn tài nguyên, tốn phí khi nhiều traffic; phải cẩn thận
configuration volume.

> ⚠️ **Render gói Free KHÔNG hỗ trợ Persistent Disk.** Nếu vẫn muốn dùng Render
> Free cho backend, không thể dùng SQLite (dữ liệu mất mỗi lần redeploy). Giải
> pháp đã chọn ở dự án này: dùng **MySQL** làm database lưu dữ liệu bền vững.

### Phương án B' (đã chọn) — Render Web Service Free + MySQL

Phù hợp khi muốn backend chạy trên Render Free nhưng vẫn giữ dữ liệu qua các
lần redeploy. Dùng **MySQL Database của Render** (miễn phí trong cùng account)
thay cho SQLite local.

Cách triển khai:

1. **Tạo MySQL trên Render**: Dashboard → *New → MySQL*. Lấy thông tin kết nối:
   `Hostname`, `Port`, `User`, `Password`, `Database`.
2. **Deploy app**: repo đã có `render.yaml` (Web Service, build command, Node 22,
   `DB_CLIENT=mysql`). Đẩy lên GitHub rồi *New → Blueprint*.
3. **Điền biến môi trường** (tab *Environment* của Web Service, các biến đã khai
   báo `sync: false` trong `render.yaml` để không bị override):
   - Nên dùng **internal hostname** của MySQL Render nếu DB cùng region/account
     để kết nối nhanh và không qua internet công cộng.
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `DB_SSL=true` (MySQL của Render yêu cầu TLS).
   - Hoặc dùng một biến `DATABASE_URL` dạng
     `mysql://user:pass@host:3306/dbname` (server ưu tiên biến này).
4. Server tự tạo bảng schema lần đầu chạy (file `server/db/schema.mysql.sql`
   + migration) nên không cần import thủ công.

> Lưu ý về giới hạn Render Free: instance bị **sleep sau ~15 phút** không có
> request và **wake** khi có request → với app có **timer chạy liên tục**, game
> có thể tạm dừng khi instance ngủ. Đã bật `healthCheckPath` để giảm tần suất
> ngủ. Nếu tổ chức cuộc thi thật, nên nâng cấp gói trả phí hoặc dùng VPS/Docker.

---

### Phương án D — Máy chủ địa phương / Raspberry Pi (tổ chức offline)

Nếu cuộc thi diễn ra tại trường, có thể không cần internet:

- Chạy toàn bộ trên **1 máy local / Pi** với Node 18+.
- Các màn hình (MC desk, LED screen, máy contestant) nối cùng **WiFi/LAN**.
- Truy cập qua địa chỉ IP nội bộ (vd `http://192.168.1.10:3001`).

Ưu điểm: miễn phí, không phụ thuộc mạng ngoài, độ trễ thấp.
Nhược điểm: giới hạn số lượng kết nối đồng thời, cần ổn định của máy host.

---

## 3. Phương án KHÔNG phù hợp với kiến trúc hiện tại

| Nền tảng | Lý do không phù hợp |
|---|---|
| **Serverless** (Vercel, Netlify Functions, AWS Lambda) | Thời gian chạy có giới hạn, không giữ được Socket.IO server + vòng timer liên tục; không có đĩa bền vững cho SQLite |
| **Static hosting** (Vercel/Netlify static, GitHub Pages) | Chỉ phục vụ frontend, không có backend/realtime |

Muốn dùng những nền tảng trên thì phải thay đổi kiến trúc: tách realtime sang
dịch vụ riêng và đổi SQLite → MySQL/Postgres (hiện chưa cần thiết, trái với
kiến trúc gọn nhẹ hiện tại).

---

## 4. Kiến nghị

- **Mặc định nên dùng Phương án A (VPS + PM2) hoặc B (Docker)**, vì chúng
  giữ nguyên toàn bộ kiến trúc hiện tại (1 node, SQLite, WebSocket) với chi phí
  thấp và ít rủi ro.
- Nếu chỉ thi offline tại trường → **Phương án D** là nhanh nhất, miễn phí.
- Tránh serverless trừ khi sẵn sàng đổi database + tách realtime.
