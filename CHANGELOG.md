# Changelog

Mỗi ngày một mục `## YYYY-MM-DD`, mục mới nhất ở trên đầu.

## 2026-11-13

- Phát hành bản đầu (1.0.0): proxy `POST /v1/chat/completions` tương thích OpenAI, cấp key con `sk-tg-…` có giới hạn $.
- Đếm token theo `usage` của OpenAI, ước tính $ theo giá model cấu hình; luôn ghi đè `model` và `reasoning_effort`.
- Trang quản trị: quản lý key, biểu đồ 31 ngày, nhật ký request/thao tác, cài đặt.
- Lưu dữ liệu file JSON (ghi gom mỗi 2 giây, ghi nốt khi tắt); server OpenAI giả lập và cấu hình Apache mẫu.
- Khởi tạo git, thêm remote `origin` (GitHub).
- Thêm tài liệu mã nguồn mở: `README.md` (tiếng Anh), `README.vi.md`, `LICENSE` (MIT), `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, mẫu issue/PR trong `.github/`; thay domain nội bộ bằng `your-domain.example`.
- Thêm `CLAUDE.md` cho dự án (quy tắc changelog theo ngày, bản đồ tri thức `graphify/`).
- Tạo bản đồ tri thức `graphify/`: `index.md` (MOC) và 11 note về kiến trúc, proxy, tính $/giới hạn, store,
  key con, xác thực, admin API, UI, cấu hình, triển khai Apache, mock OpenAI.
