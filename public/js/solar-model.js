(function () {
  'use strict';

  const hourCount = 24;
  const rad = degrees => degrees * Math.PI / 180;
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

  // Each row covers one hour. Inverter and storage power caps are therefore also one-hour energy caps.
  function simulate(config) {
    const dcKw = config.panelWp * config.panelCount / 1000;
    const capacity = config.batteryKwh * config.batteryCount;
    const reserve = capacity * 0.1;
    const storagePower = Math.min(config.inverterKw, capacity * 0.5);
    const storageEfficiency = 0.95;
    const azimuth = rad(config.azimuth), tilt = rad(config.tilt);
    const conditions = weather[config.weather];
    const hours = Array.from({ length: hourCount }, (_, hour) => {
      const sun = sunPosition(config.latitude, config.month, hour);
      const irradiance = planeIrradiance(sun, tilt, azimuth, conditions, hour);
      const cellTemp = conditions.temperature + 24 * irradiance;
      const thermalFactor = 1 - 0.0035 * Math.max(0, cellTemp - 25);
      const available = dcKw * irradiance * thermalFactor * 0.94 * 0.97;
      const weight = hour >= 18 && hour <= 22 ? 2.45 : hour >= 6 && hour <= 8 ? 1.35 : hour <= 5 ? 0.42 : 0.86;
      return { hour, sun, irradiance, pv: Math.min(available, config.inverterKw),
        clipping: Math.max(0, available - config.inverterKw), weight };
    });
    const totalWeight = hours.reduce((sum, row) => sum + row.weight, 0);
    let stored = capacity * Math.max(10, config.initialSoc) / 100;
    const results = hours.map(({ weight, ...row }) => {
      const load = config.dailyLoad * weight / totalWeight;
      const direct = Math.min(row.pv, load);
      const surplus = row.pv - direct;
      const deficit = load - direct;
      const charge = Math.min(surplus, storagePower, Math.max(0, capacity - stored) / storageEfficiency);
      const discharge = Math.min(deficit, storagePower, Math.max(0, stored - reserve) * storageEfficiency);
      stored += charge * storageEfficiency - discharge / storageEfficiency;
      return { ...row, load, direct, charge, discharge, grid: deficit - discharge,
        surplus: surplus - charge, soc: capacity > 0 ? stored / capacity * 100 : 0 };
    });
    const totals = {};
    for (const key of ['pv', 'load', 'direct', 'charge', 'discharge', 'grid', 'surplus', 'clipping']) {
      totals[key] = results.reduce((sum, row) => sum + row[key], 0);
    }
    return { results, totals, dcKw, capacity };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { simulate };
  else window.SolarModel = { simulate };
})();
