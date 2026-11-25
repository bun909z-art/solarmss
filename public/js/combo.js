(function (global) {
  'use strict';

  function recommendCombos({ kwhMonth, batNeededKwh, days = 30, sunHours = 4.0, products = [] }) {
    if (!kwhMonth || kwhMonth <= 0) return [];
    const active = products.filter(p => p && p.active !== false);
    const inverters = active.filter(p => p.category === 'inverter').sort((a, b) => a.powerKw - b.powerKw || a.price - b.price);
    const panels = active.filter(p => p.category === 'panel').sort((a, b) => a.price / a.wattWp - b.price / b.wattWp);
    const batteries = active.filter(p => p.category === 'battery').sort((a, b) => a.capacityKwh - b.capacityKwh || a.price - b.price);

    if (!inverters.length || !panels.length || !batteries.length) return [];

    const dailyKwh = kwhMonth / Math.max(1, days);
    const perfRatio = 0.80;
    const targetKwp = Math.max(2, dailyKwh / (Math.max(2, sunHours) * perfRatio));

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
      const totalPrice = invTotal + panelTotal + batTotal;

      return {
        key: tierKey,
        badge,
        title,
        desc,
        inverter: inv,
        panel,
        panelCount,
        solarKwp,
        battery: bat,
        batCount,
        batTotalKwh,
        invTotal,
        panelTotal,
        batTotal,
        totalPrice
      };
    }

    const combos = [];

    // 1. Gói Tiêu chuẩn (Tối ưu chi phí)
    const econPanel = panels[0];
    const econBat = batteries.slice().sort((a, b) => {
      const ca = Math.max(1, Math.ceil(batNeededKwh / a.capacityKwh - 1e-9)) * a.price;
      const cb = Math.max(1, Math.ceil(batNeededKwh / b.capacityKwh - 1e-9)) * b.price;
      return ca - cb;
    })[0];
    const econInv = pickInverter(targetKwp, 0);
    combos.push(buildCombo(
      'economy',
      'Tiết kiệm',
      'Gói Tiêu chuẩn – Tối ưu chi phí',
      'Đáp ứng đúng nhu cầu điện ban ngày và lưu trữ buổi tối với mức đầu tư hợp lý nhất.',
      econPanel, econInv, econBat, 0, 0
    ));

    // 2. Gói Khuyên dùng (Cân bằng, ít module gọn đẹp)
    const midPanel = panels.length > 1 ? panels[Math.min(1, panels.length - 1)] : panels[0];
    const bestFitBat = batteries.slice().sort((a, b) => {
      const ma = Math.max(1, Math.ceil(batNeededKwh / a.capacityKwh - 1e-9));
      const mb = Math.max(1, Math.ceil(batNeededKwh / b.capacityKwh - 1e-9));
      const wasteA = Math.abs(ma * a.capacityKwh - batNeededKwh * 1.15);
      const wasteB = Math.abs(mb * b.capacityKwh - batNeededKwh * 1.15);
      return (ma - mb) * 2 + (wasteA - wasteB);
    })[0];
    const midInv = pickInverter(targetKwp * 1.05, 0);
    combos.push(buildCombo(
      'recommended',
      'Khuyên dùng',
      'Gói Cân bằng – Hiệu suất cao',
      'Tối ưu số lượng module pin gọn gàng, tấm pin hiệu suất cao, vận hành ổn định lâu dài.',
      midPanel, midInv, bestFitBat, 0, 1
    ));

    // 3. Gói Cao cấp / Dự phòng mở rộng
    const premPanel = panels.slice().sort((a, b) => b.wattWp - a.wattWp)[0];
    const premBat = batteries[batteries.length - 1];
    const premInv = pickInverter(targetKwp * 1.15, 1);
    combos.push(buildCombo(
      'premium',
      'Dự phòng cao',
      'Gói Cao cấp – Dư tải mở rộng',
      'Công suất Inverter và dung lượng lưu trữ dư dả cho ngày ít nắng hoặc lắp thêm thiết bị sau này.',
      premPanel, premInv, premBat, batNeededKwh > premBat.capacityKwh ? 1 : 0, 2
    ));

    return combos;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { recommendCombos };
  } else {
    global.HQCombo = { recommendCombos };
  }
})(typeof window !== 'undefined' ? window : globalThis);
