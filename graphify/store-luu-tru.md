# Store — lưu trữ dữ liệu

## Mục đích

Giữ toàn bộ trạng thái (cài đặt, key con, log) trong RAM và đồng bộ ra một file JSON.

## File chính

- `src/store.js` — class `Store`
- `data/db.json` — file dữ liệu (mặc định, đổi bằng `DATA_FILE`; bị `.gitignore`)

## Luồng xử lý

- Khởi tạo: tạo thư mục, đọc file nếu có, merge với `defaults()` (merge nông, `settings` merge 1 cấp),
  dựng `byHash: Map<hash, key>`, rồi `saveNow()` ngay.
- `save()` hẹn giờ ghi sau `SAVE_DELAY_MS = 2000` (gom nhiều thay đổi); `saveNow()` ghi ngay.
- Ghi an toàn: ghi `db.json.tmp` rồi `rename` đè file chính.
- Cấu trúc dữ liệu:

```
{ settings: { model, reasoningEffort, prices: { input, cached_input, output } },
  keys: { [id]: Key },          // xem [[key-con]]
  requests: [ { at, keyId, status, ms, input?, cached?, output?, error? } ],  // mới nhất ở đầu
  events:   [ { at, type, message, keyId } ] }                            // thao tác quản trị
```

- Giới hạn: `MAX_REQUESTS = 5000`, `MAX_EVENTS = 1000`, `DAILY_KEEP_DAYS = 90` (cắt khi tạo ngày mới).

## Phụ thuộc

`fs`, `crypto`. Được dùng bởi [[proxy-chat-completions]] và [[admin-api]].

## Lưu ý / bẫy

- Ghi đồng bộ (`writeFileSync`) toàn bộ file mỗi lần → file lớn dần theo log, nhưng bị chặn bởi các giới hạn trên.
- `kill -9` có thể mất tối đa ~2 giây dữ liệu chưa ghi.
- File JSON hỏng → `JSON.parse` ném lỗi, app không khởi động.
- Ngày (`today()`) theo **UTC** (`toISOString`), không theo giờ địa phương.
- Admin sửa trực tiếp object key (`k.name = …`) rồi gọi `store.save()` — không có lớp model riêng.

## Liên quan

[[key-con]] · [[tinh-chi-phi-va-gioi-han]] · [[kien-truc-tong-quan]]
