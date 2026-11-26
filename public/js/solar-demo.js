(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const form = $('demoConfig');
  const canvas = $('demoCanvas');
  const hourInput = $('demoHour');
  const playButton = $('demoPlay');
  const format = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  const whole = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  const number = id => $(id).valueAsNumber;
  const enabled = () => !document.body.classList.contains('solar-demo-off');
  const clock = hour => String(hour).padStart(2, '0') + ':00';
  const energy = value => format.format(value) + ' kWh';
  const percent = value => whole.format(value) + '%';
  const defaults = {
    panel: [{ id: 'demo-panel-550', name: 'Tấm pin mẫu', wattWp: 550 }, { id: 'demo-panel-610', name: 'Tấm pin mẫu', wattWp: 610 }],
    inverter: [{ id: 'demo-inverter-5', name: 'Biến tần hybrid mẫu', powerKw: 5 }, { id: 'demo-inverter-8', name: 'Biến tần hybrid mẫu', powerKw: 8 }],
    battery: [{ id: 'demo-battery-5', name: 'Pin LFP mẫu', capacityKwh: 5.12 }, { id: 'demo-battery-10', name: 'Pin LFP mẫu', capacityKwh: 10.24 }]
  };

  let equipment = {};
  let usingSamples = true;
  let settings = null;
  let model = null;
  let angle = 3.85, elevation = 0.90;
  let drag = null;
  let timer = null;

  for (let month = 1; month <= 12; month++) $('demoMonth').add(new Option('Tháng ' + month, month));
  $('demoMonth').value = '3';
  $('demoSettings').open = !matchMedia('(max-width: 820px)').matches;

  function populateSelect(id, items, field, unit, allowNone, firstLoad) {
    const select = $(id), previous = select.value;
    const options = allowNone ? [new Option('Không dùng pin', '')] : [];
    for (const item of items) options.push(new Option(item.name + ' · ' + format.format(item[field]) + ' ' + unit, item.id));
    select.replaceChildren(...options);
    if ((!firstLoad || !allowNone) && options.some(option => option.value === previous)) select.value = previous;
    else if (!allowNone || firstLoad) select.value = items[0].id;
  }

  function setEquipment(products, firstLoad = false) {
    const active = products.filter(item => item.active !== false);
    const group = (category, key) => active.filter(item =>
      item.category === category && Number.isFinite(Number(item[key])) && Number(item[key]) > 0);
    const panels = group('panel', 'wattWp');
    const inverters = group('inverter', 'powerKw');
    const batteries = group('battery', 'capacityKwh');
    usingSamples = !panels.length || !inverters.length || !batteries.length;
    equipment = {
      panel: panels.length ? panels : defaults.panel,
      inverter: inverters.length ? inverters : defaults.inverter,
      battery: batteries.length ? batteries : defaults.battery
    };
    populateSelect('demoPanel', equipment.panel, 'wattWp', 'Wp', false, firstLoad);
    populateSelect('demoInverter', equipment.inverter, 'powerKw', 'kW', false, firstLoad);
    populateSelect('demoBattery', equipment.battery, 'capacityKwh', 'kWh', true, firstLoad);
  }

  function readSettings() {
    const batteryOn = Boolean($('demoBattery').value);
    $('demoBatteryFields').hidden = !batteryOn;
    $('demoBatteryCount').disabled = !batteryOn;
    $('demoInitialSoc').disabled = !batteryOn;
    if (!form.checkValidity()) return null;
    const rating = (category, id, key) => Number(equipment[category].find(item => item.id === $(id).value)?.[key]) || 0;
    return {
      panelWp: rating('panel', 'demoPanel', 'wattWp'), panelCount: number('demoPanelCount'),
      inverterKw: rating('inverter', 'demoInverter', 'powerKw'),
      batteryKwh: rating('battery', 'demoBattery', 'capacityKwh'),
      batteryCount: batteryOn ? number('demoBatteryCount') : 0,
      initialSoc: batteryOn ? number('demoInitialSoc') : 0,
      azimuth: Number($('demoAzimuth').value), tilt: number('demoTilt'), latitude: Number($('demoLatitude').value),
      month: Number($('demoMonth').value), weather: $('demoWeather').value, dailyLoad: number('demoLoad')
    };
  }

  function definitionList(values) {
    return values.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('');
  }

  function drawScene() {
    if (model && enabled()) SolarScene.draw(canvas, settings, model.results[Number(hourInput.value)].sun, angle, elevation);
  }

  function renderHour() {
    if (!model || !enabled()) return;
    const hour = Number(hourInput.value);
    const row = model.results[hour];
    $('demoHourLabel').value = clock(hour) + (row.sun.up > 0 ? ' · Ban ngày' : ' · Ban đêm');
    $('demoHourStats').innerHTML = definitionList([
      ['PV trong giờ', energy(row.pv)], ['Tải trong giờ', energy(row.load)],
      ['Điện từ lưới', energy(row.grid)], ['Mức pin cuối giờ', model.capacity ? percent(row.soc) : '—']
    ]);
    const chart = $('demoChart');
    chart.querySelector('.current')?.classList.remove('current');
    chart.children[hour]?.classList.add('current');
    drawScene();
  }

  function renderReport() {
    const { results, totals, dcKw, capacity } = model;
    const autonomy = totals.load > 0 ? (1 - totals.grid / totals.load) * 100 : null;
    $('demoTotals').innerHTML = definitionList([
      ['Sản lượng PV', energy(totals.pv)], ['Tải tiêu thụ', energy(totals.load)],
      ['Điện từ lưới', energy(totals.grid)], ['Tự đáp ứng tải', autonomy === null ? '—' : percent(autonomy)]
    ]);
    $('demoBalance').textContent = 'Dùng trực tiếp ' + energy(totals.direct) + ' · Sạc ' + energy(totals.charge) +
      ' · Xả ' + energy(totals.discharge) + ' · Điện dư ' + energy(totals.surplus) + ' · Cắt đỉnh ' + energy(totals.clipping);
    const scale = Math.max(1, Math.ceil(Math.max(...results.flatMap(row => [row.pv, row.load, row.grid]))));
    $('demoChartAxis').textContent = 'Thang đo 0–' + format.format(scale) + ' kWh mỗi giờ';
    $('demoChart').innerHTML = results.map(row => {
      const bar = (key, value) => '<span class="demo-' + key + '-key" style="height:' + (value / scale * 100) + '%"></span>';
      return '<figure class="demo-bin"><div class="demo-bars">' + bar('pv', row.pv) + bar('load', row.load) + bar('grid', row.grid) +
        '</div><figcaption>' + (row.hour % 6 === 0 ? clock(row.hour).slice(0, 2) + 'h' : '') + '</figcaption></figure>';
    }).join('');
    $('demoRows').innerHTML = results.map(row => {
      const cells = [row.pv, row.load, row.charge, row.discharge, row.grid, row.surplus].map(format.format);
      cells.push(capacity ? percent(row.soc) : '—');
      return '<tr><th scope="row">' + clock(row.hour) + '</th>' + cells.map(cell => '<td>' + cell + '</td>').join('') + '</tr>';
    }).join('');
    $('demoSceneMeta').textContent = format.format(dcKw) + ' kWp · ' + settings.panelCount + ' tấm · ' +
      format.format(capacity) + ' kWh lưu trữ';
  }

  function simulate() {
    if (!enabled()) return;
    const next = readSettings();
    if (!next) {
      $('demoEquipmentNote').textContent = 'Kiểm tra các ô số. Kết quả đang hiển thị theo cấu hình hợp lệ gần nhất.';
      return;
    }
    settings = next;
    $('demoEquipmentNote').textContent = usingSamples ? 'Dùng cấu hình mẫu cho nhóm thiết bị chưa có dữ liệu trong danh mục.' : '';
    model = SolarModel.simulate(settings);
    renderReport();
    renderHour();
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    playButton.textContent = 'Chạy 24 giờ';
    playButton.setAttribute('aria-pressed', 'false');
  }

  playButton.addEventListener('click', () => {
    if (timer) return stop();
    if (!model || !enabled()) return;
    hourInput.value = '0';
    renderHour();
    playButton.textContent = 'Tạm dừng';
    playButton.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => {
      hourInput.stepUp();
      renderHour();
      if (Number(hourInput.value) === 23) stop();
    }, 520);
  });
  hourInput.addEventListener('input', () => { stop(); renderHour(); });
  form.addEventListener('submit', event => { event.preventDefault(); simulate(); });
  form.addEventListener('input', simulate);
  document.querySelectorAll('[data-rotate]').forEach(button => {
    button.addEventListener('click', () => { angle += Number(button.dataset.rotate) * 0.34; drawScene(); });
  });
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    angle += (event.clientX - drag.x) * 0.015;
    elevation = Math.max(0.80, Math.min(1.32, elevation + (event.clientY - drag.y) * 0.008));
    drag.x = event.clientX;
    drag.y = event.clientY;
    drawScene();
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  new ResizeObserver(drawScene).observe(canvas);

  function applyBranding(config) {
    SiteTheme.apply(config);
    const brand = config.branding || {};
    const company = brand.companyName || 'Công Ty TNHH Mai Sơn Solar';
    document.title = 'Demo mô phỏng điện mặt trời 3D – ' + company;
    $('demoCompany').textContent = company;
    $('brandLogo').alt = company;
    $('brandLogo').src = brand.logoUrl || '/assets/logo-default.jpg?v=mss';
    $('docFavicon').href = brand.faviconUrl || '/assets/favicon.png?v=mss';
    $('hotlineWrap').hidden = brand.showHotline === false;
    $('hotlineLabel').textContent = brand.hotlineLabel || 'Hotline tư vấn kỹ thuật';
    const links = (brand.hotlines || []).map(hotline => {
      const link = document.createElement('a');
      link.href = 'tel:' + String(hotline.tel || hotline.number).replace(/[^\d+]/g, '');
      link.textContent = hotline.number;
      return link;
    });
    $('hotlineList').replaceChildren(...links);
  }

  let hasCatalog = false;
  setEquipment([], true);
  simulate();
  HQLive.watch(['config', 'products'], ({ config, products }, changed) => {
    if (changed.has('config')) {
      const wasEnabled = enabled();
      const moveFocus = wasEnabled && $('solarDemo').contains(document.activeElement);
      applyBranding(config);
      if (!enabled()) {
        stop();
        if (moveFocus) $('demoOffTitle').focus();
      }
    }
    if (changed.has('products')) {
      setEquipment(products, !hasCatalog && !form.matches(':focus-within'));
      hasCatalog = true;
    }
    simulate();
  });
})();
