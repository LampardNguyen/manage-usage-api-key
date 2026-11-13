# Xác thực trang quản trị

## Mục đích

Bảo vệ `/admin/api/*` bằng một mật khẩu duy nhất (`ADMIN_PASSWORD`).

## File chính

- `src/admin.js` — `readCookie`, `setCookie`, `passwordMatches`, `isAuthed`, route `/login`, `/logout`, `/me`

## Luồng xử lý

1. `POST /login { password }`: so sánh bằng `timingSafeEqual` trên sha256 của hai chuỗi.
2. Sai 5 lần liên tiếp từ cùng `req.ip` → khoá IP đó 15 phút (429).
3. Đúng → tạo session token 32 byte ngẫu nhiên, lưu `sessions: Map<token, hết hạn>` (TTL 12 giờ),
   set cookie `tg_admin` (`HttpOnly`, `SameSite=Strict`, `Path=BASE_PATH`, thêm `Secure` khi sau HTTPS).
4. `GET /me` trả `{ authed }` (không cần đăng nhập).
5. Middleware sau `/me`: mọi route còn lại trả 401 nếu chưa đăng nhập.
6. `POST /logout` xoá session và cookie.

## Phụ thuộc

[[cau-hinh-env]] (`ADMIN_PASSWORD`, `BEHIND_HTTPS_PROXY`, `BASE_PATH`)

## Lưu ý / bẫy

- Session và bộ đếm sai mật khẩu nằm trong **RAM** → khởi động lại app là đăng xuất hết và reset bộ đếm.
- Không bật `BEHIND_HTTPS_PROXY` khi chạy sau proxy thì `req.ip` là IP của proxy → một người đoán sai
  có thể khoá tất cả mọi người.
- Map `failures` không được dọn định kỳ.
- Không có CSRF token; dựa vào `SameSite=Strict` + body JSON.

## Liên quan

[[admin-api]] · [[giao-dien-quan-tri]] · [[trien-khai-apache]]
