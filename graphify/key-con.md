# Key con

## Mục đích

Mỗi app nhận một key `sk-tg-…` riêng, có bộ đếm và giới hạn $ riêng.

## File chính

- `src/store.js` — `createKey`, `findByToken`, `deleteKey`, `resetKey`, `recordUsage`, `dayBucket`
- `src/admin.js` — endpoint tạo/sửa/reset/xoá ([[admin-api]])

## Luồng xử lý

- Tạo: `token = "sk-tg-" + base64url(24 byte ngẫu nhiên)`; chỉ lưu `hash = sha256(token)` và
  `hint = 9 ký tự đầu … 4 ký tự cuối`. Token trả về **một lần** trong response tạo key.
- Cấu trúc:

```
{ id: "k_<12 hex>", name, hash, hint, createdAt, lastUsedAt, disabled, usdLimit (null = không giới hạn),
  used:     { input, cached, output, requests, since },   // từ lần reset gần nhất
  lifetime: { input, cached, output, requests },          // trọn đời
  daily:    { "YYYY-MM-DD": { input, cached, output, requests } } }  // giữ 90 ngày
```

- Tra cứu: `findByToken` hash token rồi tra `byHash` (O(1)).
- `recordUsage` cộng vào cả `used`, `lifetime` và bucket ngày hôm nay, cập nhật `lastUsedAt`.
- `resetKey` chỉ đặt lại `used` (và `since`), giữ `lifetime` và `daily`.

## Phụ thuộc

[[store-luu-tru]] · [[tinh-chi-phi-va-gioi-han]]

## Lưu ý / bẫy

- Mất token thì không lấy lại được — chỉ có thể tạo key mới.
- Xoá key cần gửi `confirmName` trùng tên key. Log request cũ vẫn giữ `keyId`, hiển thị "(đã xoá)".
- Đổi `hash` thì phải cập nhật `byHash`; hiện chỉ `createKey`/`deleteKey` đụng tới map này.

## Liên quan

[[proxy-chat-completions]] · [[admin-api]] · [[giao-dien-quan-tri]]
