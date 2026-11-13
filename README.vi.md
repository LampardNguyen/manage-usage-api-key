# Key Guard — proxy OpenAI với key con có giới hạn $

[English](README.md) | **Tiếng Việt**

Bạn có **một** OpenAI API key dùng chung. App này đứng giữa, cấp nhiều **key con** (`sk-tg-…`) cho các ứng dụng,
đếm token vào/ra của từng key con và chặn khi vượt giới hạn $.

```
App A ──(sk-tg-…)──▶ https://your-domain.example/openai-custom/v1/chat/completions ──(key chung)──▶ api.openai.com
```

- Tương thích OpenAI: App A chỉ đổi **base URL** và **API key**, request/response giữ nguyên format.
- **Luôn ghi đè** `model` (mặc định `gpt-6-luna`) và `reasoning_effort` (mặc định `none`) theo Cài đặt, bất kể client gửi gì.
- Chỉ mở `POST /v1/chat/completions`, **không hỗ trợ streaming**. Path khác trả 404.
- Token lấy từ trường `usage` OpenAI trả về (chính xác). $ = token × giá trong Cài đặt (ước tính).
- Không có chu kỳ reset: bộ đếm cộng dồn tới khi bạn bấm **Reset bộ đếm** cho từng key.

## Lỗi trả về cho App A (format OpenAI)

| HTTP | `error.code` | Khi nào |
|---|---|---|
| 401 | `invalid_api_key` | Key con sai hoặc đã xoá |
| 403 | `key_disabled` | Key con đang bị khoá |
| 429 | `quota_exceeded` | Đã dùng ≥ giới hạn $ — chờ quản trị reset |
| 400 | `stream_not_supported` / `invalid_body` | Gửi `stream: true` hoặc JSON hỏng |
| 502 | `upstream_error` | Không kết nối được OpenAI |
| khác | (của OpenAI) | Lỗi từ OpenAI được chuyển nguyên, **không** tính token |

**Lưu ý:** proxy chặn **trước** request, nên request cuối cùng có thể làm vượt giới hạn một chút (thường vài phần nghìn $ với request dịch text).

## Cài đặt

Yêu cầu **Node 16.15.1** (đã ghim trong `.nvmrc` và `package.json`).

```bash
npm install
cp .env.example .env    # rồi điền OPENAI_API_KEY và ADMIN_PASSWORD
```

| Biến | Ý nghĩa |
|---|---|
| `OPENAI_API_KEY` | Key OpenAI dùng chung (key thật) |
| `ADMIN_PASSWORD` | Mật khẩu trang quản trị |
| `PORT` | Cổng app (mặc định 3005) |
| `BASE_PATH` | Đường dẫn gốc, mặc định `/openai-custom` — phải khớp Apache |
| `BEHIND_HTTPS_PROXY` | `true` khi chạy sau Apache HTTPS |
| `UPSTREAM_TIMEOUT_SEC` | Thời gian chờ OpenAI (mặc định 120 giây) |
| `DATA_FILE` | Nơi lưu dữ liệu, mặc định `./data/db.json` |

## Chạy trên server bằng `screen`

```bash
screen -S keyguard
npm start
# Ctrl+A rồi D để thoát ra, app vẫn chạy. Quay lại: screen -r keyguard
```

Dừng app: vào lại `screen -r keyguard` rồi **Ctrl+C** — app ghi nốt dữ liệu trong RAM ra file trước khi thoát.
Không nên `kill -9` vì có thể mất tối đa ~2 giây số liệu cuối.

> `screen` không tự chạy lại app khi server khởi động lại hoặc app crash.

## Apache

Xem file mẫu [`deploy/apache-openai-custom.conf`](deploy/apache-openai-custom.conf): thêm vào VirtualHost HTTPS của
`your-domain.example`, bật `proxy proxy_http headers`, rồi reload Apache. Sau đó:

- Proxy: `https://your-domain.example/openai-custom/v1/chat/completions`
- Quản trị: `https://your-domain.example/openai-custom/admin/`
- Kiểm tra sống: `https://your-domain.example/openai-custom/health`

Nên giới hạn IP vào trang quản trị (đoạn tuỳ chọn ở cuối file mẫu).

## Lần đầu sử dụng

1. Vào trang quản trị → **Cài đặt** → nhập **giá model** (USD / 1 triệu token: input, cached input, output).
   Chưa nhập giá thì app chưa tính được $ và **chưa chặn được** key theo giới hạn $ (có banner đỏ nhắc).
2. **Keys → + Tạo key**: đặt tên và giới hạn $. Key chỉ hiện **một lần** — copy ngay.
3. Ở App A đổi cấu hình, ví dụ:

```bash
curl https://your-domain.example/openai-custom/v1/chat/completions \
  -H "Authorization: Bearer sk-tg-..." \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Dịch sang tiếng Anh: Xin chào"}]}'
```

Dùng SDK OpenAI: `baseURL = "https://your-domain.example/openai-custom/v1"`, `apiKey = "sk-tg-..."`.

## Trang quản trị

- **Keys**: danh sách key con, thanh % đã dùng so với giới hạn (vàng ≥ 80%, đỏ = hết), lọc theo trạng thái.
- **Chi tiết key**: $ và token từ lần reset gần nhất + tổng trọn đời, biểu đồ 31 ngày, sửa tên/giới hạn,
  **Reset bộ đếm**, **Khoá/Mở khoá**, **Xoá**, 50 request gần nhất.
- **Nhật ký**: 5.000 request gần nhất (token, $, thời gian xử lý, lỗi) và các thao tác quản trị.
- **Cài đặt**: model, reasoning effort (bỏ trống = không gửi), giá model. Đổi giá sẽ tính lại $ cho mọi token đã ghi nhận.

Server chỉ lưu **hash** của key con — lộ file `data/db.json` cũng không lấy lại được key.

## Chạy thử không tốn tiền

```bash
npm run mock    # terminal 1: OpenAI giả lập tại http://localhost:4010/v1
```

Trong `.env` đặt `OPENAI_BASE_URL=http://localhost:4010/v1` rồi `npm start` ở terminal 2.
Nội dung chứa `FAIL` → mock trả lỗi 400; chứa `CACHE` → mock trả 500 token cache.
**Nhớ xoá dòng `OPENAI_BASE_URL` (và `data/db.json`) trước khi chạy thật.**

## Cấu trúc

```
src/
  server.js   Ghép các phần, phục vụ UI, ghi dữ liệu khi tắt
  proxy.js    POST /v1/chat/completions: kiểm tra key con, ghi đè model, gọi OpenAI, đếm token
  admin.js    API trang quản trị: đăng nhập, key con, nhật ký, cài đặt
  store.js    Dữ liệu (file JSON, ghi gom mỗi 2 giây), tính $
  config.js   Đọc .env
web/          UI quản trị (HTML + Alpine.js + CSS, không cần build)
deploy/       Cấu hình Apache mẫu
scripts/mock-openai.js   OpenAI giả lập để chạy thử
```

## Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md). Báo lỗ hổng bảo mật theo [SECURITY.md](SECURITY.md).

## Giấy phép

[MIT](LICENSE)
