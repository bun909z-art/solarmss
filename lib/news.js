'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NEWS_PATH = path.join(DATA_DIR, 'news.json');

let memNews = null;

function getDefaultNews() {
  return [
    {
      id: 'news-chon-pin-luu-tru',
      title: 'Kinh nghiệm chọn dung lượng Pin lưu trữ Lithium phù hợp hóa đơn điện gia đình',
      category: 'Kiến thức Hybrid',
      author: 'Kỹ thuật Hoàng Quân',
      publishedAt: '2026-11-20',
      imageUrl: '/assets/prod-battery.jpg',
      summary: 'Hướng dẫn cách quy đổi từ tiền điện hàng tháng sang dung lượng pin LFP (5,12 kWh – 15,36 kWh) để tránh lãng phí và đảm bảo đủ điện dùng ban đêm.',
      content: `Khi đầu tư hệ thống Điện Mặt Trời Hybrid có lưu trữ, câu hỏi phổ biến nhất là nên lắp bao nhiêu kWh pin Lithium để vừa tối ưu chi phí đầu tư, vừa đủ điện sinh hoạt buổi tối và dự phòng khi mất điện lưới.

Bước 1: Xác định sản lượng điện tiêu thụ trung bình mỗi ngày
Bạn chỉ cần lấy số kWh trên hóa đơn điện chia cho 30 ngày. Ví dụ gia đình dùng 600 kWh/tháng sẽ tiêu thụ trung bình 20 kWh/ngày.

Bước 2: Ước tính tỷ lệ dùng điện buổi tối (sau 17h30)
Với phần lớn hộ gia đình đi làm ban ngày và bật điều hòa, bếp từ, máy giặt vào buổi tối, lượng điện tiêu thụ buổi tối thường chiếm 60% – 70% tổng sản lượng ngày (tương đương 12 – 14 kWh).

Bước 3: Tính hệ số xả sâu (DoD) và hiệu suất Inverter
Pin Lithium LiFePO4 (LFP) Grade A cho phép xả sâu 90% an toàn với tuổi thọ trên 6.000 chu kỳ. Vì vậy với nhu cầu 9 – 10 kWh ban đêm, lắp 2 module 5,12 kWh (tổng 10,24 kWh) hoặc 1 tủ 10,24 kWh là phương án cân bằng nhất.

Bạn có thể sử dụng trực tiếp công cụ Tư vấn Pin Hybrid trên trang chủ để hệ thống tự động tính toán và gợi ý cấu hình Combo phù hợp nhất cho gia đình mình.`,
      published: true,
      featured: true
    },
    {
      id: 'news-loi-ich-hybrid-mua-nang',
      title: 'Vì sao Điện Mặt Trời Hybrid là giải pháp tối ưu chống mất điện mùa nắng nóng?',
      category: 'Kiến thức Hybrid',
      author: 'Kỹ thuật Hoàng Quân',
      publishedAt: '2026-11-15',
      imageUrl: '/assets/prod-inverter.jpg',
      summary: 'Biến tần Hybrid kết hợp pin lưu trữ giúp chuyển mạch UPS dưới 4ms khi mất điện lưới, giữ điều hòa, tủ lạnh và WiFi hoạt động liên tục.',
      content: `Khác với hệ thống điện mặt trời hòa lưới bám tải truyền thống (sẽ tự động ngắt khi lưới điện EVN gặp sự cố), hệ thống Hybrid có khả năng vận hành độc lập ngay lập tức nhờ bộ pin lưu trữ Lithium.

1. Thời gian chuyển mạch siêu nhanh (< 4ms)
Các dòng Inverter Hybrid như Deye hoặc Luxpower hỗ trợ cổng Backup chuyển mạch tự động như bộ lưu điện UPS. Máy tính, camera an ninh, WiFi và thiết bị gia dụng không hề bị sập nguồn hay khởi động lại khi điện lưới đột ngột mất.

2. Cắt gọn bậc thang giá điện cao (Bậc 4 & Bậc 5)
Ban ngày, tấm pin mặt trời cấp trực tiếp cho tải tiêu thụ và nạp đầy pin lưu trữ. Ban đêm, hệ thống ưu tiên xả pin thay vì mua điện bậc cao từ lưới EVN, giúp hóa đơn tiền điện giảm từ 60% đến 85%.

3. Chủ động nâng cấp linh hoạt
Khách hàng có thể bắt đầu với 1 module pin 5,12 kWh và ghép song song thêm module mới bất cứ lúc nào khi nhu cầu sử dụng điện tăng lên.`,
      published: true,
      featured: true
    },
    {
      id: 'news-luu-y-tu-dien-phu-kien',
      title: 'Lưu ý kỹ thuật khi chọn tủ điện AC/DC và phụ kiện lắp đặt ngoài trời chuẩn IP65',
      category: 'Dự án thực tế',
      author: 'Đội thi công Hoàng Quân',
      publishedAt: '2026-11-10',
      imageUrl: '/assets/prod-accessory.jpg',
      summary: 'Hệ khung nhôm AL6005-T5, cáp DC 4.0mm² chuẩn TÜV và tủ điện chống sét SPD giúp hệ thống vận hành an toàn, bền bỉ trên 25 năm.',
      content: `Một hệ thống điện mặt trời có tuổi thọ thiết kế 20 – 25 năm không chỉ phụ thuộc vào Inverter hay tấm pin, mà còn quyết định rất lớn bởi chất lượng vật tư phụ kiện thi công.

• Cáp điện mặt trời DC 4.0mm² chuyên dụng: Phải là loại lõi đồng mạ thiếc, vỏ XLPO 2 lớp chống tia UV và chịu điện áp 1.500V DC. Tuyệt đối không dùng dây điện dân dụng thông thường đi ngoài trời vì dễ lão hóa, rò điện.

• Đầu nối MC4 chuẩn IP68: Bấm cốt bằng kìm chuyên dụng để đảm bảo tiếp xúc chắc chắn, không gây phát nhiệt hay đánh lửa hồ quang DC trên mái.

• Tủ điện bảo vệ AC/DC tích hợp chống sét SPD: Cần trang bị đầy đủ CB DC 1000V, chống sét lan truyền SPD Type II cho cả phía DC và AC, cùng thiết bị bảo vệ quá áp/thấp áp để bảo vệ an toàn cho Inverter Hybrid và thiết bị trong nhà.

Tại Hoàng Quân Electronics & Energy, mọi gói lắp đặt đều đi kèm trọn bộ phụ kiện đạt chuẩn kỹ thuật và được kiểm tra cách điện trước khi bàn giao.`,
      published: true,
      featured: true
    }
  ];
}

function sanitizeArticle(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim();
  if (!title) return null;
  return {
    id: String(raw.id || `news-${Date.now()}-${idx}`).trim(),
    title,
    category: String(raw.category || 'Kiến thức Hybrid').trim() || 'Kiến thức Hybrid',
    author: String(raw.author || 'Hoàng Quân').trim() || 'Hoàng Quân',
    publishedAt: String(raw.publishedAt || new Date().toISOString().slice(0, 10)).trim(),
    imageUrl: String(raw.imageUrl || '/assets/prod-panel.jpg').trim() || '/assets/prod-panel.jpg',
    summary: String(raw.summary || '').trim(),
    content: String(raw.content || '').trim(),
    published: raw.published === undefined ? true : Boolean(raw.published),
    featured: raw.featured === undefined ? true : Boolean(raw.featured)
  };
}

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

function loadNews() {
  if (memNews) return memNews;
  ensureDir();
  try {
    if (!fs.existsSync(NEWS_PATH)) {
      const def = getDefaultNews();
      try { fs.writeFileSync(NEWS_PATH, JSON.stringify(def, null, 2), 'utf8'); } catch {}
      memNews = def;
      return def;
    }
    const parsed = JSON.parse(fs.readFileSync(NEWS_PATH, 'utf8'));
    const clean = Array.isArray(parsed) ? parsed.map((a, i) => sanitizeArticle(a, i)).filter(Boolean) : getDefaultNews();
    memNews = clean;
    return clean;
  } catch {
    memNews = getDefaultNews();
    return memNews;
  }
}

function saveNews(list) {
  const clean = (Array.isArray(list) ? list : []).map((a, i) => sanitizeArticle(a, i)).filter(Boolean);
  memNews = clean;
  ensureDir();
  try { fs.writeFileSync(NEWS_PATH, JSON.stringify(clean, null, 2), 'utf8'); } catch {}
  return clean;
}

function resetNews() {
  return saveNews(getDefaultNews());
}

module.exports = {
  getDefaultNews,
  sanitizeArticle,
  loadNews,
  saveNews,
  resetNews
};
