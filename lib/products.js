'use strict';

const fs = require('fs');
const path = require('path');
const xlsxLite = require('./xlsx-lite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRODUCTS_PATH = path.join(DATA_DIR, 'products.json');
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const DEFAULT_IMG = {
  inverter: '/assets/prod-inverter.jpg',
  panel: '/assets/prod-panel.jpg',
  battery: '/assets/prod-battery.jpg'
};

function getDefaultProducts() {
  return [
    // Inverters
    { id: 'inv-deye-5k',  category: 'inverter', brand: 'Deye',  name: 'Deye Hybrid 5kW 1 Pha (SUN-5K-SG03LP1-EU)',   powerKw: 5,  phase: '1 pha', price: 21500000, warranty: '5 năm', note: 'IP65, hỗ trợ máy phát', description: 'Biến tần Hybrid 5kW 1 pha chuẩn chống nước IP65, chuyển mạch UPS dưới 4ms, phù hợp nhà phố và gia đình.', imageUrl: '', active: true },
    { id: 'inv-lux-6k',   category: 'inverter', brand: 'Luxpower', name: 'Luxpower SNA 6000W 1 Pha Hybrid',          powerKw: 6,  phase: '1 pha', price: 18500000, warranty: '5 năm', note: 'Phổ thông, tối ưu chi phí', description: 'Dòng biến tần Hybrid 6kW dễ lắp đặt, giám sát qua app điện thoại, tối ưu hiệu quả đầu tư.', imageUrl: '', active: true },
    { id: 'inv-deye-8k',  category: 'inverter', brand: 'Deye',  name: 'Deye Hybrid 8kW 1 Pha (SUN-8K-SG01LP1-EU)',   powerKw: 8,  phase: '1 pha', price: 32500000, warranty: '5 năm', note: 'Tải backup mạnh, chạy điều hòa', description: 'Biến tần Hybrid 8kW chịu tải khởi động máy lạnh và bếp từ ổn định khi mất điện lưới.', imageUrl: '', active: true },
    { id: 'inv-deye-10k', category: 'inverter', brand: 'Deye',  name: 'Deye Hybrid 10kW 3 Pha (SUN-10K-SG04LP3-EU)', powerKw: 10, phase: '3 pha', price: 42000000, warranty: '5 năm', note: 'Điện 3 pha, cân bằng tải lệch pha', description: 'Biến tần 3 pha 10kW xuất công suất lệch pha linh hoạt, phù hợp biệt thự và văn phòng.', imageUrl: '', active: true },
    { id: 'inv-deye-12k', category: 'inverter', brand: 'Deye',  name: 'Deye Hybrid 12kW 3 Pha (SUN-12K-SG04LP3-EU)', powerKw: 12, phase: '3 pha', price: 46500000, warranty: '5 năm', note: 'Biệt thự, nhà xưởng nhỏ', description: 'Công suất mạnh mẽ 12kW 3 pha, hỗ trợ ghép song song nhiều máy và sạc xả dòng cao.', imageUrl: '', active: true },

    // Solar Panels
    { id: 'pan-jinko-580', category: 'panel', brand: 'Jinko',  name: 'Jinko Tiger Neo N-Type 580Wp (2 mặt kính)', wattWp: 580, price: 2150000, warranty: '12 năm / 30 năm', note: 'Hiệu suất 22,45%', description: 'Tấm pin công nghệ N-Type TOPCon 2 mặt kính, suy hao thấp, hoạt động tốt trong điều kiện ánh sáng yếu.', imageUrl: '', active: true },
    { id: 'pan-longi-555', category: 'panel', brand: 'LONGi',  name: 'LONGi Hi-MO 6 Explorer 555Wp',              wattWp: 555, price: 1980000, warranty: '12 năm / 25 năm', note: 'Tối ưu chi phí', description: 'Tấm pin Mono PERC hiệu suất cao, khung nhôm chịu lực gió bão tốt, độ bền ngoài trời cao.', imageUrl: '', active: true },
    { id: 'pan-can-610',   category: 'panel', brand: 'Canadian Solar', name: 'Canadian Solar TOPBiHiKu6 610Wp',   wattWp: 610, price: 2350000, warranty: '12 năm / 30 năm', note: 'Công suất lớn, tiết kiệm diện tích mái', description: 'Công suất 610Wp giúp giảm số lượng tấm cần lắp, tối ưu không gian mái và chi phí khung giàn.', imageUrl: '', active: true },

    // Storage Batteries
    { id: 'bat-hq-512',  category: 'battery', brand: 'Hoàng Quân', name: 'Pin Lithium LFP 51.2V 100Ah (5,12 kWh)',   capacityKwh: 5.12,  price: 19500000, warranty: '7 năm',  note: '6000 chu kỳ, treo tường / tủ rack', description: 'Cell Lithium LFP an toàn chống cháy nổ, BMS thông minh giao tiếp trực tiếp Inverter Deye/Luxpower.', imageUrl: '', active: true },
    { id: 'bat-hq-1024', category: 'battery', brand: 'Hoàng Quân', name: 'Pin Lithium LFP 51.2V 200Ah (10,24 kWh)',  capacityKwh: 10.24, price: 36500000, warranty: '7 năm',  note: 'Gọn đẹp, dung lượng lớn', description: 'Module 10,24 kWh thiết kế gọn gàng, lưu trữ thoải mái cho gia đình dùng 2–3 điều hòa ban đêm.', imageUrl: '', active: true },
    { id: 'bat-hq-1536', category: 'battery', brand: 'Hoàng Quân', name: 'Pin Lithium LFP 51.2V 300Ah (15,36 kWh)',  capacityKwh: 15.36, price: 51500000, warranty: '10 năm', note: 'Tủ đứng có bánh xe, lưu trữ sâu', description: 'Dung lượng lớn 15,36 kWh có bánh xe di chuyển tiện lợi, bảo hành dài hạn, phù hợp nhà dùng điện nhiều.', imageUrl: '', active: true }
  ];
}

function sanitizeProduct(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const catRaw = String(raw.category || raw.loai || raw['loại'] || '').trim().toLowerCase();
  let category = null;
  if (['inverter', 'bien_tan', 'biến tần', 'biến tần hybrid'].includes(catRaw)) category = 'inverter';
  else if (['panel', 'solar', 'pin_mat_troi', 'tấm pin', 'tam_pin', 'pin mặt trời'].includes(catRaw)) category = 'panel';
  else if (['battery', 'storage', 'pin_luu_tru', 'pin lưu trữ', 'luu_tru'].includes(catRaw)) category = 'battery';
  if (!category) return null;

  const name = String(raw.name || raw.ten || raw['tên sản phẩm'] || raw['tên'] || '').trim();
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
    imageUrl: String(raw.imageUrl || raw.imageurl || raw.image || raw.hinh_anh || raw['hình ảnh'] || DEFAULT_IMG[category]).trim() || DEFAULT_IMG[category],
    active: raw.active === undefined ? true : !(raw.active === false || String(raw.active).toLowerCase() === 'false' || String(raw.active) === '0')
  };

  if (category === 'inverter') {
    base.powerKw = Math.max(0.5, Number(raw.powerKw ?? raw.powerkw ?? raw.cong_suat_kw ?? raw['công suất'] ?? raw.spec ?? 5) || 5);
    base.phase = String(raw.phase || raw.pha || '1 pha').trim() || '1 pha';
  } else if (category === 'panel') {
    base.wattWp = Math.max(100, Number(raw.wattWp ?? raw.wattwp ?? raw.cong_suat_wp ?? raw['công suất'] ?? raw.spec ?? 550) || 550);
  } else if (category === 'battery') {
    base.capacityKwh = Math.max(0.5, Number(raw.capacityKwh ?? raw.capacitykwh ?? raw.dung_luong_kwh ?? raw['công suất'] ?? raw['dung lượng'] ?? raw.spec ?? 5.12) || 5.12);
  }
  return base;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseProductsCsv(csvText) {
  const clean = String(csvText || '').replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    const item = sanitizeProduct(obj, i);
    if (item) items.push(item);
  }
  return items;
}

function toCsvTemplate(products) {
  const header = 'category,brand,name,spec,phase,price,warranty,note,active';
  const rows = products.map(p => {
    const spec = p.category === 'inverter' ? p.powerKw : p.category === 'panel' ? p.wattWp : p.capacityKwh;
    const cols = [p.category, p.brand, p.name, spec, p.phase || '', p.price, p.warranty, p.note, p.active ? 'true' : 'false'];
    return cols.map(v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  });
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadProducts() {
  ensureDir();
  if (!fs.existsSync(PRODUCTS_PATH)) {
    const def = getDefaultProducts().map((p, i) => sanitizeProduct(p, i));
    fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(def, null, 2), 'utf8');
    return def;
  }
  try {
    const data = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
    return Array.isArray(data) ? data.map((p, i) => sanitizeProduct(p, i)).filter(Boolean) : getDefaultProducts().map((p, i) => sanitizeProduct(p, i));
  } catch {
    return getDefaultProducts();
  }
}

function saveProducts(list) {
  ensureDir();
  const clean = (Array.isArray(list) ? list : []).map((p, i) => sanitizeProduct(p, i)).filter(Boolean);
  fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(clean, null, 2), 'utf8');
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
    ['category', 'brand', 'name', 'spec', 'phase', 'price', 'warranty', 'note', 'description', 'imageUrl', 'active']
  ];
  for (const p of products) {
    const spec = p.category === 'inverter' ? p.powerKw : p.category === 'panel' ? p.wattWp : p.capacityKwh;
    rows.push([
      p.category, p.brand || '', p.name || '', Number(spec) || 0, p.phase || '',
      Number(p.price) || 0, p.warranty || '', p.note || '', p.description || '', p.imageUrl || '', p.active !== false ? 'true' : 'false'
    ]);
  }
  return xlsxLite.buildXlsxBuffer(rows, 'DanhMucSanPham');
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
  resetProducts
};
