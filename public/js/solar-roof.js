(function () {
  'use strict';

  const edge = 0.20;
  const gap = 0.06;
  const snap = value => Math.round(value * 10) / 10;
  const upToCentimetre = value => Math.ceil(value * 100 - 1e-6) / 100;
  const radians = degrees => degrees * Math.PI / 180;
  const limit = 60;

  function parseMeasure(value, min, max) {
    const input = value.trim();
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(input)) return null;
    const result = Number(input.replace(',', '.'));
    return result >= min && result <= max ? result : null;
  }

  function moduleSize(specs) {
    const factors = { mm: 0.001, cm: 0.01, m: 1 };
    const pattern = /\b(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[×x*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?(?:\s*[×x*]\s*\d+(?:[.,]\d+)?\s*(mm|cm|m)?)?/gi;
    for (const [, first, firstUnit, second, secondUnit, lastUnit] of String(specs || '').matchAll(pattern)) {
      const unit = (lastUnit || secondUnit || firstUnit)?.toLowerCase();
      if (!unit) continue;
      const metres = (number, specificUnit) => Number(number.replace(',', '.')) * factors[specificUnit?.toLowerCase() || unit];
      const [width, length] = [metres(first, firstUnit), metres(second, secondUnit)].sort((a, b) => a - b);
      if (width >= 0.4 && length <= 4) return { width, length, estimated: false };
    }
    return { width: 1.134, length: 2.278, estimated: true };
  }

  function faces(roof) {
    if (roof.type === 'gable') {
      return [
        { from: 0, to: roof.depth / 2, azimuth: (roof.azimuth + 180) % 360, tilt: roof.tilt },
        { from: roof.depth / 2, to: roof.depth, azimuth: roof.azimuth, tilt: roof.tilt }
      ];
    }
    return [{ from: 0, to: roof.depth, azimuth: roof.azimuth, tilt: roof.type === 'flat' ? 0 : roof.tilt }];
  }

  function elevation(roof, z) {
    const end = roof.depth / 2;
    const run = roof.type === 'gable' ? end - Math.abs(z) : end - z;
    return roof.type === 'flat' ? 0 : Math.tan(radians(roof.tilt)) * run;
  }

  function dimensions(panel, size, roof) {
    const width = panel.rotated ? size.length : size.width;
    const length = panel.rotated ? size.width : size.length;
    return { width, depth: length * Math.cos(radians(roof.type === 'flat' ? 0 : roof.tilt)) };
  }

  function faceAt(panel, footprint, roof) {
    return faces(roof).findIndex(face => panel.z >= face.from + edge - 1e-6 &&
      panel.z + footprint.depth <= face.to - edge + 1e-6);
  }

  function fits(panel, panels, size, roof) {
    const footprint = dimensions(panel, size, roof);
    if (panel.x < edge - 1e-6 || panel.x + footprint.width > roof.width - edge + 1e-6 ||
        faceAt(panel, footprint, roof) < 0) return false;
    return panels.every(other => {
      if (panel.id !== undefined && other.id === panel.id) return true;
      const occupied = dimensions(other, size, roof);
      return panel.x + footprint.width + gap <= other.x + 1e-6 ||
        other.x + occupied.width + gap <= panel.x + 1e-6 ||
        panel.z + footprint.depth + gap <= other.z + 1e-6 ||
        other.z + occupied.depth + gap <= panel.z + 1e-6;
    });
  }

  function pack(panels, count, size, roof, orientations, roofFaces = faces(roof).reverse()) {
    const placed = panels.slice(0, count);
    for (const face of roofFaces) {
      for (const rotated of orientations) {
        const footprint = dimensions({ rotated }, size, roof);
        const dx = upToCentimetre(footprint.width + gap);
        const dz = upToCentimetre(footprint.depth + gap);
        const firstRow = upToCentimetre(face.from + edge);
        for (let z = firstRow; placed.length < count && z + footprint.depth <= face.to - edge + 1e-6; z += dz) {
          for (let x = edge; placed.length < count && x + footprint.width <= roof.width - edge + 1e-6; x += dx) {
            const panel = { x: upToCentimetre(x), z: upToCentimetre(z), rotated };
            if (fits(panel, placed, size, roof)) placed.push(panel);
          }
        }
      }
    }
    return placed;
  }

  function fill(panels, count, size, roof, createId) {
    let layout = pack(panels, count, size, roof, [false, true]);
    if (layout.length < count) {
      const landscapeFirst = pack(panels, count, size, roof, [true, false]);
      if (landscapeFirst.length > layout.length) layout = landscapeFirst;
    }
    return layout.map(panel => panel.id === undefined ? { ...panel, id: createId() } : panel);
  }

  function balance(count, main, annex, size) {
    const capacity = roof => fill([], limit, size, roof, () => 0).length;
    const mainLimit = capacity(main), annexLimit = capacity(annex);
    const placed = Math.min(count, mainLimit + annexLimit);
    const onMain = Math.min(mainLimit, Math.max(Math.ceil(placed / 2), placed - annexLimit));
    return { main: onMain, annex: placed - onMain, remainder: count - placed };
  }

  function centerFace(count, size, roof, face) {
    let best = [];
    for (const rotated of [false, true]) {
      const { width, depth } = dimensions({ rotated }, size, roof);
      const columns = Math.floor((roof.width - 2 * edge + gap + 1e-6) / (width + gap));
      const rows = Math.floor((face.to - face.from - 2 * edge + gap + 1e-6) / (depth + gap));
      const placed = Math.min(count, Math.max(0, columns) * Math.max(0, rows));
      if (placed <= best.length) continue;
      const usedRows = Math.min(placed, rows);
      const firstZ = (face.from + face.to - usedRows * depth - (usedRows - 1) * gap) / 2;
      best = [];
      for (let row = 0; row < usedRows; row++) {
        const inRow = Math.floor(placed / usedRows) + (row < placed % usedRows ? 1 : 0);
        const firstX = (roof.width - inRow * width - (inRow - 1) * gap) / 2;
        for (let column = 0; column < inRow; column++) {
          best.push({ x: firstX + column * (width + gap), z: firstZ + row * (depth + gap), rotated });
        }
      }
    }
    if (best.length === count) return best;
    // Mixed orientations can fit more modules in a tight space.
    for (const order of [[false, true], [true, false]]) {
      const mixed = pack([], count, size, roof, order, [face]);
      if (mixed.length <= best.length) continue;
      const right = Math.max(...mixed.map(panel => panel.x + dimensions(panel, size, roof).width));
      const bottom = Math.max(...mixed.map(panel => panel.z + dimensions(panel, size, roof).depth));
      const dx = (roof.width - right - Math.min(...mixed.map(panel => panel.x))) / 2;
      const dz = (face.from + face.to - bottom - Math.min(...mixed.map(panel => panel.z))) / 2;
      best = mixed.map(panel => ({ ...panel, x: panel.x + dx, z: panel.z + dz }));
    }
    return best;
  }

  function balanceOnRoof(count, size, roof, createId) {
    const roofFaces = faces(roof);
    let panels;
    if (roofFaces.length === 1) {
      panels = centerFace(count, size, roof, roofFaces[0]);
    } else {
      const [back, front] = roofFaces;
      const frontLimit = centerFace(count, size, roof, front).length;
      const backLimit = centerFace(count, size, roof, back).length;
      const placed = Math.min(count, frontLimit + backLimit);
      const onFront = Math.min(frontLimit, Math.max(Math.ceil(placed / 2), placed - backLimit));
      panels = [...centerFace(onFront, size, roof, front), ...centerFace(placed - onFront, size, roof, back)];
    }
    return panels.map(panel => ({ ...panel, id: createId() }));
  }

  function arrays(panels, size, roof) {
    const groups = faces(roof).map(face => ({ azimuth: face.azimuth, tilt: face.tilt, count: 0 }));
    for (const panel of panels) {
      const index = faceAt(panel, dimensions(panel, size, roof), roof);
      if (index >= 0) groups[index].count++;
    }
    return groups.filter(group => group.count > 0);
  }

  const api = { limit, snap, parseMeasure, moduleSize, faces, elevation, dimensions, fits, fill, arrays, balance, balanceOnRoof };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.SolarRoof = api;
})();
