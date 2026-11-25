'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashPassword, ALL_PERMISSIONS } = require('./auth');
const { DEFAULT_TIERS } = require('./calculator');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const AUTH_PATH = path.join(DATA_DIR, 'admin-auth.json');

const THEME_PRESETS = {
  'hoangquan-orange': {
    name: 'Cam Năng Lượng Hoàng Quân',
    primary: '#F26A1B',
    primaryDeep: '#D9560B',
    gradientEnd: '#FFB400',
    bg: '#F3F5F9',
    cardBg: '#FFFFFF',
    ink: '#111827',
    inkMuted: '#4B5563',
    dayColor: '#F59E0B',
    nightColor: '#1E293B',
    accentGood: '#15803D',
    darkMode: false
  },
  'solar-ocean': {
    name: 'Xanh Solar Tech',
    primary: '#0284C7',
    primaryDeep: '#0369A1',
    gradientEnd: '#06B6D4',
    bg: '#F0F6FA',
    cardBg: '#FFFFFF',
    ink: '#0F172A',
    inkMuted: '#475569',
    dayColor: '#F59E0B',
    nightColor: '#0F172A',
    accentGood: '#059669',
    darkMode: false
  },
  'eco-emerald': {
    name: 'Xanh Lá Sinh Thái',
    primary: '#059669',
    primaryDeep: '#047857',
    gradientEnd: '#10B981',
    bg: '#F2F8F5',
    cardBg: '#FFFFFF',
    ink: '#064E3B',
    inkMuted: '#4B5563',
    dayColor: '#FBBF24',
    nightColor: '#1E293B',
    accentGood: '#15803D',
    darkMode: false
  },
  'luxury-dark': {
    name: 'Đen Vàng Cao Cấp (Dark)',
    primary: '#F59E0B',
    primaryDeep: '#D97706',
    gradientEnd: '#FB923C',
    bg: '#0B1120',
    cardBg: '#111827',
    ink: '#F9FAFB',
    inkMuted: '#9CA3AF',
    dayColor: '#FBBF24',
    nightColor: '#334155',
    accentGood: '#22C55E',
    darkMode: true
  },
  'minimal-slate': {
    name: 'Tối Giản Hiện Đại',
    primary: '#4F46E5',
    primaryDeep: '#3730A3',
    gradientEnd: '#7C3AED',
    bg: '#F8FAFC',
    cardBg: '#FFFFFF',
    ink: '#0F172A',
    inkMuted: '#64748B',
    dayColor: '#F59E0B',
    nightColor: '#1E293B',
    accentGood: '#16A34A',
    darkMode: false
  }
};

function getDefaultConfig() {
  return {
    branding: {
      companyName: 'CTY HOÀNG QUÂN – Electronics & Energy',
      siteTitle: 'Hoàng Quân – Tư vấn Pin lưu trữ Hybrid',
      logoUrl: '/assets/logo-default.jpg',
      faviconUrl: '/assets/favicon.png',
      logoHeight: 54,
      hotlineLabel: 'Hotline tư vấn kỹ thuật',
      showHotline: true,
      showAdminLink: false,
      hotlines: [
        { number: '0913 350 597', tel: '0913350597', zalo: '0913350597', label: 'Tư vấn kỹ thuật' },
        { number: '0345 128 688', tel: '0345128688', zalo: '0345128688', label: 'Báo giá & Lắp đặt' }
      ]
    },
    telegram: {
      enabled: false,
      botToken: '',
      chatId: ''
    },
    sheetSync: {
      url: '',
      lastSyncedAt: '',
      lastSummary: ''
    },
    gsheet: {
      enabled: false,
      webhookUrl: '',
      secretKey: '',
      syncLeads: true,
      syncProducts: true,
      syncNews: true,
      autoPullProducts: false,
      pullIntervalSec: 60
    },
    maintenance: {
      enabled: false,
      mode: 'error404',
      allowedRoute: '/tuvan',
      title: '404 — Hệ thống đang bảo trì',
      message: 'Website đang được nâng cấp và bảo trì định kỳ. Quý khách vui lòng quay lại sau ít phút hoặc liên hệ hotline bên dưới để được hỗ trợ ngay.'
    },
    home: {
      showSlider: true,
      sliderKicker: '★ Nổi bật',
      sliderTitle: 'Tin tức & Dự án nổi bật',
      autoSlide: true,
      sliderIntervalSec: 4.5,
      sliderHeight: 430,
      showQuickCards: true,
      quickCards: [
        { icon: '⚡', title: 'Tư vấn & Tính Pin Hybrid', desc: 'Nhập hóa đơn EVN hoặc số kWh để tính dung lượng pin lưu trữ cần thiết và nhận 3 gợi ý Combo lắp đặt chi tiết.', cta: 'Tính ngay →', href: '/tuvan', primary: true },
        { icon: '🔋', title: 'Sản phẩm & Phụ kiện chính hãng', desc: 'Khám phá Inverter Hybrid, Tấm pin mặt trời, Pin Lithium LFP và trọn bộ Phụ kiện lắp đặt kèm thông số, Datasheet.', cta: 'Xem sản phẩm →', href: '/products', primary: false },
        { icon: '📰', title: 'Kiến thức & Dự án thực tế', desc: 'Cập nhật kinh nghiệm chọn cấu hình, quy định giá điện mới nhất và các công trình Hybrid đã bàn giao.', cta: 'Đọc tin tức →', href: '/news', primary: false }
      ],
      showFeaturedProducts: true,
      productsKicker: 'Thiết bị chính hãng',
      productsTitle: 'Sản phẩm tiêu biểu',
      productsCount: 4,
      showContactCta: true
    },
    hero: {
      show: true,
      badge: 'Giải pháp Điện Mặt Trời Hybrid',
      title: 'Tư vấn dung lượng Pin lưu trữ – Hệ thống Hybrid',
      subtitle: 'Từ hóa đơn tiền điện EVN của khách, quy đổi ra sản lượng kWh và tính dung lượng pin cần lưu cho buổi tối.',
      style: 'gradient', // gradient | solid | mesh
      align: 'left'      // left | center
    },
    theme: {
      preset: 'hoangquan-orange',
      primary: '#F26A1B',
      primaryDeep: '#D9560B',
      gradientEnd: '#FFB400',
      bg: '#F3F5F9',
      cardBg: '#FFFFFF',
      ink: '#111827',
      inkMuted: '#4B5563',
      dayColor: '#F59E0B',
      nightColor: '#1E293B',
      accentGood: '#15803D',
      radius: 18,
      shadowLevel: 'medium', // none | soft | medium | strong
      fontFamily: 'system',  // system | inter | roboto | segoe
      maxWidth: 1160,
      stickyResult: true,
      darkMode: false
    },
    sections: {
      showCustomerName: true,
      showCustomerPhone: true,
      showCustomerAddress: true,
      showQuickChips: true,
      showSliders: true,
      showAdvancedSettings: true,
      showDayNightBar: true,
      showCalcSteps: true,
      showTierTable: true,
      showScenarioTable: true,
      showComboSection: true,
      showComboPrices: false,
      showPrintButton: true,
      showFooterNotes: true,
      showContactCta: true,
      card1Title: 'Mức tiêu thụ điện của khách',
      card2Title: 'Thông số tính pin lưu trữ',
      resultTitle: 'Dung lượng pin cần lưu trữ',
      tierTableTitle: 'Chi tiết hóa đơn theo bậc thang (biểu giá 5 bậc từ 01/11/2026)',
      scenarioTableTitle: 'So sánh theo tỷ lệ dùng điện buổi tối',
      comboTitle: 'Gợi ý Combo lắp đặt trọn bộ (Inverter + Pin mặt trời + Pin lưu trữ)',
      printTitle: 'PHIẾU TƯ VẤN PIN LƯU TRỮ HYBRID',
      printButtonText: 'In / Lưu PDF phiếu tư vấn'
    },
    defaults: {
      mode: 'bill',
      bill: 2000000,
      kwh: 625,
      eve: 70,
      dod: 90,
      eff: 95,
      mod: 5.12,
      vat: 8,
      days: 30,
      sunHours: 4.0,
      billChips: [1000000, 2000000, 3000000, 5000000, 8000000],
      kwhChips: [300, 500, 625, 1000, 1500],
      scenarios: [50, 60, 70, 80, 90]
    },
    tariffs: {
      note: 'Biểu giá mặc định: 5 bậc, áp dụng từ 01/11/2026 (Quyết định 2892/QĐ-BCT). Khi EVN điều chỉnh giá, cập nhật trực tiếp tại trang Quản trị.',
      tiers: DEFAULT_TIERS.map(t => ({ ...t }))
    },
    footer: {
      notesTitle: 'Lưu ý sử dụng',
      notes: [
        'Áp dụng cho 01 hộ / 01 định mức điện sinh hoạt, tính đủ tháng theo biểu giá 5 bậc.',
        'Không bao gồm các khoản điều chỉnh, truy thu, nợ kỳ trước, phí dịch vụ hoặc trường hợp nhiều định mức / hộ thuê trọ.',
        'Kết quả quy đổi từ tiền hóa đơn là ước tính; muốn chính xác nhất hãy nhập đúng sản lượng kWh trên hóa đơn.',
        'Dung lượng pin là kết quả tính toán sơ bộ để tư vấn; thiết kế chi tiết cần khảo sát thực tế.'
      ],
      companyLine: 'CTY HOÀNG QUÂN – Electronics & Energy · 0913 350 597 · 0345 128 688',
      ctaTitle: 'Liên hệ ngay để được tư vấn & khảo sát miễn phí',
      ctaSubtitle: 'Gọi trực tiếp hoặc kết nối qua Zalo để nhận báo giá chi tiết và phương án lắp đặt phù hợp nhất.',
      ctaAddress: '',
      callBtnText: 'Gọi ngay',
      zaloBtnText: 'Chat Zalo'
    },
    updatedAt: new Date().toISOString()
  };
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
  const out = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      out[key] = deepMerge(target[key], val);
    } else if (val !== undefined) {
      out[key] = val;
    }
  }
  return out;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

let memAuth = null;

function fallbackSecret() {
  return crypto.createHash('sha256')
    .update(String(process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'hq-pin-hybrid-secret-v2'))
    .digest('hex');
}


function normalizeAuthState(state) {
  if (!state || typeof state !== 'object') state = {};
  if (!state.sessionSecret) state.sessionSecret = process.env.SESSION_SECRET ? fallbackSecret() : crypto.randomBytes(32).toString('hex');
  if (!Array.isArray(state.users) || !state.users.length) {
    state.users = [{
      username: state.username || 'admin',
      displayName: 'Quản trị viên (Admin)',
      passwordHash: state.passwordHash || hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
      role: 'admin',
      permissions: ALL_PERMISSIONS.slice(),
      active: true,
      protected: true,
      createdAt: state.updatedAt || new Date().toISOString()
    }];
  }
  const rootAdm = state.users.find(u => u && String(u.username).toLowerCase() === 'admin');
  if (rootAdm) {
    rootAdm.role = 'admin';
    rootAdm.active = true;
    rootAdm.protected = true;
    rootAdm.permissions = ALL_PERMISSIONS.slice();
  }
  if (!state.telegram || typeof state.telegram !== 'object') {
    state.telegram = {
      enabled: false,
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      onlyWithContactOrCombo: true
    };
  }
  return state;
}

function loadAuth() {
  try {
    ensureDataDir();
    if (fs.existsSync(AUTH_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
      if (parsed && parsed.passwordHash && parsed.sessionSecret) {
        memAuth = normalizeAuthState(parsed);
        return memAuth;
      }
    }
  } catch {}
  if (memAuth) return normalizeAuthState(memAuth);
  const initial = {
    username: 'admin',
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
    sessionSecret: process.env.SESSION_SECRET ? fallbackSecret() : crypto.randomBytes(32).toString('hex'),
    updatedAt: new Date().toISOString()
  };
  memAuth = normalizeAuthState(initial);
  try {
    ensureDataDir();
    fs.writeFileSync(AUTH_PATH, JSON.stringify(initial, null, 2), 'utf8');
  } catch {
    initial.sessionSecret = fallbackSecret();
  }
  return initial;
}

function saveAuth(authData) {
  authData.updatedAt = new Date().toISOString();
  memAuth = normalizeAuthState(authData);
  try {
    ensureDataDir();
    fs.writeFileSync(AUTH_PATH, JSON.stringify(authData, null, 2), 'utf8');
  } catch {}
  return authData;
}

let memConfig = null;

function loadConfig() {
  if (memConfig) return deepMerge(getDefaultConfig(), memConfig);
  const def = getDefaultConfig();
  try {
    ensureDataDir();
    if (!fs.existsSync(CONFIG_PATH)) {
      try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(def, null, 2), 'utf8'); } catch {}
      memConfig = def;
      return def;
    }
    const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    memConfig = deepMerge(def, saved);
    return memConfig;
  } catch {
    memConfig = def;
    return def;
  }
}

function saveConfig(partialOrFull) {
  ensureDataDir();
  const current = loadConfig();
  const merged = deepMerge(current, partialOrFull);
  // Replace arrays cleanly when explicitly provided
  if (partialOrFull.branding && Array.isArray(partialOrFull.branding.hotlines)) {
    merged.branding.hotlines = partialOrFull.branding.hotlines
      .filter(h => h && String(h.number || '').trim())
      .map(h => ({
        number: String(h.number).trim(),
        tel: String(h.tel || h.number).replace(/[^\d+]/g, ''),
        zalo: String(h.zalo !== undefined ? h.zalo : (h.tel || h.number)).replace(/[^\d]/g, ''),
        label: String(h.label || '').trim()
      }));
  }
  if (partialOrFull.defaults) {
    if (Array.isArray(partialOrFull.defaults.billChips)) {
      merged.defaults.billChips = partialOrFull.defaults.billChips.map(Number).filter(n => n > 0);
    }
    if (Array.isArray(partialOrFull.defaults.kwhChips)) {
      merged.defaults.kwhChips = partialOrFull.defaults.kwhChips.map(Number).filter(n => n > 0);
    }
    if (Array.isArray(partialOrFull.defaults.scenarios)) {
      merged.defaults.scenarios = partialOrFull.defaults.scenarios.map(Number).filter(n => n >= 0 && n <= 100);
    }
  }
  if (partialOrFull.tariffs && Array.isArray(partialOrFull.tariffs.tiers) && partialOrFull.tariffs.tiers.length > 0) {
    merged.tariffs.tiers = partialOrFull.tariffs.tiers.map((t, idx) => ({
      label: String(t.label || `Bậc ${idx + 1}`).trim(),
      size: (t.size === null || t.size === '' || t.size === undefined || Number(t.size) <= 0)
        ? null
        : Number(t.size),
      price: Math.max(0, Number(t.price) || 0)
    }));
  }
  if (partialOrFull.home && Array.isArray(partialOrFull.home.quickCards)) {
    merged.home.quickCards = partialOrFull.home.quickCards.map((c, idx) => ({
      icon: String((c && c.icon) || '⚡').trim().slice(0, 8),
      title: String((c && c.title) || '').trim().slice(0, 120),
      desc: String((c && c.desc) || '').trim().slice(0, 300),
      cta: String((c && c.cta) || 'Xem ngay →').trim().slice(0, 60),
      href: String((c && c.href) || (idx === 0 ? '/tuvan' : idx === 1 ? '/products' : '/news')).trim(),
      primary: Boolean(c && c.primary)
    }));
  }
  if (partialOrFull.footer && Array.isArray(partialOrFull.footer.notes)) {
    merged.footer.notes = partialOrFull.footer.notes.map(s => String(s).trim()).filter(Boolean);
  }

  merged.updatedAt = new Date().toISOString();
  memConfig = merged;
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  } catch {}
  return merged;
}

function resetConfig() {
  ensureDataDir();
  const def = getDefaultConfig();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(def, null, 2), 'utf8');
  return def;
}

module.exports = {
  THEME_PRESETS,
  getDefaultConfig,
  loadConfig,
  saveConfig,
  resetConfig,
  loadAuth,
  saveAuth
};
