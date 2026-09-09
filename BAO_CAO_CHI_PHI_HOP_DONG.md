# BÁO CÁO CHI PHÍ & HỢP ĐỒNG — DỰ ÁN CUỘC THI TRI THỨC (Quiz Contest)

**Ngày lập:** 09/09/2026
**Trạng thái:** Dự án đang triển khai trên nền tảng Render (Free tier) + Cloudflare R2 (media/sound)

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1. Giới thiệu

Nền tảng web tổ chức và điều hành cuộc thi tri thức trực tiếp (tầm 4–6 đội, hỗ trợ thí sinh online):

- **Vòng sơ khảo online:** 30 câu trắc nghiệm, 15 phút, tự động chấm, xếp hạng, chọn Top 16.
- **Vòng chính:** Khởi động → Vượt chướng ngại vật → Tăng tốc → Về đích (+ Phụ phúc), điều khiển realtime.
- **Vai trò:** Thí sinh (màn hình đội), Khán giả/LED (màn hình lớn), MC (bàn điều khiển), Admin (quản trị).
- **Realtime:** Socket.IO — máy chủ là nguồn dữ liệu duy nhất (state game + timer).

### 1.2. Kiến trúc & hạ tầng

| Thành phần | Công nghệ | Nơi chạy hiện tại |
|---|---|---|
| Web Service (API + Socket.IO + static frontend) | Node.js 22, Express, React/Vite | **Render — Web Service (Free)** |
| Cơ sở dữ liệu | SQLite (local) → **PostgreSQL** (production) | **Render — Postgres (Free)** |
| Media & âm thanh (hình/video/nhạc) | File upload → URL | **Cloudflare R2** (đang chuyển sang) |
| Source code & CI | Git/GitHub | GitHub (private/public) |

---

## 2. CHI PHÍ HẠ TẦNG — PHƯƠNG ÁN HIỆN TẠI

> Giá tham khảo công bố nửa cuối **2026** (Render.com, developers.cloudflare.com). Vui lòng đối chiếu lại trước khi ký hợp đồng.

### 2.1. Render (compute + database)

| Hạng mục | Gói đang dùng | Chi phí | Ghi chú |
|---|---|---|---|
| Web Service | **Free** (512 MB RAM / 0.1 CPU) | **$0 / tháng** | Ngủ sau 15 phút không request; 750 giờ miễn phí/workspace/tháng |
| PostgreSQL | **Free** (256 MB RAM / 1 GB SSD, 100 kết nối) | **$0 / tháng** | **Chỉ tồn tại 30 ngày, sau đó expire nếu không nâng cấp** |
| Storage phát sinh | — | $0,30 / GB / tháng | Chỉ tính trên gói trả phí |
| Băng thông (Hobby plan) | 100 GB / tháng | **$0** | Gói Hobby không phí nền tảng |
| Pipeline minutes (build) | 500 phút / tháng | **$0** | |

**Tổng chi phí hạ tầng hiện tại: $0 / tháng** (không tính chi phí tên miền).

> ⚠️ **Rủi ro quan trọng:** Render **Postgres Free chỉ tồn tại 30 ngày**. Sau 30 ngày, nếu không nâng cấp lên gói trả phí, database sẽ bị xoá. Với một cuộc thi thật (cần giữ dữ liệu thí sinh, điểm, lịch sử), **bắt buộc nâng cấp Postgres** lên gói trả phí.

### 2.2. Cloudflare R2 (media & âm thanh)

| Hạng mục | Free tier | Tròn phí |
|---|---|---|
| Lưu trữ | **10 GB / tháng** | $0,015 / GB / tháng (Standard) |
| Class A (ghi: upload) | 1 triệu request / tháng | $4,50 / triệu |
| Class B (đọc: tải về) | 10 triệu request / tháng | $0,36 / triệu |
| Egress (băng thông ra ngoài) | **Miễn phí** | **$0** (vĩnh viễn miễn phí egress) |

**Ước tính sử dụng thực tế của dự án** (10–20GB media, vài chục nghìn lượt xem/lần thi):

| Nguồn phí | Cách tính | Ước tính |
|---|---|---|
| Storage | ~15 GB vượt 10 GB free → 5 GB × $0,015 | ~**$0,08 / tháng** |
| Class B (đọc media, âm thanh) | nằm trong 10 triệu free | **$0** |
| Egress | | **$0** |

**Tổng chi phí R2 ước tính: ~$0–0,10 / tháng.**

### 2.3. Tên miền (nếu có)

| Hạng mục | Chi phí |
|---|---|
| Tên miền `.com` (~1 năm, giá thị trường) | ~$10–15 / năm |
| Tên miền `.vn` (~1 năm) | ~180.000–350.000 VND / năm |
| SSL (Let's Encrypt qua Render/R2) | **$0** |

---

## 3. CHI PHÍ KHI TỔ CHỨC CUỘC THI THẬT (KHUYẾN NGHỊ NÂNG CẤP)

Free tier phù hợp thử nghiệm, **không đủ tin cậy cho cuộc thi thật** (instance ngủ, DB expire 30 ngày, không có backup đủ). Kịch bản chi phí khi đi vào vận hành thật:

### 3.1. Kịch bản A — Giữ Render, nâng cấp (đơn giản, ít vận hành)

| Hạng mục | Gói đề xuất | Chi phí / tháng |
|---|---|---|
| Web Service | **Starter** (512 MB / 0.5 CPU) — hết ngủ | $7 |
| PostgreSQL | **Basic-256mb** (256 MB / 16 GB) | $7 |
| Cloudflare R2 | vượt free tier chút ít | ~$0–0,10 |
| **Tổng** | | **~$14 / tháng** (~350.000 VND) |

### 3.2. Kịch bản B — VPS Linux + PM2 (rẻ hơn, tự quản trị)

| Hạng mục | Chi phí / tháng |
|---|---|
| VPS 1 vCPU / 1–2 GB RAM (DigitalOcean/Vultr/Hetzner) | $5–12 |
| PostgreSQL (cài trên VPS) | $0 |
| Cloudflare R2 (media) | ~$0–0,10 |
| Backup (theo lịch, qua script) | $0 |
| **Tổng** | **~$5–12 / tháng** (tự quản trị, cần kỹ năng vận hành) |

### 3.3. Chi phí phát triển & nhân công (ước tính)

> Dựa trên quy mô code hiện tại (~server + client, ~40 test, 6 màn hình chính). Chi phí nhân công mang tính tham khảo, điều chỉnh theo thực tế và đơn vị thực hiện.

| Hạng mục | Khối lượng ước tính | Chi phí tham khảo |
|---|---|---|
| Phân tích + thiết kế kiến trúc | 5–10 ngày công | 5.000.000–15.000.000 VND |
| Phát triển hệ thống (backend + frontend + realtime) | 25–40 ngày công | 30.000.000–70.000.000 VND |
| Thiết kế giao diện màn hình thi (MC/LED/thí sinh) | 5–10 ngày công | 5.000.000–15.000.000 VND |
| Trắc nghiệm thực tế + chỉnh sửa | 3–5 ngày công | 3.000.000–8.000.000 VND |
| **Tổng phát triển** | 40–65 ngày công | **45.000.000–110.000.000 VND** |

---

## 4. CÁC LOẠI HỢP ĐỒNG CẦN CHO DỰ ÁN

### 4.1. Hợp đồng PHÁT TRIỂN PHẦN MỀM (chính)

- **Bên A:** Đơn vị đặt hàng / tổ chức cuộc thi.
- **Bên B:** Đơn vị phát triển.
- **Đối tượng:** Toàn bộ nền tảng quiz contest (backend, frontend, realtime, admin, màn hình thi).
- **Nội dung chính:**
  - Phạm vi chức năng (danh mục tính năng đính kèm).
  - Tiến độ & mốc bàn giao (sơ khảo → vòng chính → nghiệm thu).
  - Giá trị hợp đồng & tiến độ thanh toán.
  - Nghiệm thu, bảo hành, bảo trì.
  - Bản quyền mã nguồn, dữ liệu, bảo mật.

**Các điều khoản then chốt nên có:**

| Điều khoản | Nội dung gợi ý |
|---|---|
| Quyền sở hữu | Mã nguồn thuộc Bên A sau khi hoàn tất thanh toán đầy đủ |
| Bảo hành | Tối thiểu 30–90 ngày kể từ nghiệm thu, miễn phí sửa lỗi phát sinh |
| Bảo mật | Bên B không tiết lộ thông tin thí sinh, mật khẩu đội, dữ liệu cuộc thi |
| Thanh toán | Ví dụ: 30% đặt cọc → 40% khi bàn giao bản chạy thử → 30% khi nghiệm thu chính thức |
| Phạt vi phạm | Chậm tiến độ / chất lượng không đạt chuẩn / đơn phương huỷ |

### 4.2. Hợp đồng VẬN HÀNH & BẢO TRÌ (maintenance/SLA)

- **Mục đích:** duy trì hệ thống chạy ổn định trước – trong – sau sự kiện.
- **Nội dung:**
  - Giám sát server (uptime, lỗi realtime).
  - Backup dữ liệu định kỳ (Postgres + media).
  - Sửa lỗi khẩn cấp trong sự kiện (thời gian phản hồi ưu tiên).
  - Gói: **theo tháng** hoặc **theo sự kiện (tổ chức 1 lần).**
- **Phí tham khảo:** 15–20% giá trị phát triển / năm (bảo trì định kỳ), hoặc 3.000.000–8.000.000 VND / sự kiện (tùy quy mô).

### 4.3. Hợp đồng/HƯỚNG DẪN DỊCH VỤ NỀN TẢNG (cloud)

- **Đối tác:** Render (compute + Postgres), Cloudflare R2 (media), nhà cung cấp tên miền.
- **Hình thức:** Chấp thuận điều khoản dịch vụ (Terms) khi đăng ký tài khoản — hình thức hợp đồng điện tử tiêu chuẩn.
- **Lưu ý khi ký:**
  - Đăng ký tài khoản dưới tên / email của **đơn vị tổ chức** (không dùng tài khoản cá nhân).
  - Đảm bảo thông tin thanh toán, và điều khoản về xoá dữ liệu khi chấm dứt.
  - Ghi nhận lại chủ sở hữu tài khoản trong hợp đồng phát triển (nếu Bên B tạo trước rồi bàn giao thì phải chuyển quyền sở hữu).

### 4.4. Hợp đồng với TRƯỜNG / ĐƠN VỊ TỔ CHỨC SỰ KIỆN (nếu có người đặt hàng cuộc thi)

- **Bên tổ chức:** trường học / trung tâm tổ chức sự kiện.
- **Nội dung:** thuê nền tảng vận hành 1 kỳ thi (services), ban tổ chức chịu trách nhiệm nội dung câu hỏi, nhân sự MC, dữ liệu thí sinh.
- **Phí tham khảo:** theo cuộc thi (thường 5.000.000–30.000.000 VND/cuộc/buổi tùy quy mô và tùy biến).

---

## 5. TỔNG KẾT CHI PHÍ THEO GIAI ĐOẠN

| Giai đoạn | Hạ tầng | Nhân công | Ghi chú |
|---|---|---|---|
| **Thử nghiệm / demo** (hiện tại) | **$0 / tháng** | đã có sẵn | Render Free + R2 Free |
| **Cuộc thi thật** (Kịch bản A) | ~$14 / tháng | nếu có tùy biến mới | Nâng cấp Web + Postgres |
| **Cuộc thi thật** (Kịch bản B — VPS) | $5–12 / tháng | nếu có tùy biến mới | Rẻ hơn, tự vận hành |
| Phát triển từ đầu (nếu thuê ngoài) | — | 45–110 triệu VND | Tùy quy mô, đội ngũ |

### Khuyến nghị

1. **Giai đoạn demo:** giữ nguyên Render Free + R2 Free (**$0**), đủ để trình diễn.
2. **Trước ngày thi thật ít nhất 1 tuần:** nâng cấp Postgres lên gói trả phí để không bị mất dữ liệu sau 30 ngày và có backup; cân nhắc nâng Web Service lên Starter để hết sleep.
3. **Chốt rõ trong hợp đồng:** chủ tài khoản cloud thuộc bên nào, bảo hành bao lâu, dữ liệu và mã nguồn thuộc ai, mốc thanh toán, và điều khoản phạt.
4. **Luôn có backup dữ liệu trước buổi thi** (export Postgres + copy media sang nơi khác).

---

*Báo cáo được lập dựa trên cấu hình hiện tại của repo (render.yaml, DEPLOYMENT.md) và giá công bố chính thức của Render & Cloudflare R2 nửa cuối 2026. Giá có thể thay đổi — cần đối chiếu lại tại thời điểm ký hợp đồng.*