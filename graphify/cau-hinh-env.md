# Cấu hình môi trường

## Mục đích

Đọc `.env` thành object `config` dùng chung.

## File chính

- `src/config.js`
- `.env.example` — mẫu (`.env` thật bị `.gitignore`)

## Luồng xử lý

| Biến | Trường `config` | Mặc định |
|---|---|---|
| `OPENAI_API_KEY` | `openaiKey` | bắt buộc |
| `ADMIN_PASSWORD` | `password` | bắt buộc |
| `OPENAI_BASE_URL` | `upstreamUrl` | `https://api.openai.com/v1` (bỏ `/` cuối) |
| `PORT` | `port` | `3005` |
| `BASE_PATH` | `basePath` | `/openai-custom`; chuẩn hoá thành `/xxx`, hoặc `""` nếu là `/` |
| `BEHIND_HTTPS_PROXY` | `behindHttpsProxy` | `false` (chỉ đúng khi là chuỗi `true`) |
| `UPSTREAM_TIMEOUT_SEC` | `upstreamTimeoutMs` | `120` giây |
| `DATA_FILE` | `dataFile` | `./data/db.json` (resolve tuyệt đối) |
| `MOCK_PORT` | (chỉ `scripts/mock-openai.js`) | `4010` |

Thiếu biến bắt buộc → in lỗi và `process.exit(1)`.

## Phụ thuộc

`dotenv`, đọc `.env` ở gốc repo (không phụ thuộc thư mục chạy lệnh).

## Lưu ý / bẫy

- `config.js` thoát process ngay khi được `require` nếu thiếu biến → mọi module require nó đều chịu ảnh hưởng.
- Nhớ xoá `OPENAI_BASE_URL` sau khi thử với [[mock-openai]].

## Liên quan

[[kien-truc-tong-quan]] · [[trien-khai-apache]] · [[mock-openai]]
