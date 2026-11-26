'use strict';

const fs = require('fs');
const path = require('path');
const xlsxLite = require('./xlsx-lite');
const { publish } = require('./live-updates');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRODUCTS_PATH = path.join(DATA_DIR, 'products.json');
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const DEFAULT_IMG = {
  inverter: '/assets/prod-inverter.jpg',
  panel: '/assets/prod-panel.jpg',
  battery: '/assets/prod-battery.jpg',
  accessory: '/assets/prod-accessory.jpg'
};

function getDefaultProducts() {
  return [
    // Inverters
    { id: 'inv-deye-5k', specs: 'Công suất AC định mức: 5.000 W\nCông suất PV tối đa: 6.500 Wp\nĐiện áp pin lưu trữ: 40 – 60V (LFP/Axit-chì)\nDòng sạc/xả tối đa: 120A / 120A\nHiệu suất tối đa: 97,6%\nChuẩn bảo vệ: IP65 (lắp ngoài trời)',  category: 'inverter', brand: 'Deye',  name: 'Deye Hybrid 5kW 1 Pha (SUN-5K-SG03LP1-EU)',   powerKw: 5,  phase: '1 pha', price: 21500000, warranty: '5 năm', note: 'IP65, hỗ trợ máy phát', description: 'Biến tần Hybrid 5kW 1 pha chuẩn chống nước IP65, chuyển mạch UPS dưới 4ms, phù hợp nhà phố và gia đình.', imageUrl: '', active: true },
    { id: 'inv-lux-6k', specs: 'Công suất AC định mức: 6.000 W\nCông suất PV tối đa: 8.000 Wp\nĐiện áp pin lưu trữ: 48V – 51,2V\nSố MPPT: 2 MPPT độc lập\nKết nối giám sát: WiFi / App điện thoại',   category: 'inverter', brand: 'Luxpower', name: 'Luxpower SNA 6000W 1 Pha Hybrid',          powerKw: 6,  phase: '1 pha', price: 18500000, warranty: '5 năm', note: 'Phổ thông, tối ưu chi phí', description: 'Dòng biến tần Hybrid 6kW dễ lắp đặt, giám sát qua app điện thoại, tối ưu hiệu quả đầu tư.', imageUrl: '', active: true },
    { id: 'inv-deye-8k', specs: 'Công suất AC định mức: 8.000 W\nCông suất PV tối đa: 10.400 Wp\nDòng sạc/xả tối đa: 190A\nThời gian chuyển mạch UPS: < 4 ms\nChuẩn bảo vệ: IP65',  category: 'inverter', brand: 'Deye',  name: 'Deye Hybrid 8kW 1 Pha (SUN-8K-SG01LP1-EU)',   powerKw: 8,  phase: '1 pha', price: 32500000, warranty: '5 năm', note: 'Tải backup mạnh, chạy điều hòa', description: 'Biến tần Hybrid 8kW chịu tải khởi động máy lạnh và bếp từ ổn định khi mất điện lưới.', imageUrl: '', active: true },
    { id: 'inv-deye-10k', specs: 'Công suất AC định mức: 10.000 W (3 Pha)\nCông suất PV tối đa: 13.000 Wp\nXuất lệch pha: 100% mỗi pha\nDòng sạc/xả tối đa: 210A\nChuẩn bảo vệ: IP65', category: 'inverter', brand: 'Deye',  name: 'Deye Hybrid 10kW 3 Pha (SUN-10K-SG04LP3-EU)', powerKw: 10, phase: '3 pha', price: 42000000, warranty: '5 năm', note: 'Điện 3 pha, cân bằng tải lệch pha', description: 'Biến tần 3 pha 10kW xuất công suất lệch pha linh hoạt, phù hợp biệt thự và văn phòng.', imageUrl: '', active: true },
    { id: 'inv-deye-12k', specs: 'Công suất AC định mức: 12.000 W (3 Pha)\nCông suất PV tối đa: 15.600 Wp\nDòng sạc/xả tối đa: 240A\nGhép song song: Tối đa 10 máy\nChuẩn bảo vệ: IP65', category: 'inverter', brand: 'Deye',  name: 'Deye Hybrid 12kW 3 Pha (SUN-12K-SG04LP3-EU)', powerKw: 12, phase: '3 pha', price: 46500000, warranty: '5 năm', note: 'Biệt thự, nhà xưởng nhỏ', description: 'Công suất mạnh mẽ 12kW 3 pha, hỗ trợ ghép song song nhiều máy và sạc xả dòng cao.', imageUrl: '', active: true },

    // Solar Panels
    { id: 'pan-jinko-580', specs: 'Công suất đỉnh (Pmax): 580 Wp\nCông nghệ cell: N-Type TOPCon 144 Half-Cell\nHiệu suất mô-đun: 22,45%\nKích thước: 2278 × 1134 × 30 mm\nTrọng lượng: 32 kg (2 mặt kính)', category: 'panel', brand: 'Jinko',  name: 'Jinko Tiger Neo N-Type 580Wp (2 mặt kính)', wattWp: 580, price: 2150000, warranty: '12 năm / 30 năm', note: 'Hiệu suất 22,45%', description: 'Tấm pin công nghệ N-Type TOPCon 2 mặt kính, suy hao thấp, hoạt động tốt trong điều kiện ánh sáng yếu.', imageUrl: '', active: true },
    { id: 'pan-longi-555', specs: 'Công suất đỉnh (Pmax): 555 Wp\nCông nghệ cell: HPBC / Mono Half-Cell\nHiệu suất mô-đun: 21,5%\nKích thước: 2278 × 1134 × 35 mm', category: 'panel', brand: 'LONGi',  name: 'LONGi Hi-MO 6 Explorer 555Wp',              wattWp: 555, price: 1980000, warranty: '12 năm / 25 năm', note: 'Tối ưu chi phí', description: 'Tấm pin Mono PERC hiệu suất cao, khung nhôm chịu lực gió bão tốt, độ bền ngoài trời cao.', imageUrl: '', active: true },
    { id: 'pan-can-610', specs: 'Công suất đỉnh (Pmax): 610 Wp\nCông nghệ cell: TOPCon Bifacial\nHiệu suất mô-đun: 22,6%\nChịu tải gió/tuyết: 2400 Pa / 5400 Pa',   category: 'panel', brand: 'Canadian Solar', name: 'Canadian Solar TOPBiHiKu6 610Wp',   wattWp: 610, price: 2350000, warranty: '12 năm / 30 năm', note: 'Công suất lớn, tiết kiệm diện tích mái', description: 'Công suất 610Wp giúp giảm số lượng tấm cần lắp, tối ưu không gian mái và chi phí khung giàn.', imageUrl: '', active: true },

    // Storage Batteries
    { id: 'bat-hq-512', specs: 'Dung lượng danh định: 5,12 kWh (51,2V – 100Ah)\nLoại cell: LiFePO4 (LFP) Grade A\nĐộ xả sâu khuyến nghị (DoD): 90%\nTuổi thọ: ≥ 6.000 chu kỳ (80% DoD)\nGiao tiếp BMS: CAN / RS485 (Deye, Luxpower, Growatt)',  category: 'battery', brand: 'Hoàng Quân', name: 'Pin Lithium LFP 51.2V 100Ah (5,12 kWh)',   capacityKwh: 5.12,  price: 19500000, warranty: '7 năm',  note: '6000 chu kỳ, treo tường / tủ rack', description: 'Cell Lithium LFP an toàn chống cháy nổ, BMS thông minh giao tiếp trực tiếp Inverter Deye/Luxpower.', imageUrl: '', active: true },
    { id: 'bat-hq-1024', specs: 'Dung lượng danh định: 10,24 kWh (51,2V – 200Ah)\nLoại cell: LiFePO4 (LFP) Grade A\nĐộ xả sâu khuyến nghị (DoD): 90%\nTuổi thọ: ≥ 6.000 chu kỳ\nKiểu lắp: Treo tường / Đặt sàn', category: 'battery', brand: 'Hoàng Quân', name: 'Pin Lithium LFP 51.2V 200Ah (10,24 kWh)',  capacityKwh: 10.24, price: 36500000, warranty: '7 năm',  note: 'Gọn đẹp, dung lượng lớn', description: 'Module 10,24 kWh thiết kế gọn gàng, lưu trữ thoải mái cho gia đình dùng 2–3 điều hòa ban đêm.', imageUrl: '', active: true },
    { id: 'bat-hq-1536', specs: 'Dung lượng danh định: 15,36 kWh (51,2V – 300Ah)\nLoại cell: LiFePO4 (LFP) Grade A\nDòng xả liên tục: 150A – 200A\nTuổi thọ: ≥ 6.000 chu kỳ\nKiểu lắp: Tủ đứng có bánh xe di chuyển', category: 'battery', brand: 'Hoàng Quân', name: 'Pin Lithium LFP 51.2V 300Ah (15,36 kWh)',  capacityKwh: 15.36, price: 51500000, warranty: '10 năm', note: 'Tủ đứng có bánh xe, lưu trữ sâu', description: 'Dung lượng lớn 15,36 kWh có bánh xe di chuyển tiện lợi, bảo hành dài hạn, phù hợp nhà dùng điện nhiều.', imageUrl: '', active: true },

    // Installation Accessories
    { id: 'acc-tu-dien-acdc', specs: 'Cấu hình: CB DC 1000V + Chống sét SPD Type II + CB AC + ATS chuyển mạch\nChuẩn vỏ tủ: Nhựa ABS / Kim loại chống nước IP65 ngoài trời\nCông suất tương thích: Hệ Hybrid 1 pha (5kW – 10kW)\nĐấu nối sẵn: Dây dẫn cốt đồng chuẩn, dễ thi công', category: 'accessory', brand: 'Hoàng Quân', name: 'Tủ điện năng lượng mặt trời AC/DC Hybrid (5kW – 10kW)', specText: 'IP65 · AC/DC', price: 2450000, warranty: '2 năm', note: 'Đấu sẵn CB DC/AC, chống sét SPD', description: 'Tủ điện tích hợp đầy đủ thiết bị đóng cắt DC/AC, chống sét lan truyền và bảo vệ quá áp, lắp đặt gọn gàng an toàn.', imageUrl: '', active: true },
    { id: 'acc-rail-nhom', specs: 'Vật liệu: Hợp kim nhôm AL6005-T5 Anodized chống ăn mòn\nChiều dài tiêu chuẩn: 4,2 mét / thanh\nPhụ kiện đi kèm: Kẹp giữa, kẹp biên, nối rail, bát L / chân móc ngói Inox 304\nChịu tải gió: Lên đến 60 m/s', category: 'accessory', brand: 'AL6005-T5', name: 'Thanh Rail nhôm định hình & Bộ kẹp pin (Giữa / Biên)', specText: 'Dài 4,2m · AL6005-T5', price: 285000, warranty: '10 năm', note: 'Nhôm Anode dày, ốc Inox 304', description: 'Hệ khung giàn nhôm định hình chuyên dụng cho mái tôn và mái ngói, chống rỉ sét bền bỉ trên 25 năm.', imageUrl: '', active: true },
    { id: 'acc-cap-dc-4mm', specs: 'Tiết diện lõi đồng mạ thiếc: 4.0 mm²\nĐiện áp định mức: 1.500V DC (TÜV EN 50618)\nVỏ cách điện: XLPO 2 lớp chống tia UV, chậm cháy\nNhiệt độ làm việc: -40°C đến +90°C\nQuy cách: Cuộn 100m (Đỏ / Đen)', category: 'accessory', brand: 'Leader / Helukabel', name: 'Cáp điện mặt trời DC 4.0mm² (Đỏ / Đen – Cuộn 100m)', specText: '4.0mm² · 1500V DC', price: 2100000, warranty: '5 năm', note: 'Chuẩn TÜV, chống UV ngoài trời', description: 'Cáp chuyên dụng truyền tải DC từ tấm pin về Inverter, suy hao thấp, chống nắng mưa và chịu nhiệt ngoài trời.', imageUrl: '', active: true },
    { id: 'acc-mc4', specs: 'Dòng điện định mức: 30A\nĐiện áp tối đa: 1.500V DC\nChuẩn bảo vệ: IP68 (chống nước & bụi tuyệt đối)\nTương thích dây: Cáp DC 2.5mm² – 6.0mm²\nChất liệu tiếp điểm: Đồng mạ thiếc, khóa chống tuột', category: 'accessory', brand: 'Stäubli / Leader', name: 'Đầu nối năng lượng mặt trời MC4 (Cặp đực/cái IP68)', specText: '30A · 1500V DC · IP68', price: 35000, warranty: '2 năm', note: 'Chống nước IP68, tiếp xúc chắc', description: 'Đầu nối MC4 chính hãng đảm bảo tiếp xúc điện ổn định, hạn chế phát nhiệt và chống nước tuyệt đối trên mái.', imageUrl: '', active: true }
  ];
}

function sanitizeProduct(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const catRaw = String(raw.category || raw.loai || raw['loại'] || raw['phân loại'] || raw.phan_loai || raw['danh mục'] || '').trim().toLowerCase();
  let category = null;
  if (['inverter', 'bien_tan', 'biến tần', 'biến tần hybrid'].includes(catRaw)) category = 'inverter';
  else if (['panel', 'solar', 'pin_mat_troi', 'tấm pin', 'tam_pin', 'pin mặt trời'].includes(catRaw)) category = 'panel';
  else if (['battery', 'storage', 'pin_luu_tru', 'pin lưu trữ', 'luu_tru'].includes(catRaw)) category = 'battery';
  else if (['accessory', 'accessories', 'phu_kien', 'phụ kiện', 'phụ kiện lắp đặt', 'phu_kien_lap_dat', 'vat_tu', 'vật tư'].includes(catRaw)) category = 'accessory';
  if (!category) return null;

  const name = String(raw.name || raw.ten || raw['tên sản phẩm'] || raw['tên'] || raw['sản phẩm'] || '').trim();
  if (!name) return null;

  const base = {
    id: String(raw.id || `${category}-${Date.now()}-${index}`).trim(),
    category,
    brand: String(raw.brand || raw.hang || raw['hãng'] || '').trim(),
    name,
    price: Math.max(0, Number(String(raw.price ?? raw.gia ?? raw['giá'] ?? raw['đơn giá'] ?? 0).replace(/[^\d.]/g, '')) || 0),
    warranty: String(raw.warranty || raw.bao_hanh || raw['bảo hành'] || '').trim(),
    note: String(raw.note || raw.ghi_chu || raw['ghi chú'] || '').trim(),
    description: String(raw.description || raw.mo_ta || raw['mô tả'] || raw['mô tả sản phẩm'] || '').trim(),
    specs: String(raw.specs || raw.thong_so || raw['thông số kỹ thuật'] || '').trim(),
    datasheetUrl: String(raw.datasheetUrl || raw.datasheeturl || raw.datasheet || '').trim(),
    datasheetName: String(raw.datasheetName || raw.datasheetname || '').trim(),
    attachments: Array.isArray(raw.attachments) ? raw.attachments.filter(a => a && a.url).map(a => ({ name: String(a.name || 'Tài liệu đính kèm').trim(), url: String(a.url).trim() })) : [],
    imageUrl: normalizeImageUrl(raw.imageUrl || raw.imageurl || raw.image || raw.hinh_anh || raw['hình ảnh'] || raw['ảnh'] || raw['link ảnh'] || raw.anh || '') || DEFAULT_IMG[category],
    active: raw.active === undefined ? true : !(raw.active === false || String(raw.active).toLowerCase() === 'false' || String(raw.active) === '0'),
    stockStatus: (() => {
      const sv = raw.stockStatus ?? raw.stockstatus ?? raw.trang_thai ?? raw['trạng thái'] ?? raw.tinh_trang ?? raw['tình trạng'] ?? raw.inStock ?? raw.instock ?? raw.con_hang ?? raw['còn hàng'];
      if (sv === undefined || sv === null || sv === '') return 'in_stock';
      if (sv === false) return 'out_of_stock';
      if (sv === true) return 'in_stock';
      const s = String(sv).trim().toLowerCase();
      if (['contact', 'liên hệ', 'lien he', 'lien_he', 'đặt hàng', 'dat hang'].includes(s)) return 'contact';
      if (['false', '0', 'no', 'hết hàng', 'het hang', 'het_hang', 'out_of_stock', 'out'].includes(s)) return 'out_of_stock';
      return 'in_stock';
    })()
  };

  base.inStock = base.stockStatus !== 'out_of_stock';
  if (raw.syncSource) base.syncSource = String(raw.syncSource);
  base.missingCount = Math.max(0, Number(raw.missingCount) || 0);
  base.manualStockOverride = Boolean(raw.manualStockOverride);
  if (category === 'inverter') {
    base.powerKw = Math.max(0.5, Number(raw.powerKw ?? raw.powerkw ?? raw.cong_suat_kw ?? raw['công suất'] ?? raw.spec ?? 5) || 5);
    base.phase = String(raw.phase || raw.pha || '1 pha').trim() || '1 pha';
  } else if (category === 'panel') {
    base.wattWp = Math.max(100, Number(raw.wattWp ?? raw.wattwp ?? raw.cong_suat_wp ?? raw['công suất'] ?? raw.spec ?? 550) || 550);
  } else if (category === 'battery') {
    base.capacityKwh = Math.max(0.5, Number(raw.capacityKwh ?? raw.capacitykwh ?? raw.dung_luong_kwh ?? raw['công suất'] ?? raw['dung lượng'] ?? raw.spec ?? 5.12) || 5.12);
  } else if (category === 'accessory') {
    base.specText = String(raw.specText ?? raw.spectext ?? raw.quy_cach ?? raw['quy cách'] ?? raw.spec ?? '').trim();
  }
  return base;
}

function parseProductsCsv(csvText) {
  const [header, ...rows] = parseCsvRows(csvText);
  if (!header) return [];
  const headers = header.map(h => h.toLowerCase());
  const items = [];
  for (const [index, cols] of rows.entries()) {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    const item = sanitizeProduct(obj, index + 1);
    if (item) items.push(item);
  }
  return items;
}

function toCsvTemplate(products) {
  const header = 'category,brand,name,spec,phase,price,warranty,note,stockStatus,active';
  const rows = products.map(p => {
    const spec = p.category === 'inverter' ? p.powerKw : p.category === 'panel' ? p.wattWp : p.category === 'battery' ? p.capacityKwh : (p.specText || '');
    const cols = [p.category, p.brand, p.name, spec, p.phase || '', p.price, p.warranty, p.note, p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock'), p.active ? 'true' : 'false'];
    return cols.map(v => {
      const s = String(v ?? '');
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  });
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

let memProducts = null;

function ensureDir() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

function loadProducts() {
  if (memProducts) return memProducts;
  ensureDir();
  try {
    if (!fs.existsSync(PRODUCTS_PATH)) {
      const def = getDefaultProducts().map((p, i) => sanitizeProduct(p, i));
      try { fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(def, null, 2), 'utf8'); } catch {}
      memProducts = def;
      return def;
    }
    const data = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
    const clean = Array.isArray(data) ? data.map((p, i) => sanitizeProduct(p, i)).filter(Boolean) : getDefaultProducts().map((p, i) => sanitizeProduct(p, i));
    memProducts = clean;
    return clean;
  } catch {
    memProducts = getDefaultProducts().map((p, i) => sanitizeProduct(p, i));
    return memProducts;
  }
}

function saveProducts(list) {
  const clean = (Array.isArray(list) ? list : []).map((p, i) => sanitizeProduct(p, i)).filter(Boolean);
  ensureDir();
  fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(clean, null, 2), 'utf8');
  memProducts = clean;
  publish('products');
  return clean;
}

function resetProducts() {
  return saveProducts(getDefaultProducts());
}


function parseProductsXlsx(base64Str) {
  const buf = Buffer.from(String(base64Str || ''), 'base64');
  const records = xlsxLite.parseXlsxBuffer(buf);
  const ts = Date.now();
  return records.map((r, i) => {
    if (r._embeddedImage && r._embeddedImage.buffer) {
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const fname = `prod-${ts}-${i}.${r._embeddedImage.ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, fname), r._embeddedImage.buffer);
      r.imageUrl = `/uploads/${fname}`;
    }
    return sanitizeProduct(r, i);
  }).filter(Boolean);
}

function toXlsxTemplate(products) {
  const rows = [
    ['category', 'brand', 'name', 'spec', 'phase', 'price', 'warranty', 'note', 'description', 'specs', 'datasheetUrl', 'imageUrl', 'stockStatus', 'active']
  ];
  for (const p of products) {
    const spec = p.category === 'inverter' ? p.powerKw : p.category === 'panel' ? p.wattWp : p.category === 'battery' ? p.capacityKwh : (p.specText || '');
    rows.push([
      p.category, p.brand || '', p.name || '', p.category === 'accessory' ? (p.specText || '') : (Number(spec) || 0), p.phase || '',
      Number(p.price) || 0, p.warranty || '', p.note || '', p.description || '', p.specs || '', p.datasheetUrl || '', p.imageUrl || '', p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock'), p.active !== false ? 'true' : 'false'
    ]);
  }
  return xlsxLite.buildXlsxBuffer(rows, 'DanhMucSanPham');
}


function normalizeImageUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  // Convert Google Drive share links into direct embeddable image URLs
  const m1 = s.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://lh3.googleusercontent.com/d/${m1[1]}`;
  const m2 = s.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}`;
  return s;
}

function normalizeSheetCsvUrl(inputUrl) {
  const raw = String(inputUrl || '').trim();
  if (!raw) throw new Error('Vui lòng nhập link Google Sheet.');
  if (/[?&]output=csv/i.test(raw) || /export\?format=csv/i.test(raw)) return raw;
  const idMatch = raw.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    if (/^https?:\/\//i.test(raw)) return raw;
    throw new Error('Link Google Sheet không hợp lệ.');
  }
  const sheetId = idMatch[1];
  const gidMatch = raw.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseCsvRows(csvText) {
  const clean = String(csvText || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"' && clean[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(cur.trim()); cur = ''; }
      else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && clean[i + 1] === '\n') i++;
        row.push(cur.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        cur = '';
      }
      else cur += ch;
    }
  }
  row.push(cur.trim());
  if (row.some(c => c !== '')) rows.push(row);
  return rows;
}

function normKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function syncProductsFromSheetCsv(csvText, existingList) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) throw new Error('Google Sheet chưa có dữ liệu sản phẩm (cần dòng tiêu đề và ít nhất 1 sản phẩm).');
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const incoming = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    const item = sanitizeProduct(obj, i);
    if (item) {
      item.syncSource = 'sheet';
      item.missingCount = 0;
      incoming.push(item);
    }
  }
  if (!incoming.length) {
    throw new Error('Không đọc được sản phẩm hợp lệ từ Google Sheet. Hãy kiểm tra cột Tên sản phẩm và Phân loại.');
  }

  const current = (Array.isArray(existingList) ? existingList : []).map(p => ({ ...p }));
  const seenIds = new Set();
  const stats = { added: 0, updated: 0, markedContact: 0, markedOut: 0, manualKept: 0 };

  for (const inc of incoming) {
    const key = normKey(inc.name);
    const matchIdx = current.findIndex(p => normKey(p.name) === key && p.category === inc.category);
    const fallbackIdx = matchIdx >= 0 ? matchIdx : current.findIndex(p => normKey(p.name) === key);
    if (fallbackIdx >= 0) {
      const prev = current[fallbackIdx];
      seenIds.add(prev.id);
      const next = {
        ...prev,
        category: inc.category,
        brand: inc.brand || prev.brand,
        name: inc.name,
        price: inc.price || prev.price,
        description: inc.description || prev.description,
        imageUrl: (inc.imageUrl && inc.imageUrl !== DEFAULT_IMG[inc.category]) ? inc.imageUrl : (prev.imageUrl || inc.imageUrl),
        warranty: inc.warranty || prev.warranty,
        note: inc.note || prev.note,
        specs: inc.specs || prev.specs,
        datasheetUrl: inc.datasheetUrl || prev.datasheetUrl,
        syncSource: 'sheet',
        missingCount: 0,
        manualStockOverride: Boolean(prev.manualStockOverride)
      };
      if (inc.category === 'inverter') { next.powerKw = inc.powerKw || prev.powerKw; next.phase = inc.phase || prev.phase; }
      else if (inc.category === 'panel') { next.wattWp = inc.wattWp || prev.wattWp; }
      else if (inc.category === 'battery') { next.capacityKwh = inc.capacityKwh || prev.capacityKwh; }
      else if (inc.specText) { next.specText = inc.specText; }

      // Highest priority: manual override in Kho sản phẩm!
      if (prev.manualStockOverride) {
        next.stockStatus = prev.stockStatus || (prev.inStock === false ? 'out_of_stock' : 'in_stock');
        next.inStock = next.stockStatus !== 'out_of_stock';
        stats.manualKept++;
      } else {
        next.stockStatus = inc.stockStatus;
        next.inStock = inc.inStock;
      }
      current[fallbackIdx] = next;
      stats.updated++;
    } else {
      inc.manualStockOverride = false;
      current.push(inc);
      seenIds.add(inc.id);
      stats.added++;
    }
  }

  // Handle previously sheet-synced products that are now MISSING from the sheet:
  // 1st missing -> 'contact' (Liên hệ); 2nd+ missing -> 'out_of_stock' (Hết hàng);
  // Manual override in Kho sản phẩm ALWAYS takes highest priority!
  for (let i = 0; i < current.length; i++) {
    const p = current[i];
    if (p.syncSource === 'sheet' && !seenIds.has(p.id)) {
      p.missingCount = (Number(p.missingCount) || 0) + 1;
      if (p.manualStockOverride) {
        stats.manualKept++;
      } else if (p.missingCount === 1) {
        p.stockStatus = 'contact';
        p.inStock = true;
        stats.markedContact++;
      } else {
        p.stockStatus = 'out_of_stock';
        p.inStock = false;
        stats.markedOut++;
      }
    }
  }

  return { products: current, stats };
}

module.exports = {
  DEFAULT_IMG,
  parseProductsXlsx,
  toXlsxTemplate,
  getDefaultProducts,
  sanitizeProduct,
  parseProductsCsv,
  toCsvTemplate,
  loadProducts,
  saveProducts,
  resetProducts,
  normalizeImageUrl,
  normalizeSheetCsvUrl,
  syncProductsFromSheetCsv
};
