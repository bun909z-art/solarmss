(function () {
  'use strict';

  const radians = degrees => degrees * Math.PI / 180;
  const rgb = (base, light) => 'rgb(' + base.map(channel => Math.min(255, Math.round(channel * light))).join(',') + ')';

  function polygon(ctx, points, fill, stroke) {
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

  function drawSky(ctx, width, height, sun, camera, weather) {
    const day = sun.up > 0;
    const clear = weather === 'sunny';
    const low = day && sun.up < 0.30;
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    const colors = !day ? ['#071121', '#172b42', '#0d1929'] :
      low ? ['#233758', '#7e6b70', '#273b4e'] :
      clear ? ['#13374d', '#627e87', '#233e49'] : ['#233047', '#63727b', '#283a47'];
    colors.forEach((color, i) => sky.addColorStop([0, 0.57, 1][i], color));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const lightX = width * (0.5 + 0.40 * (sun.east * camera.cos - sun.north * camera.sin));
    const lightY = height * (0.31 - Math.max(0, sun.up) * 0.20);
    if (day && (clear || weather === 'variable')) {
      const halo = ctx.createRadialGradient(lightX, lightY, 1, lightX, lightY, height * 0.34);
      halo.addColorStop(0, low ? '#ffc283bc' : '#fff0c599');
      halo.addColorStop(0.2, low ? '#fba37854' : '#ffd7974a');
      halo.addColorStop(1, '#ffd79700');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = low ? '#ffdcaa' : '#fff3ce';
      ctx.beginPath();
      ctx.arc(lightX, lightY, Math.max(4, height * 0.016), 0, Math.PI * 2);
      ctx.fill();
    }
    if (weather === 'sunny' && !day) {
      for (let i = 0; i < 48; i++) {
        ctx.fillStyle = i % 7 === 0 ? '#d3e5ffbd' : '#bad6f060';
        const size = i % 7 === 0 ? 1.6 : 0.8;
        ctx.fillRect((i * 113 % 353) / 353 * width, (i * 37 % 97) / 97 * height * 0.64, size, size);
      }
    } else if (!clear) {
      const count = weather === 'variable' ? 4 : 8;
      for (let i = 0; i < count; i++) {
        const x = width * (0.08 + i * 0.84 / (count - 1));
        const y = height * (0.08 + ((i * 7) % 5) * 0.049);
        const cloud = ctx.createRadialGradient(x, y, 1, x, y, 1.5 * width / count);
        cloud.addColorStop(0, day ? '#d6e2e74a' : '#9bafd12e');
        cloud.addColorStop(1, '#98adbf00');
        ctx.save();
        ctx.translate(0, y * 0.75);
        ctx.scale(1, 0.25);
        ctx.fillStyle = cloud;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 * width / count, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const vignette = ctx.createRadialGradient(width / 2, height * 0.48, Math.min(width, height) * 0.25, width / 2, height * 0.48, Math.hypot(width, height) * 0.56);
    vignette.addColorStop(0, '#07142200');
    vignette.addColorStop(1, '#05111f89');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

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

    const camera = { cos: Math.cos(angle), sin: Math.sin(angle) };
    const pitch = { cos: Math.cos(elevation), sin: Math.sin(elevation) };
    const heading = radians(config.azimuth);
    const facing = { cos: Math.cos(heading), sin: Math.sin(heading) };
    const day = sun.up > 0;
    const clear = config.weather === 'sunny';
    const direct = clear ? 1 : config.weather === 'variable' ? 0.58 : 0.24;
    drawSky(ctx, width, height, sun, camera, config.weather);

    const columns = Math.min(7, Math.max(2, Math.ceil(Math.sqrt(config.panelCount * 1.6))));
    const rows = Math.ceil(config.panelCount / columns);
    const halfX = (columns * 0.88 + 1.0) / 2;
    const halfZ = Math.max(3.5, rows * 1.34 + 1.05) / 2;
    const tilt = radians(config.tilt);
    const roof = z => 1.75 + (halfZ - z) * Math.tan(tilt);
    const footprint = Math.hypot(halfX + 0.72, halfZ + 0.95);
    const scale = Math.min(width * 0.44 / footprint, height * 0.89 / (footprint * pitch.sin * 2 + roof(-halfZ) * pitch.cos));
    const anchorY = height * 0.58 + scale * roof(-halfZ) * pitch.cos * 0.27;

    const cameraX = camera.sin * facing.cos - camera.cos * facing.sin;
    const cameraZ = camera.sin * facing.sin + camera.cos * facing.cos;
    const sunX = sun.east * facing.cos - sun.north * facing.sin;
    const sunZ = sun.east * facing.sin + sun.north * facing.cos;
    const wallLight = (x, z) => day ? 0.76 + 0.24 * direct * Math.max(0, sunX * x + sunZ * z) +
      0.10 * Math.max(0, cameraX * x + cameraZ * z) : 0.32 + 0.12 * Math.max(0, cameraX * x + cameraZ * z);

    function project([x, y, z]) {
      return {
        x: width / 2 + (x * cameraZ - z * cameraX) * scale,
        y: anchorY + ((x * cameraX + z * cameraZ) * pitch.sin - y * pitch.cos) * scale
      };
    }

    function shape(points, fill, stroke) {
      polygon(ctx, points.map(project), fill, stroke);
    }

    function groundRect(x1, z1, x2, z2, y) {
      return [[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]];
    }

    const slabX = halfX + 0.72, slabZ = halfZ + 0.95;
    const slab = groundRect(-slabX, -slabZ, slabX, slabZ, 0);
    const lower = groundRect(-slabX, -slabZ, slabX, slabZ, -0.24);
    const normals = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const shade = ctx.createRadialGradient(width / 2, anchorY, scale * 0.5, width / 2, anchorY, footprint * scale * 1.17);
    shade.addColorStop(0, '#030a14cc');
    shade.addColorStop(1, '#030a1400');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    normals.forEach(([x, z], i) => {
      if (cameraX * x + cameraZ * z <= 0) return;
      const next = (i + 1) % 4;
      shape([lower[i], lower[next], slab[next], slab[i]], rgb([98, 114, 114], wallLight(x, z)), '#0a1724b0');
    });
    shape(slab, day ? (config.weather === 'rain' ? '#6d8181' : '#88938b') : '#354651', '#becace70');
    shape(groundRect(-slabX + 0.18, -slabZ + 0.18, slabX - 0.18, slabZ - 0.18, 0.005),
      day ? '#666f61' : '#26383b', day ? '#bac4af9a' : '#81918a65');

    if (day) {
      // Keep low-angle shadows on the scale model's plinth.
      ctx.save();
      shape(slab, null, null);
      ctx.closePath();
      ctx.clip();
      const shadow = groundRect(-halfX, -halfZ, halfX, halfZ, 0).map(([x, y, z]) => {
        const length = roof(z) / Math.max(sun.up, 0.25);
        return [x - sunX * length, y, z - sunZ * length];
      });
      shape(shadow, 'rgba(11,25,29,' + (0.16 + direct * 0.16) + ')');
      ctx.restore();
    }

    const deckZ = halfZ + 0.72;
    shape(groundRect(-halfX, halfZ, halfX, deckZ, 0.025), day ? '#a59b85' : '#57554e', '#e3d9bc55');
    for (let i = 0; i < 5; i++) {
      const z = halfZ + i * 0.144;
      shape([[-halfX, 0.028, z], [halfX, 0.028, z]], null, '#211e1947');
    }
    for (const x of [-halfX + 0.35, halfX - 0.35]) {
      shape(groundRect(x - 0.29, halfZ + 0.28, x + 0.29, halfZ + 0.64, 0.041),
        day ? '#3e4e3f' : '#23382f', '#b5bc9b70');
      for (let i = -2; i <= 2; i++) {
        const from = project([x + i * 0.095, 0.04, halfZ + 0.48]);
        const tip = project([x + i * 0.12, 0.16 + (2 - Math.abs(i)) * 0.06, halfZ + 0.44]);
        ctx.lineWidth = Math.max(1, scale * 0.043);
        polygon(ctx, [from, tip], null, day ? '#94a673' : '#5d8269');
      }
    }
    ctx.lineWidth = 1;

    const corners = groundRect(-halfX, -halfZ, halfX, halfZ, 0.04);
    normals.forEach(([nx, nz], i) => {
      if (cameraX * nx + cameraZ * nz <= 0) return;
      const [x, , z] = corners[i];
      const [x2, , z2] = corners[(i + 1) % 4];
      const light = wallLight(nx, nz);
      function wallPoint(u, y, offset = 0) {
        return [x + (x2 - x) * u + nx * offset, y, z + (z2 - z) * u + nz * offset];
      }
      function wallRect(a, b, low, high, fill, stroke) {
        shape([wallPoint(a, low, 0.012), wallPoint(b, low, 0.012), wallPoint(b, high, 0.012), wallPoint(a, high, 0.012)], fill, stroke);
      }
      const top1 = wallPoint(0, roof(z)), top2 = wallPoint(1, roof(z2));
      const plaster = ctx.createLinearGradient(0, Math.min(project(top1).y, project(top2).y), 0, Math.max(project(corners[i]).y, project(corners[(i + 1) % 4]).y));
      plaster.addColorStop(0, rgb([239, 231, 213], light));
      plaster.addColorStop(1, rgb([176, 180, 164], light));
      shape([wallPoint(0, 0.04), wallPoint(1, 0.04), top2, top1], plaster, '#17232a90');
      wallRect(0, 1, 0.045, 0.16, rgb([76, 88, 90], light));
      if (nz === 1) {
        wallRect(0.04, 0.34, 0.16, 1.60, rgb([153, 115, 77], light));
        for (let slat = 1; slat < 13; slat++) {
          const u = 0.04 + slat * 0.30 / 13;
          shape([wallPoint(u, 0.16, 0.016), wallPoint(u, 1.60, 0.016)], null, '#392a235c');
        }
      }
      const windows = nz === 1 ? [[0.14, 0.28, 0.16, 1.40], [0.39, 0.91, 0.24, 1.47]] :
        nz === -1 ? [[0.21, 0.76, 0.7, 1.43]] : [[0.20, 0.81, 0.57, 1.47]];
      windows.forEach(([a, b, bottom, top]) => {
        const margin = 0.015;
        wallRect(a - margin, b + margin, bottom - 0.04, top + 0.045, '#23303a');
        const glassTop = project(wallPoint(a, top)).y, glassBottom = project(wallPoint(b, bottom)).y;
        const glass = ctx.createLinearGradient(0, glassTop, 0, glassBottom + 1);
        glass.addColorStop(0, day ? '#83a4ac' : '#f9ca87');
        glass.addColorStop(0.55, day ? '#456977' : '#ce975b');
        glass.addColorStop(1, day ? '#263e4d' : '#735b52');
        wallRect(a, b, bottom, top, glass, day ? '#c0d4d55c' : '#f0c17f91');
        const middle = (a + b) * 0.5;
        shape([wallPoint(middle, bottom, 0.019), wallPoint(middle, top, 0.019)], null, '#26323c');
        shape([wallPoint(a, top - 0.08, 0.019), wallPoint(b, bottom + 0.23, 0.019)], null, day ? '#d3e7ec39' : '#fff3d920');
      });
    });

    function roofTile(x1, z1, x2, z2, offset = 0) {
      return groundRect(x1, z1, x2, z2, 0).map(([x, , z]) => [x, roof(z) + offset, z]);
    }
    const edgeX = halfX + 0.18, edgeZ = halfZ + 0.19;
    const roofTop = roofTile(-edgeX, -edgeZ, edgeX, edgeZ, 0.08);
    const roofBottom = roofTile(-edgeX, -edgeZ, edgeX, edgeZ, -0.12);
    normals.forEach(([x, z], i) => {
      if (cameraX * x + cameraZ * z <= 0) return;
      const j = (i + 1) % 4;
      shape([roofBottom[i], roofBottom[j], roofTop[j], roofTop[i]], day ? '#36434b' : '#202d3a', '#b5bbc450');
    });
    const roofTone = ctx.createLinearGradient(0, project(roofTop[0]).y, 0, project(roofTop[2]).y + 1);
    roofTone.addColorStop(0, day ? '#677579' : '#2d3c4d');
    roofTone.addColorStop(1, day ? '#465055' : '#253040');
    shape(roofTop, roofTone, day ? '#adb8b7' : '#718297');
    for (let seam = 1; seam < columns * 3; seam++) {
      const x = -edgeX + seam * 2 * edgeX / (columns * 3);
      shape([[x, roof(-edgeZ) + 0.082, -edgeZ], [x, roof(edgeZ) + 0.082, edgeZ]], null, '#0d1b2770');
    }

    const sunOnPlane = sun.up * Math.cos(tilt) + sunZ * Math.sin(tilt);
    const reflective = day && sunOnPlane > 0.25 && clear;
    for (let i = 0; i < config.panelCount; i++) {
      const column = i % columns;
      const row = Math.floor(i / columns);
      const rowCount = Math.min(columns, config.panelCount - row * columns);
      const x = (column - rowCount / 2) * 0.88 + 0.045;
      const z = -rows * 1.34 / 2 + row * 1.34 + 0.06;
      const w = 0.79, h = 1.22;
      shape(roofTile(x - 0.014, z + 0.035, x + w + 0.036, z + h + 0.055, 0.091), '#081321b3');
      const tile = roofTile(x, z, x + w, z + h, 0.135);
      const highlight = project(tile[0]), dark = project(tile[2]);
      const glass = ctx.createLinearGradient(highlight.x, highlight.y, dark.x, dark.y);
      glass.addColorStop(0, reflective ? '#417087' : day ? '#2d5068' : '#293b60');
      glass.addColorStop(0.48, day ? '#163249' : '#152741');
      glass.addColorStop(1, '#0e1d32');
      shape(tile, glass, day ? '#b4cbd1' : '#596e8d');
      const offset = 0.138;
      for (let cell = 1; cell < 6; cell++) {
        const lineZ = z + cell * h / 6;
        shape([[x, roof(lineZ) + offset, lineZ], [x + w, roof(lineZ) + offset, lineZ]], null, '#91bad255');
      }
      for (const share of [0.33, 0.66]) {
        const mid = x + w * share;
        shape([[mid, roof(z) + offset, z], [mid, roof(z + h) + offset, z + h]], null, '#91bad241');
      }
    }

    if (config.weather === 'rain') {
      for (let i = 0; i < 54; i++) {
        const x = (i * 67 % 461) / 461 * width, y = (i * 41 % 191) / 191 * height;
        polygon(ctx, [{ x, y }, { x: x - 4, y: y + 11 }], null, '#d2e9f340');
      }
    }

    const cx = width - 33, cy = height - 31;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, Math.PI * 2);
    ctx.fillStyle = '#102132df';
    ctx.fill();
    ctx.strokeStyle = '#a3bccc7a';
    ctx.stroke();
    const nx = -camera.sin, ny = camera.cos * pitch.sin;
    const tip = { x: cx + nx * 11, y: cy + ny * 11 };
    const tail = { x: cx - nx * 8, y: cy - ny * 8 };
    polygon(ctx, [tip, { x: tail.x - ny * 4, y: tail.y + nx * 4 },
      { x: tail.x + ny * 4, y: tail.y - nx * 4 }], '#e5ba6d');
    ctx.fillStyle = '#e5edf4';
    ctx.font = '600 11px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText('Bắc', cx - 26, cy + 4);
  }

  window.SolarScene = { draw };
})();
