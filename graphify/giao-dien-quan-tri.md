# Giao diện quản trị

## Mục đích

UI một trang để quản lý key con, xem nhật ký và cài đặt. Không cần build.

## File chính

- `web/index.html` — markup + directive Alpine (`x-data="app()"`)
- `web/app.js` — hàm `app()` chứa state và method
- `web/style.css`
- Alpine.js phục vụ từ `node_modules` qua `/admin/vendor/alpine.js` ([[kien-truc-tong-quan]])

## Luồng xử lý

- `init()`: gọi `GET me`; nếu đã đăng nhập → `refresh()` (`GET state`) rồi `route()`.
  Tự refresh mỗi 15 giây (trừ khi đang mở hộp tạo key).
- Điều hướng bằng hash: `#/` danh sách key, `#/key/<id>` chi tiết, `#/logs` nhật ký, `#/settings` cài đặt.
- `api(method, path, body)` gọi đường dẫn tương đối `api/<path>` → chạy được dưới mọi `BASE_PATH`.
  Gặp 401 thì chuyển về màn hình đăng nhập.
- Màu thanh % dùng `pct`/`status` do server tính ([[tinh-chi-phi-va-gioi-han]]).

## Phụ thuộc

[[admin-api]] · [[xac-thuc-quan-tri]]

## Lưu ý / bẫy

- Phải truy cập đúng `/admin/` (có `/` cuối) để đường dẫn tương đối đúng — server tự redirect.
- Định dạng số theo `vi-VN`.
- Token key mới chỉ hiện trong hộp tạo key; đóng hộp là mất.

## Liên quan

[[admin-api]] · [[key-con]]
