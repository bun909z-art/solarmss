# Hoàng Quân – Hệ thống Tư vấn Pin Lưu Trữ Hybrid (Node.js)

Ứng dụng web độc lập chạy trực tiếp trên **Node.js 18+** (0 thư viện ngoài, không cần `npm install`).

## Khởi chạy nhanh

```bash
node server.js
```

Mặc định chạy tại `http://localhost:3000`:
- `/` — Trang chủ (banner bài viết nổi bật trượt ngang, giải pháp nhanh, sản phẩm tiêu biểu)
- `/tuvan` — Công cụ tư vấn dung lượng Pin Hybrid & gợi ý Combo
- `/products` — Danh mục sản phẩm, phụ kiện & trang chi tiết độc lập (`/products?id=...`)
- `/news` — Tin tức & trang bài viết độc lập (`/news?id=...`)
- `/admin` — Trang quản trị & phân quyền (mặc định: `admin` / `admin123`)

## Cấu trúc thư mục (đã tách mô-đun dễ bảo trì)

```
hoangquan-pin-hybrid/
├── server.js                  # Điểm khởi chạy & điều phối chính (~60 dòng)
├── lib/                       # Xử lý dữ liệu & nghiệp vụ cốt lõi
│   ├── auth.js                # Mã hóa mật khẩu (scrypt), ký token (HMAC) & RBAC
│   ├── calculator.js          # Công thức tính bậc thang EVN & dung lượng pin lưu trữ
│   ├── http-helpers.js        # Tiện ích JSON/Static, tiêm CSS SSR & cổng Bảo trì
│   ├── leads.js               # Lưu & xuất CSV dữ liệu khách hàng (CRM)
│   ├── news.js                # Quản lý bài viết Tin tức
│   ├── products.js            # Quản lý Kho sản phẩm, Phụ kiện & nhập/xuất Excel
│   ├── store.js               # Lưu cấu hình giao diện, Trang chủ, Bảo trì & tài khoản
│   └── xlsx-lite.js           # Đọc/ghi Excel (.xlsx) & tách ảnh nhúng không cần thư viện
├── routes/                    # Định tuyến API & Trang theo từng nghiệp vụ
│   ├── public-api.js          # API công khai (/api/config, /calculate, /products, /news, /leads)
│   ├── admin-auth.js          # Đăng nhập, đổi mật khẩu & quản lý tài khoản phân quyền
│   ├── admin-config.js        # Lưu cấu hình, chế độ Bảo trì & Sao lưu/Khôi phục toàn bộ
│   ├── admin-catalog.js       # Quản lý Sản phẩm, Tin tức, Khách hàng & tải tệp/ảnh
│   └── pages.js               # Định tuyến các trang HTML & tệp tĩnh
├── public/
│   ├── home.html, index.html, products.html, news.html, admin.html
│   ├── css/
│   │   ├── app.css            # Tệp gom @import 4 mô-đun CSS bên dưới
│   │   ├── base.css           # Biến màu, header, nav, card, dark mode
│   │   ├── calculator.css     # Bố cục công cụ tính EVN, Combo & bản in PDF
│   │   ├── catalog.css        # Sản phẩm, trang chi tiết, Tin tức & slider Trang chủ
│   │   ├── effects.css        # Hiệu ứng chuyển động v3 & chống sao chép ảnh
│   │   └── admin.css          # Giao diện trang Quản trị
│   └── js/
│       ├── app.js, home-page.js, products-page.js, news-page.js
│       ├── calculator.js, combo.js, img-protect.js
│       └── admin/             # Tách riêng 7 mô-đun giao diện quản trị
│           ├── core.js        # Trạng thái dùng chung, gọi API, đăng nhập/đăng xuất
│           ├── config-ui.js   # Thương hiệu, Trang chủ, Giao diện, Bố cục, EVN, Chân trang
│           ├── products-ui.js # Kho sản phẩm, trạng thái kho, Datasheet & Excel
│           ├── news-ui.js     # Quản lý Tin tức & bài nổi bật
│           ├── leads-ui.js    # Quản lý Khách hàng & xuất CSV
│           ├── system-ui.js   # Bảo trì 404/1-trang, Sao lưu toàn bộ & Phân quyền tài khoản
│           └── init.js        # Khởi tạo tab, xem trước trực tiếp & kiểm tra phiên
├── data/                      # Lưu dữ liệu JSON (config, products, news, leads, admin-auth)
└── public/uploads/            # Lưu ảnh & tài liệu PDF/Datasheet tải lên
```
