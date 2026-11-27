(function (global) {
  'use strict';

  const DEFAULT_TIERS = [
    { label: '0 – 100',   size: 100,  price: 1901 },
    { label: '101 – 200', size: 100,  price: 2289 },
    { label: '201 – 400', size: 200,  price: 2894 },
    { label: '401 – 700', size: 300,  price: 3456 },
    { label: 'Từ 701',    size: null, price: 3844 }
  ];

  function normalizeTiers(tiers) {
    if (!Array.isArray(tiers) || tiers.length === 0) tiers = DEFAULT_TIERS;
    return tiers.map((t, idx) => ({
      label: String(t.label || `Bậc ${idx + 1}`),
      size: (t.size === null || t.size === undefined || t.size === '' || !isFinite(Number(t.size)))
        ? Infinity
        : Math.max(1, Number(t.size)),
      price: Math.max(0, Number(t.price) || 0)
    }));
  }

  function preVatFromKwh(kwh, tiers) {
    const list = normalizeTiers(tiers);
    let rest = Math.max(0, Number(kwh) || 0);
    let sum = 0;
    for (let i = 0; i < list.length; i++) {
      const use = Math.min(rest, list[i].size);
      sum += use * list[i].price;
      rest -= use;
      if (rest <= 0) break;
    }
    return Math.round(sum);
  }

  function kwhFromPreVat(pre, tiers) {
    const list = normalizeTiers(tiers);
    let rest = Math.max(0, Number(pre) || 0);
    let used = 0;
    for (let i = 0; i < list.length; i++) {
      const size = list[i].size;
      const price = list[i].price;
      if (price <= 0) continue;
      const cost = size * price;
      if (rest <= cost) {
        used += rest / price;
        return used;
      }
      rest -= cost;
      used += size;
    }
    return used;
  }

  function tierBreakdown(kwh, tiers) {
    const list = normalizeTiers(tiers);
    let rest = Math.max(0, Number(kwh) || 0);
    return list.map(t => {
      const use = Math.min(rest, t.size);
      rest -= use;
      return {
        label: t.label,
        price: t.price,
        kwh: use,
        amount: use * t.price
      };
    });
  }

  function batteryKwh(kwhMonth, eve, dod, eff, days) {
    const d = days * dod * eff;
    return d > 0 ? (kwhMonth * eve) / d : 0;
  }

  function countModules(battery, moduleKwh) {
    return battery > 0 && moduleKwh > 0 ? Math.max(1, Math.ceil(battery / moduleKwh - 1e-9)) : 0;
  }

  function calculateRecommendation({ mode, bill, kwh, eve, dod, eff, mod, vat, days, tiers }) {
    const isBill = mode === 'bill';
    const taxRate = vat / 100;
    const preVat = isBill ? bill / (1 + taxRate) : preVatFromKwh(kwh, tiers);
    const kwhExact = isBill ? kwhFromPreVat(preVat, tiers) : kwh;
    const kwhUsed = isBill ? Math.round(kwhExact) : kwh;
    const billTotal = isBill ? bill : preVat + Math.round(preVat * taxRate);
    const eveRate = eve / 100;
    const eveDay = (kwhUsed / days) * eveRate;
    const bat = batteryKwh(kwhUsed, eveRate, dod / 100, eff / 100, days);
    const modules = countModules(bat, mod);
    return { kwhExact, kwhUsed, preVat, billTotal, bat, modules, eveDay };
  }

  const calculator = {
    DEFAULT_TIERS,
    preVatFromKwh,
    tierBreakdown,
    batteryKwh,
    countModules,
    calculateRecommendation
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = calculator;
  else global.HQCalc = calculator;
})(globalThis);
