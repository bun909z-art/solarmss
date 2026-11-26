(function () {
  'use strict';

  const hourCount = 24;
  const rad = degrees => degrees * Math.PI / 180;
  const householdProfile = [
    .07, .024, .01, 0, 0, .07, .41, .72, .13, .07, .15, .19,
    .54, .32, .08, .11, .17, .43, .86, 1, .69, .48, .19, .08
  ];
  const loadOrder = householdProfile.map((weight, hour) => ({ hour, weight }))
    .filter(row => row.weight > 0).sort((a, b) => b.weight - a.weight);
  const totalLoadWeight = loadOrder.reduce((sum, row) => sum + row.weight, 0);
  const weather = {
    sunny: { beam: 1, diffuse: 1, temperature: 32 },
    variable: { beam: 0.62, diffuse: 1.45, temperature: 29 },
    overcast: { beam: 0.12, diffuse: 1.30, temperature: 27 },
    rain: { beam: 0.035, diffuse: 0.65, temperature: 25 }
  };

  function sunPosition(latitude, month, hour) {
    const dayOfYear = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1];
    const declination = rad(23.44) * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
    const lat = rad(latitude);
    const angle = rad((hour + 0.5 - 12) * 15);
    return {
      east: -Math.cos(declination) * Math.sin(angle),
      north: Math.cos(lat) * Math.sin(declination) - Math.sin(lat) * Math.cos(declination) * Math.cos(angle),
      up: Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(angle)
    };
  }

  function planeIrradiance(sun, tilt, azimuth, conditions, hour) {
    if (sun.up <= 0) return 0;
    const breeze = conditions === weather.variable ? 0.78 + 0.22 * Math.cos(hour * 1.64) : 1;
    const direct = 0.94 * sun.up ** 0.23 * conditions.beam * breeze;
    const diffuse = 0.15 * sun.up * conditions.diffuse;
    const incidence = sun.up * Math.cos(tilt) + Math.sin(tilt) *
      (sun.north * Math.cos(azimuth) + sun.east * Math.sin(azimuth));
    const reflected = (direct * sun.up + diffuse) * 0.20 * (1 - Math.cos(tilt)) / 2;
    return direct * Math.max(0, incidence) + diffuse * (1 + Math.cos(tilt)) / 2 + reflected;
  }

  function planStrings(arrays, requested, inverterGroups) {
    const banks = inverterGroups.flatMap(group => Array.from({ length: group.count }, () => ({
      name: group.name, kw: group.kw, panels: 0
    })));
    const groups = arrays.filter(array => array.count > 0).map(array => ({ ...array, strings: 1 }));
    const panels = groups.reduce((sum, array) => sum + array.count, 0);
    const target = Math.min(panels, Math.max(requested, groups.length));
    for (let total = groups.length; total < target; total++) {
      const open = groups.filter(group => group.strings < group.count);
      const next = open.reduce((best, group) => group.count / group.strings > best.count / best.strings ? group : best);
      next.strings++;
    }
    const strings = groups.flatMap(group => {
      const each = Math.floor(group.count / group.strings);
      const extra = group.count % group.strings;
      return Array.from({ length: group.strings }, (_, index) => ({
        roof: group.roof, azimuth: group.azimuth, tilt: group.tilt, count: each + (index < extra ? 1 : 0)
      }));
    });
    for (const string of [...strings].sort((a, b) => b.count - a.count)) {
      const inverter = banks.reduce((best, unit, index) =>
        (unit.panels + string.count) / unit.kw < (banks[best].panels + string.count) / banks[best].kw ? index : best, 0);
      banks[inverter].panels += string.count;
      string.inverter = inverter;
    }
    return { strings, banks };
  }

  function hourlyLoads(config, inverterKw) {
    const limit = Math.min(20, inverterKw);
    if (config.loadMode === 'peak') {
      const peak = Math.min(limit, Math.max(0, config.peakLoad ?? 20));
      return householdProfile.map(weight => peak * weight);
    }
    const cap = config.loadMode === 'daily' ? limit : Infinity;
    const loads = Array(hourCount).fill(0);
    let remaining = Math.min(config.dailyLoad, cap * loadOrder.length);
    let remainingWeight = totalLoadWeight;
    for (const { hour, weight } of loadOrder) {
      const load = Math.min(cap, Math.max(0, remaining * weight / remainingWeight));
      loads[hour] = load;
      remaining -= load;
      remainingWeight -= weight;
    }
    return loads;
  }

  // Each row covers one hour. Inverter and storage power caps are therefore also one-hour energy caps.
  function simulate(config) {
    const dcKw = config.panelWp * config.panelCount / 1000;
    const inverterCaps = config.topology?.banks.map(unit => unit.kw) || [config.inverterKw];
    const inverterKw = inverterCaps.reduce((sum, kw) => sum + kw, 0);
    const loads = hourlyLoads(config, inverterKw);
    const capacity = config.batteryGroups
      ? config.batteryGroups.reduce((sum, group) => sum + group.kwh * group.count, 0)
      : config.batteryKwh * config.batteryCount;
    const reserve = capacity * 0.1;
    const storagePower = Math.min(inverterKw, capacity * 0.5);
    const storageEfficiency = 0.95;
    const pvGroups = config.topology?.strings || config.arrays ||
      [{ count: config.panelCount, azimuth: config.azimuth, tilt: config.tilt }];
    const arrays = pvGroups.filter(array => array.count > 0).map(array => ({
      dcKw: config.panelWp * array.count / 1000, tilt: rad(array.tilt), azimuth: rad(array.azimuth),
      inverter: array.inverter ?? 0
    }));
    const conditions = weather[config.weather];
    const hours = Array.from({ length: hourCount }, (_, hour) => {
      const sun = sunPosition(config.latitude, config.month, hour);
      const available = inverterCaps.map(() => 0);
      let weightedIrradiance = 0;
      for (const array of arrays) {
        const irradiance = planeIrradiance(sun, array.tilt, array.azimuth, conditions, hour);
        const cellTemp = conditions.temperature + 24 * irradiance;
        const thermalFactor = 1 - 0.0035 * Math.max(0, cellTemp - 25);
        weightedIrradiance += array.dcKw * irradiance;
        available[array.inverter] += array.dcKw * irradiance * thermalFactor * 0.94 * 0.97;
      }
      const inverterProduction = available.map((power, index) => Math.min(power, inverterCaps[index]));
      const pv = inverterProduction.reduce((sum, power) => sum + power, 0);
      const clipping = available.reduce((sum, power, index) => sum + Math.max(0, power - inverterCaps[index]), 0);
      return { hour, sun, irradiance: dcKw ? weightedIrradiance / dcKw : 0, pv, clipping, inverterProduction };
    });
    let stored = capacity * Math.max(10, config.initialSoc) / 100;
    const results = hours.map(row => {
      const load = loads[row.hour];
      const direct = Math.min(row.pv, load);
      const surplus = row.pv - direct;
      const deficit = load - direct;
      const charge = Math.min(surplus, storagePower, Math.max(0, capacity - stored) / storageEfficiency);
      const discharge = Math.min(deficit, storagePower, Math.max(0, inverterKw - row.pv),
        Math.max(0, stored - reserve) * storageEfficiency);
      stored += charge * storageEfficiency - discharge / storageEfficiency;
      const remaining = surplus - charge;
      return { ...row, load, direct, charge, discharge, grid: deficit - discharge,
        surplus: remaining, export: config.exportSurplus ? remaining : 0, soc: capacity > 0 ? stored / capacity * 100 : 0 };
    });
    const totals = {};
    for (const key of ['pv', 'load', 'direct', 'charge', 'discharge', 'grid', 'surplus', 'export', 'clipping']) {
      totals[key] = results.reduce((sum, row) => sum + row[key], 0);
    }
    return { results, totals, dcKw, capacity, inverterKw, loadPeak: Math.max(...loads) };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { simulate, planStrings };
  else window.SolarModel = { simulate, sunPosition, planStrings };
})();
