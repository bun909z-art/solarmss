(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const form = $('demoConfig');
  const mainRoof = $('demoMainRoof');
  const annexRoof = mainRoof.cloneNode(true);
  annexRoof.id = 'demoAnnexRoof';
  annexRoof.hidden = true;
  annexRoof.querySelectorAll('[id]').forEach(element => { element.id += 'Aux'; });
  annexRoof.querySelector('[data-annex-position]').hidden = false;
  annexRoof.querySelector('[aria-describedby]').setAttribute('aria-describedby', 'demoRoofHintAux');
  mainRoof.after(annexRoof);
  const enableAnnex = $('demoEnableAnnex');
  const lastNumericValues = new WeakMap();
  const canvas = $('demoCanvas');
  const hourInput = $('demoHour');
  const playButton = $('demoPlay');
  const motionButton = $('demoWeatherMotion');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const weatherEffects = {
    sunny: [0, 0], variable: [0.48, 0], overcast: [0.88, 0], rain: [1, 1]
  };
  const format = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  const whole = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  const directions = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
  const flowLinks = Object.fromEntries([...document.querySelectorAll('[data-flow]')].map(link => [link.dataset.flow, link]));
  const number = id => $(id).valueAsNumber;
  const enabled = () => !document.body.classList.contains('solar-demo-off');
  const clock = hour => String(hour).padStart(2, '0') + ':00';
  const energy = value => format.format(value) + ' kWh';
  const power = value => format.format(value) + ' kW';
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
  let targetAngle = angle, targetElevation = elevation;
  let sceneHour = Number(hourInput.value), clouds = 0, rain = 0;
  let playing = false, animateWeather = !reducedMotion.matches;
  let frameId = 0, previousFrame = 0, lastDraw = 0, weatherTime = 0;
  let sceneVisible = true, dirty = true;
  let drag = null;
  const roofPlanner = SolarRoofPlanner.create(simulate);
  const annexPlanner = SolarRoofPlanner.create(simulate, 'Aux');

  for (const [name, link] of Object.entries(flowLinks)) {
    const vertical = name === 'ac' || name === 'load';
    link.dataset.axis = vertical ? 'vertical' : 'horizontal';
    link.setAttribute('aria-hidden', 'true');
    for (const direction of ['forward', 'reverse']) {
      const stream = document.createElement('span');
      stream.className = 'demo-flow-stream';
      stream.dataset.travel = direction;
      const arrow = document.createElement('span');
      arrow.className = 'demo-flow-arrow';
      arrow.dataset.travel = direction;
      arrow.textContent = direction === 'forward' ? (vertical ? '↓' : '→') : (vertical ? '↑' : '←');
      link.append(stream, arrow);
    }
  }
  new IntersectionObserver(([entry]) => {
    entry.target.toggleAttribute('data-visible', entry.isIntersecting);
  }).observe(document.querySelector('.demo-flow-diagram'));

  $('demoRoofWidthAux').defaultValue = '4,5';
  $('demoRoofDepthAux').defaultValue = '4';
  $('demoTiltAux').defaultValue = '12';
  $('demoPanelCountAux').defaultValue = '4';
  for (let month = 1; month <= 12; month++) $('demoMonth').add(new Option('Tháng ' + month, month));
  $('demoMonth').value = '3';
  $('demoSettings').open = !matchMedia('(max-width: 820px)').matches;
  $('demoRoofEditor').open = !matchMedia('(max-width: 700px)').matches;

  function populateSelect(id, items, field, unit, allowNone, firstLoad, emptyLabel = 'Không dùng pin') {
    const select = $(id), previous = select.value;
    const options = allowNone ? [new Option(emptyLabel, '')] : [];
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
    populateSelect('demoInverterAux', equipment.inverter, 'powerKw', 'kW', true, false, 'Không dùng nhóm 2');
    populateSelect('demoBattery', equipment.battery, 'capacityKwh', 'kWh', true, firstLoad);
    populateSelect('demoBatteryAux', equipment.battery, 'capacityKwh', 'kWh', true, false, 'Không dùng nhóm 2');
  }

  function readRoof(suffix = '') {
    const input = id => $(id + suffix);
    const type = input('demoRoofType').value;
    input('demoTilt').disabled = type === 'flat';
    const minimumSpan = suffix ? 2 : 3;
    const measurements = [
      { id: 'demoRoofWidth', key: 'width', label: 'Rộng mái', min: minimumSpan, max: 24, unit: 'm', example: '7,5' },
      { id: 'demoRoofDepth', key: 'depth', label: 'Chiều sâu mái', min: minimumSpan, max: 24, unit: 'm', example: '7,5' },
      { id: 'demoTilt', key: 'tilt', label: 'Độ dốc mái', min: 0, max: 45, unit: 'độ', example: '12,5' }
    ];
    const roof = { type, azimuth: Number(input('demoAzimuth').value) };
    const error = [];
    const name = suffix ? 'Mái phụ' : 'Mái chính';
    function validValue(element, value, fallback, message) {
      if (value === null) {
        element.setAttribute('aria-invalid', 'true');
        element.setAttribute('aria-describedby', 'demoRoofInputStatus');
        error.push(name + ' · ' + message);
        return lastNumericValues.get(element) ?? fallback;
      }
      element.removeAttribute('aria-invalid');
      element.removeAttribute('aria-describedby');
      if (!element.disabled) lastNumericValues.set(element, value);
      return value;
    }
    for (const { id, key, label, min, max, unit, example } of measurements) {
      const element = input(id);
      const value = element.disabled ? 0 : SolarRoof.parseMeasure(element.value, min, max);
      roof[key] = validValue(element, value, SolarRoof.parseMeasure(element.defaultValue, min, max),
        label + ' cần từ ' + min + ' đến ' + max + ' ' + unit + '. Ví dụ ' + example + '.');
    }
    const countInput = input('demoPanelCount');
    const count = validValue(countInput, countInput.validity.valid ? countInput.valueAsNumber : null,
      Number(countInput.defaultValue), 'Số tấm cần là số nguyên từ 0 đến ' + SolarRoof.limit + '.');
    return { roof, count, error };
  }

  function readSettings() {
    const loadMode = $('demoLoadMode').value;
    const daily = loadMode === 'daily';
    $('demoDailyLoadField').hidden = !daily;
    $('demoLoad').disabled = !daily;
    $('demoPeakLoadField').hidden = daily;
    $('demoPeakLoad').disabled = daily;
    const batteryOn = Boolean($('demoBattery').value);
    const batteryAuxOn = Boolean($('demoBatteryAux').value);
    const inverterAuxOn = Boolean($('demoInverterAux').value);
    $('demoBatteryFields').hidden = !batteryOn;
    $('demoBatteryCount').disabled = !batteryOn;
    $('demoBatteryAuxFields').hidden = !batteryAuxOn;
    $('demoBatteryCountAux').disabled = !batteryAuxOn;
    $('demoInitialSocField').hidden = !(batteryOn || batteryAuxOn);
    $('demoInitialSoc').disabled = !(batteryOn || batteryAuxOn);
    $('demoInverterAuxFields').hidden = !inverterAuxOn;
    $('demoInverterCountAux').disabled = !inverterAuxOn;
    const main = readRoof();
    const aux = enableAnnex.checked ? readRoof('Aux') : null;
    const roofErrors = [main.error[0], aux?.error[0]].filter(Boolean);
    $('demoRoofInputStatus').textContent = roofErrors.length
      ? roofErrors.join(' ') + ' Các ô chưa hợp lệ tạm dùng giá trị hợp lệ gần nhất.' : '';
    const selected = (category, id) => equipment[category].find(item => item.id === $(id).value);
    const panel = selected('panel', 'demoPanel');
    const size = SolarRoof.moduleSize(panel?.specs);
    const layout = roofPlanner.sync(main.roof, size, main.count);
    const auxLayout = aux && annexPlanner.sync(aux.roof, size, aux.count);
    const annex = aux && { roof: aux.roof, panels: auxLayout.panels, position: $('demoAnnexPositionAux').value };
    const equipmentValue = id => {
      const input = $(id);
      if (!input.validity.valid) return lastNumericValues.get(input) ?? Number(input.defaultValue);
      const value = number(id);
      lastNumericValues.set(input, value);
      return value;
    };
    const inverterGroup = (id, countId) => {
      const unit = selected('inverter', id);
      return { name: unit.name, kw: Number(unit.powerKw), count: equipmentValue(countId) };
    };
    const batteryGroup = (id, countId) => {
      const unit = selected('battery', id);
      return { name: unit.name, kwh: Number(unit.capacityKwh), count: equipmentValue(countId) };
    };
    const inverterGroups = [inverterGroup('demoInverter', 'demoInverterCount')];
    if (inverterAuxOn) inverterGroups.push(inverterGroup('demoInverterAux', 'demoInverterCountAux'));
    const batteryGroups = [];
    if (batteryOn) batteryGroups.push(batteryGroup('demoBattery', 'demoBatteryCount'));
    if (batteryAuxOn) batteryGroups.push(batteryGroup('demoBatteryAux', 'demoBatteryCountAux'));
    const arrays = [
      ...layout.arrays.map(array => ({ ...array, roof: 'Mái chính' })),
      ...(auxLayout?.arrays || []).map(array => ({ ...array, roof: 'Mái phụ' }))
    ];
    const requestedStrings = equipmentValue('demoStringCount');
    return {
      panelWp: Number(panel?.wattWp) || 0, panelCount: layout.panels.length + (annex?.panels.length || 0),
      roof: main.roof, panelSize: size, panels: layout.panels, annex,
      inverterGroups, batteryGroups, requestedStrings,
      topology: SolarModel.planStrings(arrays, requestedStrings, inverterGroups),
      initialSoc: batteryGroups.length ? equipmentValue('demoInitialSoc') : 0,
      latitude: Number($('demoLatitude').value),
      month: Number($('demoMonth').value), weather: $('demoWeather').value,
      loadMode, dailyLoad: daily ? equipmentValue('demoLoad') : 0,
      peakLoad: daily ? 0 : equipmentValue('demoPeakLoad'), exportSurplus: $('demoExportSurplus').checked
    };
  }

  function definitionList(values) {
    return values.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('');
  }

  function renderFlow(row) {
    const toAc = row.pv + row.discharge - row.charge;
    const unused = row.surplus - row.export;
    $('demoFlowHour').textContent = clock(row.hour);
    $('demoFlowGrid').textContent = row.grid > 0 ? 'Mua ' + power(row.grid)
      : row.export > 0 ? 'Nhận ' + power(row.export) : '0 kW';
    const values = {
      demoFlowHub: toAc + row.grid, demoFlowLoad: row.load, demoFlowUnused: unused,
      demoFlowPvPower: row.pv + row.clipping, demoFlowAcPower: toAc, demoFlowChargePower: row.charge,
      demoFlowDischargePower: row.discharge, demoFlowImportPower: row.grid, demoFlowExportPower: row.export
    };
    for (const [id, value] of Object.entries(values)) $(id).textContent = power(value);
    const paths = {
      pv: row.pv + row.clipping, ac: toAc, battery: row.charge - row.discharge,
      grid: row.export - row.grid, load: row.load, unused: -unused
    };
    for (const [name, value] of Object.entries(paths)) {
      const link = flowLinks[name];
      const direction = Math.abs(value) < 0.001 ? '' : value > 0 ? 'forward' : 'reverse';
      if (direction && link.dataset.direction !== direction) link.dataset.direction = direction;
      else if (!direction && link.dataset.direction) delete link.dataset.direction;
    }
    $('demoInverterHourly').textContent = 'PV qua từng biến tần trong giờ này · ' +
      row.inverterProduction.map((value, index) => 'BT ' + (index + 1) + ': ' + power(value)).join(' · ');
  }

  function renderSystem() {
    const { banks, strings } = settings.topology;
    const batteryUnits = settings.batteryGroups.reduce((sum, group) => sum + group.count, 0);
    $('demoFlowPv').textContent = settings.panelCount + ' tấm · ' + strings.length + ' string';
    $('demoFlowInverter').textContent = banks.length + ' máy · ' + format.format(model.inverterKw) + ' kW';
    $('demoFlowBattery').textContent = batteryUnits + ' bộ · ' + energy(model.capacity);
    const exact = strings.length === settings.requestedStrings;
    $('demoStringNote').textContent = strings.length
      ? (exact ? strings.length + ' string.' : 'Yêu cầu ' + settings.requestedStrings + ' string, đang dùng ' +
        strings.length + ' string theo số tấm và số mặt mái có pin.') +
        ' Các tấm cùng mặt mái được chia đều nhất có thể trước khi phân sang biến tần.'
      : 'Đặt tấm pin lên mái để chia string.';
    const rows = strings.map((string, index) => {
      const row = document.createElement('tr');
      const cells = ['S' + (index + 1), string.roof + ' · ' + directions[string.azimuth / 45], string.count,
        'BT ' + (string.inverter + 1) + ' · ' + format.format(banks[string.inverter].kw) + ' kW'];
      cells.forEach((value, index) => {
        const cell = document.createElement(index ? 'td' : 'th');
        if (!index) cell.scope = 'row';
        cell.textContent = value;
        row.append(cell);
      });
      return row;
    });
    $('demoStringRows').replaceChildren(...rows);
    const equipment = [
      ...settings.inverterGroups.map(group => group.count + ' × ' + group.name),
      ...settings.batteryGroups.map(group => group.count + ' × ' + group.name)
    ];
    $('demoBankNote').textContent = equipment.join(' · ');
  }

  function queueFrame() {
    if (!frameId && model && enabled() && (sceneVisible || playing) && !document.hidden) {
      frameId = requestAnimationFrame(renderFrame);
    }
  }

  function cancelFrame() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    previousFrame = 0;
  }

  function invalidateScene() {
    dirty = true;
    queueFrame();
  }

  function approach(value, target, amount, threshold) {
    const next = value + (target - value) * amount;
    return Math.abs(next - target) < threshold ? target : next;
  }

  function renderFrame(now) {
    frameId = 0;
    if (!model || !enabled() || (!sceneVisible && !playing) || document.hidden) return cancelFrame();
    const elapsed = previousFrame ? Math.min(now - previousFrame, 50) : 16;
    previousFrame = now;
    const amount = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 78);
    const [targetClouds, targetRain] = weatherEffects[settings.weather];
    const wasInMotion = playing || sceneHour !== Number(hourInput.value) || angle !== targetAngle ||
      elevation !== targetElevation || clouds !== targetClouds || rain !== targetRain;

    if (playing) {
      sceneHour = Math.min(23, sceneHour + elapsed / 520);
      const hour = Math.floor(sceneHour);
      if (hour !== Number(hourInput.value)) {
        hourInput.value = String(hour);
        renderHour();
      }
      if (sceneHour === 23) stop();
    } else {
      sceneHour = approach(sceneHour, Number(hourInput.value), amount, 0.012);
    }
    angle = approach(angle, targetAngle, amount, 0.001);
    elevation = approach(elevation, targetElevation, amount, 0.001);
    clouds = approach(clouds, targetClouds, amount, 0.004);
    rain = approach(rain, targetRain, amount, 0.004);

    const ambient = sceneVisible && animateWeather && (clouds > 0 || rain > 0);
    if (ambient) weatherTime += elapsed / 1000;
    if (sceneVisible && (dirty || wasInMotion || (ambient && now - lastDraw >= 1000 / 30 - 1))) {
      const visualHour = reducedMotion.matches ? Number(hourInput.value) : sceneHour;
      const sun = SolarModel.sunPosition(settings.latitude, settings.month, visualHour);
      SolarScene.draw(canvas, settings, sun, angle, elevation, { clouds, rain, time: weatherTime });
      dirty = false;
      lastDraw = now;
    }
    if (playing || ambient || wasInMotion) queueFrame();
    else previousFrame = 0;
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
    renderFlow(row);
    invalidateScene();
  }

  function renderReport() {
    const { results, totals, dcKw, capacity } = model;
    const limit = Math.min(model.inverterKw, 20);
    $('demoLoadNote').textContent = 'Đỉnh mô phỏng ' + power(model.loadPeak) + ' · ' + energy(totals.load) +
      ' mỗi ngày. Giới hạn theo cụm biến tần: ' + power(limit) + '.' +
      (settings.loadMode === 'daily' && totals.load + .01 < settings.dailyLoad
        ? ' Điện năng mô phỏng đã giảm để giữ giới hạn này.' : '');
    const autonomy = totals.load > 0 ? (1 - totals.grid / totals.load) * 100 : null;
    $('demoTotals').innerHTML = definitionList([
      ['Sản lượng PV', energy(totals.pv)], ['Tải tiêu thụ', energy(totals.load)],
      ['Điện từ lưới', energy(totals.grid)], ['Tự đáp ứng tải', autonomy === null ? '—' : percent(autonomy)]
    ]);
    $('demoBalance').textContent = 'Dùng trực tiếp ' + energy(totals.direct) + ' · Sạc ' + energy(totals.charge) +
      ' · Xả ' + energy(totals.discharge) + ' · Điện dư ' + energy(totals.surplus) +
      (settings.exportSurplus ? ' · Phát lên lưới ' + energy(totals.export) : '') + ' · Cắt đỉnh ' + energy(totals.clipping);
    const scale = Math.max(1, Math.ceil(Math.max(...results.flatMap(row => [row.pv, row.load, row.grid]))));
    $('demoChartAxis').textContent = 'Thang đo 0–' + format.format(scale) + ' kWh mỗi giờ';
    $('demoChart').innerHTML = results.map(row => {
      const bar = (key, value) => '<span class="demo-' + key + '-key" style="height:' + (value / scale * 100) + '%"></span>';
      return '<figure class="demo-bin"><div class="demo-bars">' + bar('pv', row.pv) + bar('load', row.load) + bar('grid', row.grid) +
        '</div><figcaption>' + (row.hour % 6 === 0 ? clock(row.hour).slice(0, 2) + 'h' : '') + '</figcaption></figure>';
    }).join('');
    $('demoRows').innerHTML = results.map(row => {
      const cells = [row.pv, row.load, row.charge, row.discharge, row.grid, row.surplus, row.export].map(format.format);
      cells.push(capacity ? percent(row.soc) : '—');
      return '<tr><th scope="row">' + clock(row.hour) + '</th>' + cells.map(cell => '<td>' + cell + '</td>').join('') + '</tr>';
    }).join('');
    $('demoSceneMeta').textContent = format.format(dcKw) + ' kWp · ' + settings.panelCount + ' tấm · ' +
      format.format(capacity) + ' kWh lưu trữ' + (settings.annex ? ' · 2 mái' : '');
    $('demoRoofResult').textContent = settings.panelCount + ' tấm đã xếp · ' + format.format(dcKw) + ' kWp';
  }

  function simulate() {
    if (!enabled()) return;
    settings = readSettings();
    $('demoEquipmentNote').textContent = form.matches(':invalid')
      ? 'Kiểm tra các ô số trong cấu hình. Mô phỏng tạm dùng giá trị hợp lệ gần nhất cho ô đang sai.'
      : usingSamples ? 'Dùng cấu hình mẫu cho nhóm thiết bị chưa có dữ liệu trong danh mục.' : '';
    model = SolarModel.simulate(settings);
    renderReport();
    renderSystem();
    renderHour();
  }

  function stop() {
    playing = false;
    playButton.textContent = 'Chạy 24 giờ';
    playButton.setAttribute('aria-pressed', 'false');
  }

  playButton.addEventListener('click', () => {
    if (playing) {
      stop();
      invalidateScene();
      return;
    }
    if (!model || !enabled()) return;
    playing = true;
    sceneHour = 0;
    hourInput.value = '0';
    renderHour();
    playButton.textContent = 'Tạm dừng';
    playButton.setAttribute('aria-pressed', 'true');
  });
  function setWeatherMotion(value) {
    animateWeather = value;
    motionButton.setAttribute('aria-pressed', String(value));
    invalidateScene();
  }
  setWeatherMotion(animateWeather);
  motionButton.addEventListener('click', () => setWeatherMotion(!animateWeather));
  reducedMotion.addEventListener('change', event => setWeatherMotion(!event.matches));
  hourInput.addEventListener('input', () => { stop(); renderHour(); });
  function updateDesign() {
    $('demoBalanceRoofsStatus').textContent = '';
    simulate();
  }
  for (const editor of [form, $('demoRoofGeometry'), $('demoRoofGeometryAux')]) {
    editor.addEventListener('submit', event => { event.preventDefault(); updateDesign(); });
    editor.addEventListener('input', updateDesign);
    editor.addEventListener('change', updateDesign);
  }
  $('demoBalanceRoofs').addEventListener('click', () => {
    if (!settings?.annex) return;
    const total = readRoof().count + readRoof('Aux').count;
    const result = SolarRoof.balance(total, settings.roof, settings.annex.roof, settings.panelSize);
    $('demoPanelCount').value = result.main;
    $('demoPanelCountAux').value = result.annex;
    roofPlanner.reflow();
    annexPlanner.reflow();
    simulate();
    $('demoBalanceRoofsStatus').textContent = 'Mái chính ' + result.main + ' tấm · Mái phụ ' + result.annex + ' tấm.' +
      (result.remainder ? ' Còn ' + result.remainder + ' tấm chưa có chỗ theo kích thước mái hiện tại.' : '');
  });
  function selectRoof(useAnnex) {
    mainRoof.hidden = useAnnex;
    annexRoof.hidden = !useAnnex;
    $('demoEditMainRoof').setAttribute('aria-pressed', String(!useAnnex));
    $('demoEditAnnexRoof').setAttribute('aria-pressed', String(useAnnex));
  }
  let annexInitialized = false;
  enableAnnex.addEventListener('change', () => {
    const enabled = enableAnnex.checked;
    if (enabled && !annexInitialized) {
      $('demoAzimuthAux').value = $('demoAzimuth').value;
      annexInitialized = true;
    }
    $('demoRoofZoneSwitch').hidden = !enabled;
    $('demoBalanceRoofsStatus').textContent = '';
    selectRoof(enabled);
    simulate();
  });
  $('demoEditMainRoof').addEventListener('click', () => selectRoof(false));
  $('demoEditAnnexRoof').addEventListener('click', () => selectRoof(true));
  document.querySelectorAll('[data-rotate]').forEach(button => {
    button.addEventListener('click', () => {
      targetAngle += Number(button.dataset.rotate) * 0.34;
      invalidateScene();
    });
  });
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    targetAngle += (event.clientX - drag.x) * 0.015;
    targetElevation = Math.max(0.80, Math.min(1.32, targetElevation + (event.clientY - drag.y) * 0.008));
    drag.x = event.clientX;
    drag.y = event.clientY;
    invalidateScene();
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  new ResizeObserver(invalidateScene).observe(canvas);
  new IntersectionObserver(([entry]) => {
    sceneVisible = entry.isIntersecting;
    if (sceneVisible) invalidateScene();
    else if (!playing) cancelFrame();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelFrame();
    else invalidateScene();
  });

  function applyBranding(config) {
    SiteTheme.apply(config);
    const brand = config.branding || {};
    const company = brand.companyName || 'Công Ty TNHH Mai Sơn Solar';
    document.title = 'Demo mô phỏng điện mặt trời 3D – ' + company;
    $('demoCompany').textContent = config.footer?.companyLine || company;
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
    renderSiteContact(config.footer || {});
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
        cancelFrame();
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
