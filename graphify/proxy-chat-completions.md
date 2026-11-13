# Proxy `POST /v1/chat/completions`

## Mục đích

Endpoint duy nhất cho App A, tương thích format OpenAI. App chỉ đổi base URL và API key.

## File chính

- `src/proxy.js` — `createProxyRouter(store)`, `callUpstream(payload)`, `oaError(...)`

## Luồng xử lý

1. `express.json({ limit: '2mb' })` parse body.
2. Lấy token từ `Authorization: Bearer …` → `store.findByToken` (so hash, xem [[key-con]]).
   - Không thấy → 401 `invalid_api_key`
   - `disabled` → 403 `key_disabled`
   - `store.isOverLimit(key)` → ghi log, 429 `quota_exceeded` ([[tinh-chi-phi-va-gioi-han]])
3. Body không phải object → 400 `invalid_body`; `stream: true` → 400 `stream_not_supported`.
4. Ghi đè: `model = settings.model`; `reasoning_effort = settings.reasoningEffort`, nếu rỗng thì **xoá** khỏi payload.
5. `callUpstream` gửi tới `${OPENAI_BASE_URL}/chat/completions` bằng key chung, timeout `UPSTREAM_TIMEOUT_SEC`.
   Lỗi mạng/timeout → log + 502 `upstream_error`.
6. Nếu HTTP 200 và có `usage`:
   `cached = min(prompt_tokens_details.cached_tokens, prompt_tokens)`,
   `input = prompt_tokens - cached`, `output = completion_tokens` → `store.recordUsage`.
   Status khác 200 → chỉ ghi `error` vào log, **không** tính token.
7. `store.logRequest(entry)` rồi trả nguyên status + body của OpenAI cho client.
8. Mọi path/method khác trong `/v1` → 404 `not_found`. Lỗi parse JSON → 400 (hoặc 413 nếu quá 2 MB).

## Phụ thuộc

[[store-luu-tru]] · [[key-con]] · [[cau-hinh-env]] (`openaiKey`, `upstreamUrl`, `upstreamTimeoutMs`)

## Lưu ý / bẫy

- Chặn giới hạn **trước** khi gọi, nên request cuối có thể vượt giới hạn một chút.
- Hai request đồng thời của cùng key đều qua kiểm tra rồi mới cộng dồn → có thể vượt nhiều hơn khi tải cao.
- Không hỗ trợ streaming; muốn thêm phải tách đếm token theo `stream_options.include_usage`.
- `input` lưu trong store là token **không cache**, khác `prompt_tokens` của OpenAI.

## Liên quan

[[tinh-chi-phi-va-gioi-han]] · [[key-con]] · [[mock-openai]] · [[kien-truc-tong-quan]]
