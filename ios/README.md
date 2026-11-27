# Mai Sơn Solar cho iPhone

Ứng dụng iOS 17 trở lên dùng SwiftUI và WebKit. App mở thẳng trang chủ `https://solarmss.onrender.com/`. Tư vấn tính pin, yêu cầu báo giá, kho thiết bị, tin tức, liên hệ và Demo 3D dùng dữ liệu từ website. Bộ phận kinh doanh tiếp tục nhận yêu cầu ở mục **Khách hàng** trong Admin trên Safari.

## Dùng trên iPhone

1. Mở `MaiSonSolar.xcodeproj` trên máy Mac bằng Xcode. Chọn scheme **MaiSonSolar**.
2. Với iPhone thật, chọn **Signing & Capabilities**, bật ký tự động và chọn Team của bạn. Đổi Bundle Identifier nếu cần để dùng định danh đã đăng ký cho công ty.
3. Chọn thiết bị và bấm **Run**. Với iPhone Simulator, có thể chạy trực tiếp. Bản dựng tự động nằm trong mục **Actions → iOS Builds** trên GitHub.

Để tải gói dành cho iPhone thật, mở lượt chạy **iOS Builds** và tải artifact **MaiSonSolar-iPhone-IPA-unsigned**. Giải nén tệp tải xuống để lấy `MaiSonSolar-unsigned.ipa`. Gói này chứa bản Release arm64 và cần được ký trước khi cài lên iPhone.

App tải website qua HTTPS. Để lưu và mở phương án, máy chủ phải chạy bản web có `MaiSonSolarPlans` trong Demo 3D. Sau khi mở Demo và bố trí xong, bấm **Lưu phương án** ngay trên thanh điều hướng dưới cùng. Mục **Đã lưu** giữ các phương án trên thiết bị và cho phép chọn hai phương án để so sánh. App báo lại nếu một thiết bị trong phương án đã thay đổi khỏi danh mục khi mở lại.

## Phát hành

Để cài qua TestFlight hoặc App Store, cần ký bản dựng bằng tài khoản Apple Developer của công ty. Dự án có manifest quyền riêng tư để khai báo dữ liệu dùng trong luồng tư vấn. Trước khi phát hành, đối chiếu thông tin quyền riêng tư trên App Store Connect với website thực tế và cấu hình Google Sheets, Telegram của công ty.
