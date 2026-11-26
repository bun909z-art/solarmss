(function () {
  'use strict';

  const format = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  const directions = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
  const bearing = azimuth => directions[azimuth / 45];

  function create(onChange, suffix = '') {
    const $ = id => document.getElementById(id + suffix);
    const board = $('demoRoofBoard'), add = $('demoAddPanel'), ghost = $('demoPanelGhost');
    let roof, size, panels = [], requested = 0, nextId = 0;
    let selected = null, placing = false, mode = 'auto', drag = null, ignoreClickUntil = 0;
    const newId = () => ++nextId;
    const selectedPanel = () => panels.find(panel => panel.id === selected);
    const report = message => { $('demoRoofMessage').textContent = message; };

    function reportPacking() {
      if (!requested) return report('Nhập số tấm muốn lắp để hệ thống tự bố trí.');
      if (!panels.length) {
        return report('Không đủ chỗ cho một tấm của mẫu đang chọn. Tăng kích thước mái hoặc chọn tấm nhỏ hơn.');
      }
      if (panels.length < requested) {
        return report('Đã xếp ' + panels.length + ' tấm. Còn ' + (requested - panels.length) +
          ' tấm chưa có chỗ phù hợp với mái và kích thước tấm đang chọn.');
      }
      const balanced = roof.type === 'gable' ? ' giữa hai mặt mái.' : ' theo hàng cân giữa mái.';
      report(mode === 'balanced' ? 'Đã cân ' + requested + ' tấm' + balanced :
        'Đã xếp đủ ' + requested + ' tấm. Có thể kéo hoặc xoay từng tấm để chỉnh lại.');
    }

    function position(element, panel) {
      const footprint = SolarRoof.dimensions(panel, size, roof);
      element.style.left = (panel.x / roof.width * 100) + '%';
      element.style.top = (panel.z / roof.depth * 100) + '%';
      element.style.width = (footprint.width / roof.width * 100) + '%';
      element.style.height = (footprint.depth / roof.depth * 100) + '%';
    }

    function showSelection() {
      $('demoRotatePanel').disabled = !selectedPanel();
      $('demoRemovePanel').disabled = !selectedPanel();
      $('demoClearRoof').disabled = !panels.length && !requested;
      $('demoAutoPanels').disabled = !requested;
      $('demoBalanceCurrentRoof').disabled = !requested;
      add.disabled = panels.length >= SolarRoof.limit;
      add.setAttribute('aria-pressed', String(placing));
      board.dataset.placing = String(placing);
      board.querySelectorAll('[data-panel]').forEach(button => {
        button.setAttribute('aria-pressed', String(Number(button.dataset.panel) === selected));
      });
    }

    function render() {
      const focusedPanel = board.contains(document.activeElement);
      board.style.width = 'min(100%, ' + (300 * roof.width / roof.depth) + 'px)';
      board.style.aspectRatio = roof.width + ' / ' + roof.depth;
      board.style.backgroundSize = (100 / roof.width) + '% ' + (100 / roof.depth) + '%';
      $('demoRoofRidge').hidden = roof.type !== 'gable';
      $('demoRoofFront').textContent = '↓ Mặt trước · ' + bearing(roof.azimuth);
      const groups = SolarRoof.arrays(panels, size, roof);
      const sides = roof.type === 'gable' ? ' · ' + SolarRoof.faces(roof).map(face => {
        const count = groups.find(group => group.azimuth === face.azimuth)?.count || 0;
        return bearing(face.azimuth) + ' ' + count + ' tấm';
      }).join(' / ') : '';
      $('demoRoofSummary').textContent = panels.length + '/' + requested + ' tấm trên mái · ' +
        format.format(size.width) + ' × ' + format.format(size.length) + ' m/tấm' + (size.estimated ? ' (ước tính)' : '') + sides;
      board.querySelectorAll('[data-panel]').forEach(button => button.remove());
      const cards = panels.map((panel, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'demo-roof-panel';
        button.dataset.panel = panel.id;
        button.textContent = index + 1;
        button.setAttribute('aria-label', 'Tấm pin ' + (index + 1) + ', ' + (panel.rotated ? 'nằm ngang' : 'đặt dọc') +
          ', tọa độ ' + format.format(panel.x) + ' × ' + format.format(panel.z) + ' mét');
        button.setAttribute('aria-description', 'Dùng phím mũi tên để di chuyển tấm pin.');
        position(button, panel);
        return button;
      });
      board.append(...cards);
      showSelection();
      if (focusedPanel) (board.querySelector('[data-panel="' + selected + '"]') || add).focus({ preventScroll: true });
    }

    function sync(nextRoof, nextSize, count) {
      const geometryChanged = !roof || roof.type !== nextRoof.type || roof.width !== nextRoof.width ||
        roof.depth !== nextRoof.depth || roof.tilt !== nextRoof.tilt ||
        size.width !== nextSize.width || size.length !== nextSize.length;
      const detailsChanged = !roof || roof.azimuth !== nextRoof.azimuth || size.estimated !== nextSize.estimated;
      if (geometryChanged || detailsChanged || count !== requested) {
        roof = nextRoof;
        size = nextSize;
        if ((geometryChanged || count !== requested) && mode === 'balanced') {
          panels = SolarRoof.balanceOnRoof(count, size, roof, newId);
        } else if (geometryChanged || count !== requested) {
          const kept = [];
          if (mode === 'manual') {
            for (const panel of panels) if (SolarRoof.fits(panel, kept, size, roof)) kept.push(panel);
          }
          panels = SolarRoof.fill(kept, count, size, roof, newId);
          if (kept.length && panels.length < count) {
            const repacked = SolarRoof.fill([], count, size, roof, newId);
            if (repacked.length > panels.length) panels = repacked;
          }
        }
        requested = count;
        if (!selectedPanel()) selected = null;
        render();
        reportPacking();
      }
      return { panels, arrays: SolarRoof.arrays(panels, size, roof) };
    }

    function commit(message, adjustCount = false, nextMode = 'manual') {
      mode = nextMode;
      placing = false;
      if (adjustCount) {
        requested = panels.length;
        $('demoPanelCount').value = String(requested);
      }
      render();
      report(message);
      onChange();
    }

    function choose(id) {
      selected = id;
      placing = false;
      showSelection();
    }

    function onBoard(x, y, panel, offsetX, offsetZ) {
      if (!roof) return null;
      const rect = board.getBoundingClientRect();
      if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
      return { ...panel, x: SolarRoof.snap((x - rect.left) / rect.width * roof.width - offsetX),
        z: SolarRoof.snap((y - rect.top) / rect.height * roof.depth - offsetZ) };
    }

    function applyPanel(candidate) {
      if (!candidate || !SolarRoof.fits(candidate, panels, size, roof)) {
        report('Vị trí không hợp lệ. Đặt tấm trong một mặt mái và chừa khoảng trống với các tấm khác.');
        return;
      }
      if (candidate.id === undefined) {
        if (panels.length >= SolarRoof.limit) return;
        const panel = { ...candidate, id: newId() };
        panels = [...panels, panel];
        selected = panel.id;
        commit('Đã thêm tấm pin.', true);
      } else {
        panels = panels.map(panel => panel.id === candidate.id ? candidate : panel);
        commit('Đã cập nhật vị trí tấm pin.');
      }
    }

    function pointerDown(event, panel) {
      if (!roof || !event.isPrimary || event.button !== 0) return;
      const source = event.currentTarget;
      const block = panel || { rotated: false };
      const footprint = SolarRoof.dimensions(block, size, roof);
      let offsetX = footprint.width / 2, offsetZ = footprint.depth / 2;
      if (panel) {
        const point = onBoard(event.clientX, event.clientY, block, 0, 0);
        if (!point) return;
        choose(panel.id);
        offsetX = point.x - panel.x;
        offsetZ = point.z - panel.z;
      }
      drag = { id: event.pointerId, panel: block, offsetX, offsetZ, x: event.clientX, y: event.clientY, moved: false };
      source.setPointerCapture(event.pointerId);
    }

    board.addEventListener('pointerdown', event => {
      const button = event.target.closest('[data-panel]');
      if (button) pointerDown(event, panels.find(panel => panel.id === Number(button.dataset.panel)));
    });
    add.addEventListener('pointerdown', event => pointerDown(event));
    window.addEventListener('pointermove', event => {
      if (event.pointerId !== drag?.id) return;
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 5) drag.moved = true;
      if (!drag.moved) return;
      const point = onBoard(event.clientX, event.clientY, drag.panel, drag.offsetX, drag.offsetZ);
      ghost.hidden = !point;
      if (point) {
        position(ghost, point);
        ghost.dataset.valid = String(SolarRoof.fits(point, panels, size, roof));
      }
    });
    function finishDrag(event) {
      if (event.pointerId !== drag?.id) return;
      const current = drag;
      drag = null;
      ghost.hidden = true;
      if (event.type === 'pointerup' && current.moved) {
        ignoreClickUntil = performance.now() + 100;
        applyPanel(onBoard(event.clientX, event.clientY, current.panel, current.offsetX, current.offsetZ));
      }
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) window.addEventListener(type, finishDrag);

    add.addEventListener('click', event => {
      if (!roof || performance.now() < ignoreClickUntil) return;
      if (event.detail === 0) {
        const added = SolarRoof.fill(panels, panels.length + 1, size, roof, () => 0).at(-1);
        if (added && !panels.includes(added)) applyPanel({ x: added.x, z: added.z, rotated: added.rotated });
        else report('Mái chưa còn vị trí phù hợp để thêm tấm pin.');
        return;
      }
      placing = !placing;
      if (placing) selected = null;
      showSelection();
      report(placing ? 'Chạm vào vị trí muốn đặt tấm pin.' : '');
    });
    board.addEventListener('click', event => {
      if (performance.now() < ignoreClickUntil) return;
      const button = event.target.closest('[data-panel]');
      if (button) choose(Number(button.dataset.panel));
      else if (placing) {
        const panel = { rotated: false };
        const footprint = SolarRoof.dimensions(panel, size, roof);
        applyPanel(onBoard(event.clientX, event.clientY, panel, footprint.width / 2, footprint.depth / 2));
      }
    });
    board.addEventListener('keydown', event => {
      const button = event.target.closest('[data-panel]');
      if (!button) return;
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault();
      choose(Number(button.dataset.panel));
      const panel = selectedPanel();
      applyPanel({ ...panel, x: SolarRoof.snap(panel.x + direction[0] * 0.1), z: SolarRoof.snap(panel.z + direction[1] * 0.1) });
    });
    $('demoRotatePanel').addEventListener('click', () => {
      const panel = selectedPanel();
      if (panel) applyPanel({ ...panel, rotated: !panel.rotated });
    });
    $('demoRemovePanel').addEventListener('click', () => {
      panels = panels.filter(panel => panel.id !== selected);
      selected = null;
      commit('Đã gỡ tấm pin.', true);
    });
    $('demoClearRoof').addEventListener('click', () => {
      panels = [];
      selected = null;
      commit('Đã dọn mái.', true);
    });
    $('demoAutoPanels').addEventListener('click', () => {
      if (!roof) return;
      panels = SolarRoof.fill([], requested, size, roof, newId);
      selected = null;
      commit('', false, 'auto');
      reportPacking();
    });
    $('demoBalanceCurrentRoof').addEventListener('click', () => {
      if (!roof) return;
      panels = SolarRoof.balanceOnRoof(requested, size, roof, newId);
      selected = null;
      commit('', false, 'balanced');
      reportPacking();
    });
    return { sync, reflow() { roof = null; mode = 'balanced'; } };
  }

  window.SolarRoofPlanner = { create };
})();
