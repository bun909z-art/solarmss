(function () {
  'use strict';

  const radians = degrees => degrees * Math.PI / 180;
  const rgb = (base, light) => 'rgb(' + base.map(channel => Math.min(255, Math.round(channel * light))).join(',') + ')';

  function mix(from, to, amount) {
    if (amount <= 0) return from;
    if (amount >= 1) return to;
    let color = '#';
    for (let i = 1; i <= 7; i += 2) {
      const a = i < from.length ? parseInt(from.slice(i, i + 2), 16) : 255;
      const b = i < to.length ? parseInt(to.slice(i, i + 2), 16) : 255;
      color += Math.round(a + (b - a) * amount).toString(16).padStart(2, '0');
    }
    return color;
  }

  function smooth(lower, upper, value) {
    const t = Math.min(1, Math.max(0, (value - lower) / (upper - lower)));
    return t * t * (3 - 2 * t);
  }

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

  function drawSky(ctx, width, height, sun, camera, light, { clouds, time }) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    const twilight = smooth(-0.18, 0.02, sun.up) * (1 - smooth(0.05, 0.34, sun.up));
    const night = ['#071121', '#172b42', '#0d1929'];
    const clear = ['#13374d', '#627e87', '#233e49'];
    const cloudy = ['#233047', '#63727b', '#283a47'];
    const dusk = ['#233758', '#a57569', '#273b4e'];
    for (let i = 0; i < night.length; i++) {
      const dayColor = mix(clear[i], cloudy[i], clouds);
      const ambient = mix(night[i], dayColor, light);
      sky.addColorStop([0, 0.57, 1][i], mix(ambient, dusk[i], twilight * (1 - clouds * 0.65)));
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const lightX = width * (0.5 + 0.40 * (sun.east * camera.cos - sun.north * camera.sin));
    const lightY = height * (0.31 - sun.up * 0.20);
    const sunOpacity = smooth(-0.055, 0.08, sun.up) * (1 - smooth(0.32, 0.91, clouds));
    if (sunOpacity > 0) {
      ctx.globalAlpha = sunOpacity;
      const halo = ctx.createRadialGradient(lightX, lightY, 1, lightX, lightY, height * 0.34);
      halo.addColorStop(0, mix('#fff0c599', '#ffc283bc', twilight));
      halo.addColorStop(0.2, mix('#ffd7974a', '#fba37854', twilight));
      halo.addColorStop(1, '#ffd79700');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = mix('#fff3ce', '#ffdcaa', twilight);
      ctx.beginPath();
      ctx.arc(lightX, lightY, Math.max(4, height * 0.016), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const stars = (1 - light) * (1 - clouds);
    if (stars > 0.01) {
      ctx.globalAlpha = stars;
      for (let i = 0; i < 48; i++) {
        ctx.fillStyle = i % 7 === 0 ? '#d3e5ffbd' : '#bad6f060';
        const size = i % 7 === 0 ? 1.6 : 0.8;
        ctx.fillRect((i * 113 % 353) / 353 * width, (i * 37 % 97) / 97 * height * 0.64, size, size);
      }
      ctx.globalAlpha = 1;
    }
    if (clouds > 0) {
      const count = 8;
      ctx.globalAlpha = clouds;
      for (let i = 0; i < count; i++) {
        const speed = i % 2 ? 0.034 : 0.019;
        const x = width * ((0.27 + i * 0.188 + time * speed) % 1.5 - 0.25);
        const y = height * (0.08 + ((i * 7) % 5) * 0.049 + 0.016 * Math.sin(time * 0.35 + i));
        const radius = width * (i % 2 ? 0.17 : 0.22);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, i % 2 ? 0.28 : 0.20);
        const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        cloud.addColorStop(0, mix('#9bafd146', '#d6e2e7a0', light));
        cloud.addColorStop(0.45, mix('#9bafd134', '#d6e2e75c', light));
        cloud.addColorStop(1, '#98adbf00');
        ctx.fillStyle = cloud;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    const vignette = ctx.createRadialGradient(width / 2, height * 0.48, Math.min(width, height) * 0.25, width / 2, height * 0.48, Math.hypot(width, height) * 0.56);
    vignette.addColorStop(0, '#07142200');
    vignette.addColorStop(1, '#05111f89');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  function draw(canvas, config, sun, angle, elevation, effects) {
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
    const daylight = smooth(-0.19, 0.23, sun.up);
    const tint = (night, day) => mix(night, day, daylight);
    const direct = 1 - effects.clouds * 0.76;
    drawSky(ctx, width, height, sun, camera, daylight, effects);

    const geometry = config.roof;
    const halfX = geometry.width / 2, halfZ = geometry.depth / 2;
    const gable = geometry.type === 'gable';
    const roof = z => 2.45 + SolarRoof.elevation(geometry, z);
    const peak = roof(gable ? 0 : -halfZ);
    const footprint = Math.hypot(halfX + 0.72, halfZ + 0.95);
    const scale = Math.min(width * 0.44 / footprint, height * 0.89 / (footprint * pitch.sin * 2 + peak * pitch.cos));
    const anchorY = height * 0.58 + scale * peak * pitch.cos * 0.27;

    const cameraX = camera.sin * facing.cos - camera.cos * facing.sin;
    const cameraZ = camera.sin * facing.sin + camera.cos * facing.cos;
    const sunX = sun.east * facing.cos - sun.north * facing.sin;
    const sunZ = sun.east * facing.sin + sun.north * facing.cos;
    const wallLight = (x, z) => 0.32 + 0.12 * Math.max(0, cameraX * x + cameraZ * z) +
      daylight * (0.44 + 0.24 * direct * Math.max(0, sunX * x + sunZ * z));

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
    shape(slab, tint('#354651', mix('#88938b', '#6d8181', effects.rain)), '#becace70');
    shape(groundRect(-slabX + 0.18, -slabZ + 0.18, slabX - 0.18, slabZ - 0.18, 0.005),
      tint('#26383b', '#666f61'), tint('#81918a65', '#bac4af9a'));

    const shadowOpacity = smooth(0, 0.30, sun.up) * (0.12 + direct * 0.20);
    if (shadowOpacity > 0) {
      // Keep low-angle shadows on the scale model's plinth.
      ctx.save();
      shape(slab, null, null);
      ctx.closePath();
      ctx.clip();
      const shadow = groundRect(-halfX, -halfZ, halfX, halfZ, 0).map(([x, y, z]) => {
        const length = roof(z) / Math.max(sun.up, 0.25);
        return [x - sunX * length, y, z - sunZ * length];
      });
      shape(shadow, 'rgba(11,25,29,' + shadowOpacity + ')');
      ctx.restore();
    }

    const deckZ = halfZ + 0.72;
    shape(groundRect(-halfX, halfZ, halfX, deckZ, 0.025), tint('#57554e', '#a59b85'), '#e3d9bc55');
    for (let i = 0; i < 5; i++) {
      const z = halfZ + i * 0.144;
      shape([[-halfX, 0.028, z], [halfX, 0.028, z]], null, '#211e1947');
    }
    for (const x of [-halfX + 0.35, halfX - 0.35]) {
      shape(groundRect(x - 0.29, halfZ + 0.28, x + 0.29, halfZ + 0.64, 0.041),
        tint('#23382f', '#3e4e3f'), '#b5bc9b70');
      for (let i = -2; i <= 2; i++) {
        const from = project([x + i * 0.095, 0.04, halfZ + 0.48]);
        const tip = project([x + i * 0.12, 0.16 + (2 - Math.abs(i)) * 0.06, halfZ + 0.44]);
        ctx.lineWidth = Math.max(1, scale * 0.043);
        polygon(ctx, [from, tip], null, tint('#5d8269', '#94a673'));
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
      const wallTop = [wallPoint(1, roof(z2))];
      if (gable && z !== z2) wallTop.push(wallPoint(0.5, roof(0)));
      wallTop.push(wallPoint(0, roof(z)));
      const plaster = ctx.createLinearGradient(0, Math.min(...wallTop.map(point => project(point).y)), 0,
        Math.max(project(corners[i]).y, project(corners[(i + 1) % 4]).y));
      plaster.addColorStop(0, rgb([239, 231, 213], light));
      plaster.addColorStop(1, rgb([176, 180, 164], light));
      shape([wallPoint(0, 0.04), wallPoint(1, 0.04), ...wallTop], plaster, '#17232a90');
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
        glass.addColorStop(0, tint('#f9ca87', '#83a4ac'));
        glass.addColorStop(0.55, tint('#ce975b', '#456977'));
        glass.addColorStop(1, tint('#735b52', '#263e4d'));
        wallRect(a, b, bottom, top, glass, tint('#f0c17f91', '#c0d4d55c'));
        const middle = (a + b) * 0.5;
        shape([wallPoint(middle, bottom, 0.019), wallPoint(middle, top, 0.019)], null, '#26323c');
        shape([wallPoint(a, top - 0.08, 0.019), wallPoint(b, bottom + 0.23, 0.019)], null, tint('#fff3d920', '#d3e7ec39'));
      });
    });

    function roofTile(x1, z1, x2, z2, offset = 0) {
      return groundRect(x1, z1, x2, z2, 0).map(([x, , z]) => [x, roof(z) + offset, z]);
    }
    const edgeX = halfX + 0.18, edgeZ = halfZ + 0.19;
    const roofFaces = gable ? [[-edgeZ, 0], [0, edgeZ]] : [[-edgeZ, edgeZ]];
    const seams = Math.ceil(geometry.width * 1.9);
    for (const [from, to] of roofFaces) {
      const roofTop = roofTile(-edgeX, from, edgeX, to, 0.08);
      const roofBottom = roofTile(-edgeX, from, edgeX, to, -0.12);
      normals.forEach(([x, z], i) => {
        if (cameraX * x + cameraZ * z <= 0 || (gable && ((i === 0 && from === 0) || (i === 2 && to === 0)))) return;
        const j = (i + 1) % 4;
        shape([roofBottom[i], roofBottom[j], roofTop[j], roofTop[i]], tint('#202d3a', '#36434b'), '#b5bbc450');
      });
      const roofTone = ctx.createLinearGradient(0, project(roofTop[0]).y, 0, project(roofTop[2]).y + 1);
      roofTone.addColorStop(0, tint('#2d3c4d', '#677579'));
      roofTone.addColorStop(1, tint('#253040', '#465055'));
      shape(roofTop, roofTone, tint('#718297', '#adb8b7'));
      for (let seam = 1; seam < seams; seam++) {
        const x = -edgeX + seam * 2 * edgeX / seams;
        shape([[x, roof(from) + 0.082, from], [x, roof(to) + 0.082, to]], null, '#0d1b2770');
      }
    }
    if (gable) shape([[-edgeX, peak + 0.106, 0], [edgeX, peak + 0.106, 0]], null, '#c3c6b4');

    const tilt = radians(geometry.tilt);
    const glassStarts = [-1, 1].map(direction => {
      const sunOnPlane = sun.up * Math.cos(tilt) + direction * sunZ * Math.sin(tilt);
      const reflection = smooth(0.10, 0.55, sunOnPlane) * (1 - effects.clouds);
      return tint('#293b60', mix('#2d5068', '#417087', reflection));
    });
    const glassCenter = tint('#152741', '#163249');
    const frameColor = tint('#596e8d', '#b4cbd1');
    for (const panel of config.panels) {
      const x = panel.x - halfX, z = panel.z - halfZ;
      const { width: w, depth: h } = SolarRoof.dimensions(panel, config.panelSize, geometry);
      shape(roofTile(x - 0.014, z + 0.035, x + w + 0.036, z + h + 0.055, 0.091), '#081321b3');
      const tile = roofTile(x, z, x + w, z + h, 0.135);
      const highlight = project(tile[0]), dark = project(tile[2]);
      const glass = ctx.createLinearGradient(highlight.x, highlight.y, dark.x, dark.y);
      glass.addColorStop(0, glassStarts[gable && z < 0 ? 0 : 1]);
      glass.addColorStop(0.48, glassCenter);
      glass.addColorStop(1, '#0e1d32');
      shape(tile, glass, frameColor);
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

    if (effects.rain > 0) {
      ctx.globalAlpha = effects.rain;
      for (let layer = 0; layer < 2; layer++) {
        ctx.beginPath();
        const speed = layer ? 0.91 : 0.57;
        const length = (layer ? 0.062 : 0.045) * height;
        for (let i = 0; i < 40; i++) {
          const seed = i + layer * 40;
          const x = width * (1.10 - ((seed * 67 % 461) / 461 + effects.time * speed * 0.13) % 1.2);
          const y = height * (((seed * 41 % 191) / 191 + effects.time * speed) % 1.2 - 0.10);
          ctx.moveTo(x, y);
          ctx.lineTo(x - length * 0.30, y + length);
        }
        ctx.strokeStyle = layer ? '#e3eff66b' : '#b1cce346';
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
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
