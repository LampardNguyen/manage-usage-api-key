# Kiến trúc tổng quan

## Mục đích

Proxy đứng giữa các app và OpenAI: app dùng key con `sk-tg-…`, proxy gọi OpenAI bằng một key chung,
đếm token theo từng key con và chặn khi vượt giới hạn $.

## File chính

- `src/server.js` — ghép mọi phần, lắng nghe cổng, xử lý tắt
- `src/config.js` — đọc `.env` ([[cau-hinh-env]])
- `src/proxy.js` — router `/v1` ([[proxy-chat-completions]])
- `src/admin.js` — router `/admin/api` ([[admin-api]])
- `src/store.js` — dữ liệu ([[store-luu-tru]])
- `web/` — UI quản trị ([[giao-dien-quan-tri]])

## Luồng xử lý

Tất cả route nằm dưới `config.basePath` (mặc định `/openai-custom`), mount theo thứ tự trong `server.js`:

1. `GET /health` → `{ ok: true }`
2. `/v1` → proxy router
3. `/admin/api` → admin router
4. `GET /admin/vendor/alpine.js` → file Alpine trong `node_modules` (không dùng CDN)
5. `GET /admin` (không `/` cuối) → redirect sang `/admin/`
6. `/admin` → static `web/`

Một instance `Store` dùng chung cho cả proxy và admin.
Khi nhận `SIGINT`/`SIGTERM`: `store.saveNow()` rồi đóng server, ép thoát sau 3 giây.

## Phụ thuộc

- `express` 4, `dotenv`, `alpinejs` (phục vụ file tĩnh). Node **16.15.1** — chưa có `fetch`,
  nên proxy dùng module `http`/`https`.

## Lưu ý / bẫy

- Không có database: toàn bộ trạng thái nằm trong RAM + một file JSON → chỉ chạy **một** process.
  Chạy nhiều instance sẽ ghi đè dữ liệu của nhau.
- `trust proxy` chỉ bật khi `BEHIND_HTTPS_PROXY=true`; ảnh hưởng `req.ip` ([[xac-thuc-quan-tri]]).

## Liên quan

[[proxy-chat-completions]] · [[store-luu-tru]] · [[admin-api]] · [[trien-khai-apache]]
