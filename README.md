# Hoàng Quân – Ứng dụng Tư vấn Pin lưu trữ Hybrid (Node.js + Trang Admin)

Ứng dụng web triển khai bằng **Node.js thuần (không cần cài thêm thư viện ngoài)** giúp tư vấn dung lượng pin lưu trữ điện mặt trời Hybrid từ hóa đơn điện EVN hoặc sản lượng kWh, tích hợp **trang quản trị Admin (`/admin`)** cho phép thay đổi chi tiết giao diện, màu sắc, bố cục, logo và biểu giá EVN với chế độ xem trước trực tiếp (Live Preview).

## Yêu cầu hệ thống
- Node.js phiên bản **18 trở lên** (`node -v`).

## Cách chạy nhanh

1. Giải nén thư mục dự án và mở Terminal tại thư mục `hoangquan-pin-hybrid`.
2. Khởi chạy máy chủ (không cần `npm install`):

```bash
npm start
# hoặc
node server.js
```

3. Truy cập trên trình duyệt:
- **Trang tư vấn khách hàng:** `http://localhost:3000`
- **Trang quản trị Admin:** `http://localhost:3000/admin`
- **Mật khẩu Admin mặc định:** `admin123` (có thể đổi ngay trong mục **Bảo mật & Backup** trên trang Admin).

## Tùy chọn biến môi trường
- `PORT`: Đổi cổng chạy server (mặc định `3000`), ví dụ: `PORT=8080 node server.js`.
- `ADMIN_PASSWORD`: Đặt mật khẩu quản trị ban đầu trước lần chạy đầu tiên.

## Tính năng nổi bật
- **Giao diện tư vấn hiện đại:** Thiết kế tối ưu cho desktop & điện thoại, hỗ trợ sao chép nhanh kết quả tư vấn (gửi Zalo/Messenger), chọn nhanh dung lượng module pin phổ biến (`5.12`, `10.24`, `14.33`, `15.36 kWh`), và in/lưu phiếu tư vấn PDF sắc nét.
- **Trang Admin Studio (`/admin`) có Live Preview:**
  - **Thương hiệu:** Tải lên logo mới (PNG/JPG/WebP/SVG), chỉnh kích thước logo, tên công ty, quản lý danh sách Hotline.
  - **Màu sắc & Hero:** 5 bộ giao diện mẫu (bao gồm Dark Mode), bảng chọn màu chi tiết từng thành phần, độ bo góc, đổ bóng, độ rộng khung, phông chữ, kiểu nền và nội dung Banner Hero.
  - **Bố cục & Tiêu đề:** Bật/tắt độc lập từng khối chức năng và tùy chỉnh toàn bộ tiêu đề mục.
  - **Thông số & Biểu giá EVN:** Chỉnh sửa trực tiếp biểu giá điện 5 bậc EVN, VAT, các mốc chọn nhanh và thông số pin mặc định cho toàn bộ người dùng.
  - **Bảo mật & Sao lưu:** Đổi mật khẩu quản trị (mã hóa `scrypt` + phiên cookie `HttpOnly` ký `HMAC-SHA256`), xuất/nhập tệp sao lưu `config.json`.
