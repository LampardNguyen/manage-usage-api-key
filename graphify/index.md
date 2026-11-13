# Bản đồ tri thức — Key Guard

Chỉ mục gốc (MOC). Đọc file này trước khi phân tích một chức năng, rồi mở note liên quan.
Thêm/xoá note thì cập nhật danh sách dưới đây trong cùng commit.

## Tổng quan

- [[kien-truc-tong-quan]] — các thành phần, thứ tự mount route, vòng đời process

## Luồng proxy (phía App A)

- [[proxy-chat-completions]] — `POST /v1/chat/completions`: kiểm tra key, ghi đè model, gọi OpenAI, đếm token
- [[tinh-chi-phi-va-gioi-han]] — công thức $, khi nào bị chặn 429, trạng thái key

## Dữ liệu

- [[store-luu-tru]] — file JSON, ghi gom 2 giây, giới hạn log
- [[key-con]] — cấu trúc key con, hash, bộ đếm used/lifetime/daily

## Quản trị

- [[xac-thuc-quan-tri]] — đăng nhập, session cookie, chặn đoán mật khẩu
- [[admin-api]] — các endpoint `/admin/api/*`
- [[giao-dien-quan-tri]] — UI Alpine.js trong `web/`

## Vận hành

- [[cau-hinh-env]] — biến môi trường trong `src/config.js`
- [[trien-khai-apache]] — reverse proxy Apache, `BASE_PATH`, chạy bằng `screen`
- [[mock-openai]] — server OpenAI giả lập để chạy thử
