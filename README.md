# Mai Sơn Solar — Tư vấn pin Hybrid

Website Node.js 18+ để tính dung lượng pin Hybrid và nhận yêu cầu báo giá. Dự án dùng các mô-đun có sẵn của Node.js.

## Khởi chạy

```powershell
$env:HOST = '127.0.0.1'
$env:ADMIN_PASSWORD = 'mat-khau-ban-tu-dat'
npm start
```

- `http://127.0.0.1:3000/` hoặc `/tuvan` mở công cụ tính pin và gửi yêu cầu báo giá.
- `http://127.0.0.1:3000/admin` mở trang quản lý. Tài khoản ban đầu là `admin` với mật khẩu đã đặt khi khởi tạo.

Admin có báo giá và hồ sơ khách hàng, biểu giá EVN, cấu hình giao diện tư vấn và thông tin liên hệ, phân quyền, bảo trì và sao lưu. Admin có thể xuất hồ sơ ra CSV và gửi thông báo qua Telegram khi được cấu hình.

Phần khách nằm ở `public/index.html` và `public/js/app.js`. Trang Admin nằm ở `public/admin.html` và `public/js/admin.js`. Máy chủ và các endpoint nằm ở `server.js`, `routes/` và `lib/`. Giữ thư mục `data/` trên bộ nhớ bền vững nếu triển khai, vì cấu hình, dữ liệu đăng nhập và yêu cầu báo giá được lưu ở đó.

Dự án iOS nằm riêng trong `ios/`.
