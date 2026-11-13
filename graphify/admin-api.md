# Admin API `/admin/api`

## Mục đích

API JSON cho UI quản trị: key con, nhật ký, cài đặt.

## File chính

- `src/admin.js` — `createAdminRouter(store)`; helper `counterView`, `keyView`, `requestView`, `parseName`, `parseLimit`, `findKey`

## Luồng xử lý

Body JSON tối đa 100 KB. Mọi route (trừ `login`/`logout`/`me`) cần đăng nhập ([[xac-thuc-quan-tri]]).

| Method | Path | Việc làm |
|---|---|---|
| GET | `/state` | Danh sách key (`keyView`), model/reasoning, `pricesReady`, `endpoint` |
| POST | `/keys` | Tạo key `{ name, usdLimit }` → trả `{ key, token }` |
| GET | `/keys/:id` | Chi tiết + 31 ngày `daily` + 50 request + 50 event của key |
| PATCH | `/keys/:id` | Sửa `name`, `usdLimit`, `disabled` |
| POST | `/keys/:id/reset` | Reset bộ đếm `used` |
| DELETE | `/keys/:id` | Xoá, cần `{ confirmName }` trùng tên |
| GET | `/requests?keyId=&errorsOnly=1` | Tối đa 500 log request |
| GET | `/events` | Tối đa 500 thao tác quản trị |
| GET/PUT | `/settings` | Đọc/ghi `model`, `reasoningEffort`, `prices` |

- Validate: tên 1–60 ký tự; `usdLimit` rỗng = không giới hạn, ngược lại phải > 0; giá rỗng = `null`, ngược lại ≥ 0.
- Mỗi thay đổi ghi một event (`key_created`, `key_updated`, `key_reset`, `key_deleted`, `settings_changed`).

## Phụ thuộc

[[store-luu-tru]] · [[key-con]] · [[tinh-chi-phi-va-gioi-han]]

## Lưu ý / bẫy

- Lỗi trả dạng `{ error: "<thông báo tiếng Việt>" }`, khác format OpenAI của proxy.
- Biểu đồ 31 ngày tính ngày theo UTC.
- `PUT /settings` ghi đè cả 3 giá cùng lúc; gửi thiếu giá nào thì giá đó thành `null` → tắt chặn theo $.

## Liên quan

[[giao-dien-quan-tri]] · [[xac-thuc-quan-tri]] · [[key-con]]
