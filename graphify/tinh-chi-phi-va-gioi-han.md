# Tính chi phí và giới hạn $

## Mục đích

Quy đổi token thành $ ước tính và quyết định khi nào chặn một key con.

## File chính

- `src/store.js` — `pricesReady()`, `usdOf(c)`, `isOverLimit(key)`
- `src/admin.js` — `keyView(k)` tính `pct` và `status`

## Luồng xử lý

- Giá lưu ở `settings.prices` = USD / 1 triệu token: `input`, `cached_input`, `output` (mặc định `null`).
- `pricesReady()` = cả 3 giá là số ≥ 0.
- `usdOf(c) = (c.input × input + c.cached × cached_input + c.output × output) / 1e6`; chưa có giá → 0.
- `isOverLimit(key)` = `usdLimit != null` **và** `pricesReady()` **và** `usdOf(key.used) >= usdLimit`.
- Trạng thái hiển thị (`keyView`): `disabled` > `over` > `warn` (≥ 80%) > `unlimited` (không có giới hạn) > `ok`.

## Phụ thuộc

[[store-luu-tru]] · [[key-con]] · [[admin-api]] (`PUT /settings` sửa giá)

## Lưu ý / bẫy

- **Chưa đặt giá thì không key nào bị chặn** — server in cảnh báo khi khởi động, UI có banner đỏ.
- $ **không được lưu**, luôn tính lại từ token × giá hiện tại → đổi giá sẽ đổi $ của mọi dữ liệu cũ,
  kể cả log request (`requestView`).
- Giới hạn so với `key.used` (từ lần reset gần nhất), không phải `lifetime`.
- Không có chu kỳ reset tự động.

## Liên quan

[[proxy-chat-completions]] · [[key-con]] · [[giao-dien-quan-tri]]
