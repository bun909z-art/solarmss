(function () {
  'use strict';

  const edge = 0.20;
  const gap = 0.06;
  const snap = value => Math.round(value * 10) / 10;
  const radians = degrees => degrees * Math.PI / 180;
  const limit = 60;

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
    const start = -roof.depth / 2, end = roof.depth / 2;
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
      if (other.id === panel.id) return true;
      const occupied = dimensions(other, size, roof);
      return panel.x + footprint.width + gap <= other.x + 1e-6 ||
        other.x + occupied.width + gap <= panel.x + 1e-6 ||
        panel.z + footprint.depth + gap <= other.z + 1e-6 ||
        other.z + occupied.depth + gap <= panel.z + 1e-6;
    });
  }

  function fill(panels, count, size, roof, createId) {
    const placed = panels.slice(0, count);
    for (const face of faces(roof).reverse()) {
      for (const rotated of [false, true]) {
        const footprint = dimensions({ rotated }, size, roof);
        const dx = Math.ceil((footprint.width + gap) * 10) / 10;
        const dz = Math.ceil((footprint.depth + gap) * 10) / 10;
        const firstRow = Math.ceil((face.from + edge - 1e-6) * 10) / 10;
        for (let z = firstRow; placed.length < count && z + footprint.depth <= face.to - edge + 1e-6; z += dz) {
          for (let x = edge; placed.length < count && x + footprint.width <= roof.width - edge + 1e-6; x += dx) {
            const panel = { x: snap(x), z: snap(z), rotated };
            if (fits(panel, placed, size, roof)) placed.push({ ...panel, id: createId() });
          }
        }
      }
    }
    return placed;
  }

  function arrays(panels, size, roof) {
    const groups = faces(roof).map(face => ({ azimuth: face.azimuth, tilt: face.tilt, count: 0 }));
    for (const panel of panels) {
      const index = faceAt(panel, dimensions(panel, size, roof), roof);
      if (index >= 0) groups[index].count++;
    }
    return groups.filter(group => group.count > 0);
  }

  const api = { limit, snap, faces, elevation, dimensions, fits, fill, arrays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.SolarRoof = api;
})();
