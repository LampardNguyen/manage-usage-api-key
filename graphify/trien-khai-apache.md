# Triển khai sau Apache

## Mục đích

Chạy app trên server, công khai qua HTTPS dưới tiền tố `BASE_PATH`.

## File chính

- `deploy/apache-openai-custom.conf` — đoạn cấu hình thêm vào `<VirtualHost *:443>`
- `.nvmrc` / `package.json` — ghim Node 16.15.1

## Luồng xử lý

- Apache `ProxyPass /openai-custom/ → http://127.0.0.1:3005/openai-custom/` (giữ nguyên tiền tố,
  app tự xử lý `BASE_PATH`), `ProxyTimeout 150`, set `X-Forwarded-Proto: https`.
- `/openai-custom` (không `/` cuối) redirect 301 sang `/openai-custom/admin/`.
- Tuỳ chọn: `Require ip …` cho `/openai-custom/admin/`.
- Cần module `proxy proxy_http headers`.
- Chạy app trong `screen -S keyguard` + `npm start`; dừng bằng Ctrl+C để ghi dữ liệu.

## Phụ thuộc

[[cau-hinh-env]] (`BASE_PATH`, `PORT`, `BEHIND_HTTPS_PROXY`, `UPSTREAM_TIMEOUT_SEC`)

## Lưu ý / bẫy

- `ProxyTimeout` nên ≥ `UPSTREAM_TIMEOUT_SEC`, nếu không Apache cắt trước khi OpenAI trả lời.
- `BASE_PATH` phải khớp tiền tố trong Apache.
- `screen` không tự khởi động lại khi crash/reboot.
- Domain trong file mẫu là `your-domain.example` — thay bằng domain thật khi triển khai.

## Liên quan

[[kien-truc-tong-quan]] · [[xac-thuc-quan-tri]] · [[cau-hinh-env]]
