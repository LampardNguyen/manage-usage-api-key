# Mock OpenAI

## Mục đích

Server giả lập `POST /v1/chat/completions` để chạy thử proxy mà không tốn tiền.

## File chính

- `scripts/mock-openai.js` — chạy bằng `npm run mock`, cổng `MOCK_PORT` (mặc định 4010)

## Luồng xử lý

- Thiếu header `Authorization: Bearer` → 401. Sai path/method → 404.
- Nội dung message chứa `FAIL` → 400 `mock_error` (thử nhánh lỗi không tính token).
- Trả `usage`: `prompt_tokens = 1000 + độ dài text`, `completion_tokens = 400`,
  `cached_tokens = 500` nếu text chứa `CACHE`.
- Message cuối là mảng JSON chuỗi → trả mảng cùng độ dài, mỗi phần tử thêm `[dịch]`.
- In ra console `model` và `reasoning_effort` nhận được → kiểm tra việc ghi đè.

## Phụ thuộc

Chỉ module `http`. Proxy trỏ tới bằng `OPENAI_BASE_URL=http://localhost:4010/v1` ([[cau-hinh-env]]).

## Lưu ý / bẫy

- Body không phải JSON hợp lệ làm mock ném lỗi (không có try/catch quanh `JSON.parse(raw)`).
- Dữ liệu tạo ra khi thử nằm trong `data/db.json` — xoá trước khi chạy thật.

## Liên quan

[[proxy-chat-completions]] · [[cau-hinh-env]]
