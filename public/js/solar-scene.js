(function () {
  'use strict';

  const radians = degrees => degrees * Math.PI / 180;

  function draw(canvas, config, sun, angle, elevation) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * density), pixelHeight = Math.round(height * density);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(density, 0, 0, density, 0, 0);

    const daylight = sun.up > 0;
    const clear = config.weather === 'sunny';
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, daylight ? (clear ? '#163f57' : '#26374d') : '#0a1121');
    sky.addColorStop(1, daylight ? (clear ? '#5a8190' : '#516773') : '#1b2d45');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    const camera = { cos: Math.cos(angle), sin: Math.sin(angle) };
    const pitch = { cos: Math.cos(elevation), sin: Math.sin(elevation) };
    const heading = radians(config.azimuth);
    const facing = { cos: Math.cos(heading), sin: Math.sin(heading) };

    if (daylight) {
      const x = width * (0.5 + 0.36 * (sun.east * camera.cos - sun.north * camera.sin));
      const y = height * (0.28 - 0.19 * sun.up);
      const glow = ctx.createRadialGradient(x, y, 3, x, y, 31);
      glow.addColorStop(0, clear ? '#ffd876e8' : '#d3e4e49c');
      glow.addColorStop(1, '#fff3bc00');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 31, y - 31, 62, 62);
      ctx.fillStyle = clear ? '#fff0b2' : '#dbe5e4';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (clear) {
      ctx.fillStyle = '#aac2e4';
      for (let i = 0; i < 30; i++) ctx.fillRect((i * 113 % 353) / 353 * width, (i * 37 % 97) / 97 * height * 0.48, 1.4, 1.4);
    }
    if (!clear) {
      const count = config.weather === 'variable' ? 3 : 6;
      ctx.fillStyle = daylight ? '#d9e4e639' : '#a9bfdb1c';
      for (let i = 0; i < count; i++) {
        const x = width * (0.07 + i * (0.86 / (count - 1)));
        const y = height * (0.12 + (i * 7 % 4) * 0.048);
        ctx.beginPath();
        ctx.ellipse(x, y, width * 0.13, height * 0.040, -0.06, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const columns = Math.min(7, Math.max(2, Math.ceil(Math.sqrt(config.panelCount * 1.6))));
    const rows = Math.ceil(config.panelCount / columns);
    const roofLength = Math.max(3.5, rows * 1.34 + 0.9);
    const halfX = (columns * 0.88 + 0.9) / 2;
    const halfZ = roofLength / 2;
    const roofSlope = Math.tan(radians(config.tilt));
    const roof = z => 1.55 + (halfZ - z) * roofSlope;
    const radius = Math.hypot(halfX, halfZ);
    const rooftop = roof(-halfZ);
    const scale = Math.min(width / (radius * 2.58), height * 0.82 / (radius * 2 * pitch.sin + rooftop * pitch.cos));
    const anchorY = height * 0.56 + scale * rooftop * pitch.cos * 0.45;

    function project([x, y, z], local = true) {
      const east = local ? x * facing.cos + z * facing.sin : x;
      const north = local ? -x * facing.sin + z * facing.cos : z;
      const depth = east * camera.sin + north * camera.cos;
      return {
        x: width / 2 + (east * camera.cos - north * camera.sin) * scale,
        y: anchorY + (depth * pitch.sin - y * pitch.cos) * scale,
        depth: depth * pitch.cos + y * pitch.sin
      };
    }

    function path(points, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      if (fill) {
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    }

    const ground = radius * 1.35;
    const floor = [[-ground, 0, -ground], [ground, 0, -ground], [ground, 0, ground], [-ground, 0, ground]];
    path(floor.map(point => project(point, false)), daylight ? '#254941' : '#152c37', '#a2c1cc60');
    for (let i = -5; i <= 5; i++) {
      const tick = ground * i / 5;
      path([[-ground, 0, tick], [ground, 0, tick]].map(point => project(point, false)), null, '#aac6cc25');
      path([[tick, 0, -ground], [tick, 0, ground]].map(point => project(point, false)), null, '#aac6cc25');
    }

    const faces = [];
    function face(coords, color, border = '#14222e') {
      const points = coords.map(point => project(point));
      faces.push({ points, color, border, depth: points.reduce((sum, point) => sum + point.depth, 0) / points.length });
    }
    const corners = [[-halfX, -halfZ], [halfX, -halfZ], [halfX, halfZ], [-halfX, halfZ]];
    const wallColors = daylight ? ['#839998', '#a7b8b4', '#d0dbd4', '#648580'] : ['#344653', '#455564', '#5f7180', '#35485a'];
    corners.forEach(([x, z], i) => {
      const [nextX, nextZ] = corners[(i + 1) % 4];
      face([[x, 0.04, z], [nextX, 0.04, nextZ], [nextX, roof(nextZ), nextZ], [x, roof(z), z]], wallColors[i]);
    });
    function roofTile(x1, z1, x2, z2, offset = 0) {
      return [[x1, z1], [x2, z1], [x2, z2], [x1, z2]].map(([x, z]) => [x, roof(z) + offset, z]);
    }
    face(roofTile(-halfX - 0.15, -halfZ - 0.16, halfX + 0.15, halfZ + 0.16), daylight ? '#354952' : '#253348');
    for (const item of faces.sort((a, b) => a.depth - b.depth)) path(item.points, item.color, item.border);

    for (let i = 0; i < config.panelCount; i++) {
      const x = (i % columns - columns / 2) * 0.88 + 0.05;
      const z = -rows * 1.34 / 2 + Math.floor(i / columns) * 1.34 + 0.06;
      const tile = roofTile(x, z, x + 0.78, z + 1.22, 0.025);
      path(tile.map(point => project(point)), daylight ? '#163c60' : '#152c50', daylight ? '#aacbd5' : '#6585a0');
      for (let cell = 1; cell < 4; cell++) {
        const lineZ = z + cell * 1.22 / 4;
        path([[x, roof(lineZ) + 0.026, lineZ], [x + 0.78, roof(lineZ) + 0.026, lineZ]].map(point => project(point)), null, '#97bfd251');
      }
    }

    if (facing.cos * camera.cos + facing.sin * camera.sin > 0) {
      const z = halfZ + 0.02;
      path([[-0.32, 0.05, z], [0.32, 0.05, z], [0.32, 1.20, z], [-0.32, 1.20, z]].map(point => project(point)), '#263b4a', '#aec5c896');
      path([[0.58, 0.65, z], [1.36, 0.65, z], [1.36, 1.19, z], [0.58, 1.19, z]].map(point => project(point)), daylight ? '#55808e' : '#e6ab58', '#aec5c896');
    }

    if (config.weather === 'rain') {
      for (let i = 0; i < 45; i++) {
        const x = (i * 67 % 461) / 461 * width, y = (i * 41 % 191) / 191 * height;
        path([{ x, y }, { x: x - 4, y: y + 11 }], null, '#d2e9f353');
      }
    }

    const north = project([0, 0, ground * 0.9], false);
    const south = project([0, 0, ground * 0.58], false);
    path([south, north], null, '#dfece8');
    ctx.fillStyle = '#f5f7f2';
    ctx.font = '700 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Bắc', north.x, north.y - 7);
  }

  window.SolarScene = { draw };
})();
