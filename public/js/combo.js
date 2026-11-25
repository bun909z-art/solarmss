(function (global) {
  'use strict';

  function shuffleWithSeed(arr, seed) {
    const out = arr.slice();
    let s = (Number(seed) || 1) * 9301 + 49297;
    for (let i = out.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function recommendCombos({ kwhMonth, batNeededKwh, days = 30, sunHours = 4.0, products = [], mixSeeds = [0, 0, 0] }) {
    if (!kwhMonth || kwhMonth <= 0) return [];
    const active = products.filter(p => p && p.active !== false);
    const inverters = active.filter(p => p.category === 'inverter').sort((a, b) => a.powerKw - b.powerKw || a.price - b.price);
    const panels = active.filter(p => p.category === 'panel').sort((a, b) => a.price / a.wattWp - b.price / b.wattWp);
    const batteries = active.filter(p => p.category === 'battery').sort((a, b) => a.capacityKwh - b.capacityKwh || a.price - b.price);

    if (!inverters.length || !panels.length || !batteries.length) return [];

    const dailyKwh = kwhMonth / Math.max(1, days);
    const targetKwp = Math.max(2, dailyKwh / (Math.max(2, sunHours) * 0.80));
    const eligibleInvs = inverters.filter(inv => inv.powerKw >= targetKwp * 0.72);
    const invBasePool = eligibleInvs.length ? eligibleInvs : inverters;

    function pickInverter(kwp, stepUp = 0) {
      const minAc = kwp * 0.78;
      let idx = inverters.findIndex(inv => inv.powerKw >= minAc);
      if (idx === -1) idx = inverters.length - 1;
      idx = Math.min(inverters.length - 1, idx + stepUp);
      return inverters[idx];
    }

    function buildCombo(tierKey, badge, title, desc, panel, inv, bat, extraBatMod = 0, extraPanels = 0) {
      const panelCount = Math.max(4, Math.ceil((targetKwp * 1000) / panel.wattWp) + extraPanels);
      const solarKwp = (panelCount * panel.wattWp) / 1000;
      const batCount = Math.max(1, Math.ceil(batNeededKwh / bat.capacityKwh - 1e-9) + extraBatMod);
      const batTotalKwh = batCount * bat.capacityKwh;

      const invTotal = inv.price || 0;
      const panelTotal = panelCount * (panel.price || 0);
      const batTotal = batCount * (bat.price || 0);
      return {
        key: tierKey, badge, title, desc,
        inverter: inv, panel, panelCount, solarKwp,
        battery: bat, batCount, batTotalKwh,
        invTotal, panelTotal, batTotal,
        totalPrice: invTotal + panelTotal + batTotal
      };
    }

    const econBat = batteries.slice().sort((a, b) =>
      Math.max(1, Math.ceil(batNeededKwh / a.capacityKwh - 1e-9)) * a.price -
      Math.max(1, Math.ceil(batNeededKwh / b.capacityKwh - 1e-9)) * b.price
    )[0];

    const bestFitBat = batteries.slice().sort((a, b) => {
      const ma = Math.max(1, Math.ceil(batNeededKwh / a.capacityKwh - 1e-9));
      const mb = Math.max(1, Math.ceil(batNeededKwh / b.capacityKwh - 1e-9));
      return (ma - mb) * 2 + (Math.abs(ma * a.capacityKwh - batNeededKwh * 1.15) - Math.abs(mb * b.capacityKwh - batNeededKwh * 1.15));
    })[0];

    const midPanel = panels[Math.min(1, panels.length - 1)];
    const premPanel = panels.slice().sort((a, b) => b.wattWp - a.wattWp)[0];
    const premBat = batteries[batteries.length - 1];

    const defaults = [
      { key: 'economy', badge: 'Tiêu chuẩn', title: 'Gói Tiêu chuẩn – Tối ưu cấu hình', desc: 'Đáp ứng đúng nhu cầu điện ban ngày và lưu trữ buổi tối của gia đình.', panel: panels[0], inv: pickInverter(targetKwp, 0), bat: econBat, exBat: 0, exPan: 0 },
      { key: 'recommended', badge: 'Khuyên dùng', title: 'Gói Cân bằng – Hiệu suất cao', desc: 'Tối ưu số lượng module pin gọn gàng, tấm pin hiệu suất cao, vận hành ổn định.', panel: midPanel, inv: pickInverter(targetKwp * 1.05, 0), bat: bestFitBat, exBat: 0, exPan: 1 },
      { key: 'premium', badge: 'Dự phòng cao', title: 'Gói Cao cấp – Dư tải mở rộng', desc: 'Công suất Inverter và dung lượng lưu trữ dư dả cho ngày ít nắng hoặc mở rộng sau này.', panel: premPanel, inv: pickInverter(targetKwp * 1.15, 1), bat: premBat, exBat: batNeededKwh > premBat.capacityKwh ? 1 : 0, exPan: 2 }
    ];

    const seeds = Array.isArray(mixSeeds) ? mixSeeds : [0, 0, 0];
    return defaults.map((d, idx) => {
      const sd = Number(seeds[idx]) || 0;
      if (sd > 0) {
        const ip = shuffleWithSeed(invBasePool, sd * 3 + idx + 1);
        const pp = shuffleWithSeed(panels, sd * 7 + idx + 5);
        const bp = shuffleWithSeed(batteries, sd * 11 + idx + 9);
        return buildCombo(d.key, `${d.badge} · Mix`, d.title, d.desc, pp[0], ip[0], bp[0], d.exBat, d.exPan);
      }
      return buildCombo(d.key, d.badge, d.title, d.desc, d.panel, d.inv, d.bat, d.exBat, d.exPan);
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { recommendCombos };
  } else {
    global.HQCombo = { recommendCombos };
  }
})(typeof window !== 'undefined' ? window : globalThis);
