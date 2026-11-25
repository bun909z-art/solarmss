/* Admin Products UI: Kho sản phẩm, trạng thái kho, Datasheet/Tài liệu & nhập Excel */
'use strict';

// ---------- PRODUCT CATALOG MANAGER ----------
  function renderProdList() {
    const el = $('prodListEditor');
    if (!el) return;
    if ($('prodCount')) $('prodCount').textContent = PRODUCTS.length;
    const filtered = PRODUCTS.map((p, idx) => ({ p, idx })).filter(x => prodFilter === 'all' || x.p.category === prodFilter);
    const catLabel = { inverter: 'Inverter', panel: 'Pin MT', battery: 'Lưu trữ', accessory: 'Phụ kiện' };

    el.innerHTML = filtered.map(({ p, idx }) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <img src="${escapeAttr(p.imageUrl || '/assets/prod-' + p.category + '.jpg')}" alt="" style="width:36px;height:36px;border-radius:7px;object-fit:cover;border:1px solid #E2E8F0;flex:none">
          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;flex:1;min-width:0">
            <input type="checkbox" data-p-act="${idx}" ${p.active !== false ? 'checked' : ''}>
            <span style="color:#D9560B">[${catLabel[p.category] || p.category}]</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeAttr(p.name)}</span>
          </label>
          <label class="btn-ghost small" style="padding:4px 7px;font-size:11px;cursor:pointer;white-space:nowrap" title="Tải ảnh sản phẩm">
            Đổi ảnh<input type="file" accept="image/*" data-p-img="${idx}" hidden>
          </label>
          <button type="button" class="del-btn" data-p-del="${idx}" title="Xóa">×</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <input type="text" class="f-input" data-p-name="${idx}" value="${escapeAttr(p.name)}" placeholder="Tên sản phẩm">
          <input type="text" class="f-input" data-p-brand="${idx}" value="${escapeAttr(p.brand || '')}" placeholder="Hãng">
          ${p.category === 'accessory'
            ? `<input type="text" class="f-input" data-p-spec="${idx}" value="${escapeAttr(p.specText || '')}" placeholder="Quy cách (VD: IP65, 4mm²...)" title="Quy cách / Thông số chính">`
            : `<input type="number" class="f-input" data-p-spec="${idx}" value="${p.category === 'inverter' ? p.powerKw : p.category === 'panel' ? p.wattWp : p.capacityKwh}" step="0.01" title="Công suất / Dung lượng">`}
          <input type="number" class="f-input" data-p-price="${idx}" value="${p.price || 0}" step="100000" title="Giá nội bộ (tính Combo)">
          <input type="text" class="f-input" data-p-war="${idx}" value="${escapeAttr(p.warranty || '')}" placeholder="Bảo hành">
          <select class="f-input" data-p-stock="${idx}" style="font-weight:700;color:${(p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock')) === 'out_of_stock' ? '#B91C1C' : (p.stockStatus === 'contact' ? '#B45309' : '#047857')}">
            <option value="in_stock" ${(p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock')) === 'in_stock' ? 'selected' : ''}>✅ Còn hàng</option>
            <option value="contact" ${p.stockStatus === 'contact' ? 'selected' : ''}>📞 Liên hệ</option>
            <option value="out_of_stock" ${(p.stockStatus || (p.inStock === false ? 'out_of_stock' : 'in_stock')) === 'out_of_stock' ? 'selected' : ''}>⛔ Hết hàng</option>
          </select>
          <input type="text" class="f-input" style="grid-column:1/-1" data-p-note="${idx}" value="${escapeAttr(p.note || '')}" placeholder="Ghi chú ngắn">
          <textarea class="f-input" style="grid-column:1/-1" rows="2" data-p-desc="${idx}" placeholder="Mô tả chi tiết sản phẩm...">${escapeAttr(p.description || '')}</textarea>
          <textarea class="f-input" style="grid-column:1/-1" rows="3" data-p-specs="${idx}" placeholder="Thông số kỹ thuật (mỗi dòng dạng Tên: Giá trị)">${escapeAttr(p.specs || '')}</textarea>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding-top:4px;border-top:1px dashed #E2E8F0">
          <input type="text" class="f-input" style="flex:1;min-width:140px;font-size:12px" data-p-ds-url="${idx}" value="${escapeAttr(p.datasheetUrl || '')}" placeholder="Link Datasheet (hoặc bấm tải lên)">
          <label class="btn-ghost small" style="padding:5px 8px;font-size:11.5px;cursor:pointer">
            📄 Tải Datasheet<input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip" data-p-ds-file="${idx}" hidden>
          </label>
          <label class="btn-ghost small" style="padding:5px 8px;font-size:11.5px;cursor:pointer">
            📎 + Tài liệu<input type="file" accept=".pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg,.zip" data-p-att-file="${idx}" hidden>
          </label>
        </div>
        ${(Array.isArray(p.attachments) && p.attachments.length) ? `<div style="display:flex;flex-wrap:wrap;gap:5px">${p.attachments.map((a, ai) => `<span style="display:inline-flex;align-items:center;gap:4px;background:#EEF2FF;color:#3730A3;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700">📎 ${escapeAttr(a.name)} <button type="button" data-p-del-att="${idx}:${ai}" style="border:0;background:none;color:#DC2626;cursor:pointer;font-weight:900;padding:0">×</button></span>`).join('')}</div>` : ''}
      </div>
    `).join('') || '<p class="hint">Chưa có sản phẩm nào trong nhóm này.</p>';

    el.querySelectorAll('[data-p-act]').forEach(cb => cb.onchange = () => { PRODUCTS[+cb.dataset.pAct].active = cb.checked; pushPreview(); });
    el.querySelectorAll('[data-p-name]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pName].name = inp.value; pushPreview(); });
    el.querySelectorAll('[data-p-brand]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pBrand].brand = inp.value; pushPreview(); });
    el.querySelectorAll('[data-p-spec]').forEach(inp => inp.oninput = () => {
      const p = PRODUCTS[+inp.dataset.pSpec];
      if (p.category === 'accessory') { p.specText = inp.value; }
      else {
        const v = Math.max(0.1, Number(inp.value) || 0);
        if (p.category === 'inverter') p.powerKw = v; else if (p.category === 'panel') p.wattWp = v; else p.capacityKwh = v;
      }
      pushPreview();
    });
    el.querySelectorAll('[data-p-war]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pWar].warranty = inp.value; });
    el.querySelectorAll('[data-p-stock]').forEach(sel => sel.onchange = () => {
      const st = sel.value;
      PRODUCTS[+sel.dataset.pStock].stockStatus = st;
      PRODUCTS[+sel.dataset.pStock].inStock = st !== 'out_of_stock';
      sel.style.color = st === 'out_of_stock' ? '#B91C1C' : (st === 'contact' ? '#B45309' : '#047857');
      pushPreview();
    });
    el.querySelectorAll('[data-p-note]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pNote].note = inp.value; });
    el.querySelectorAll('[data-p-desc]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pDesc].description = inp.value; });
    el.querySelectorAll('[data-p-specs]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pSpecs].specs = inp.value; });
    el.querySelectorAll('[data-p-ds-url]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pDsUrl].datasheetUrl = inp.value.trim(); });
    el.querySelectorAll('[data-p-ds-file]').forEach(inp => inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const idx = +inp.dataset.pDsFile;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const res = await api('/api/admin/upload-document', { method: 'POST', body: JSON.stringify({ dataUrl: rd.result, filename: f.name }) });
          PRODUCTS[idx].datasheetUrl = res.url;
          PRODUCTS[idx].datasheetName = 'Datasheet: ' + f.name;
          renderProdList();
          toast('Đã tải lên Datasheet! Bấm "Lưu danh mục sản phẩm" để ghi lại.');
        } catch (err) { toast(err.message); }
      };
      rd.readAsDataURL(f);
    });
    el.querySelectorAll('[data-p-att-file]').forEach(inp => inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const idx = +inp.dataset.pAttFile;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const res = await api('/api/admin/upload-document', { method: 'POST', body: JSON.stringify({ dataUrl: rd.result, filename: f.name }) });
          if (!Array.isArray(PRODUCTS[idx].attachments)) PRODUCTS[idx].attachments = [];
          PRODUCTS[idx].attachments.push({ name: f.name, url: res.url });
          renderProdList();
          toast('Đã đính kèm tài liệu! Bấm "Lưu danh mục sản phẩm" để ghi lại.');
        } catch (err) { toast(err.message); }
      };
      rd.readAsDataURL(f);
    });
    el.querySelectorAll('[data-p-del-att]').forEach(btn => btn.onclick = () => {
      const [pi, ai] = btn.dataset.pDelAtt.split(':').map(Number);
      PRODUCTS[pi].attachments.splice(ai, 1);
      renderProdList();
    });
    el.querySelectorAll('[data-p-price]').forEach(inp => inp.oninput = () => { PRODUCTS[+inp.dataset.pPrice].price = Math.max(0, Number(inp.value) || 0); pushPreview(); });
    el.querySelectorAll('[data-p-img]').forEach(inp => {
      inp.onchange = () => {
        const file = inp.files[0]; if (!file) return;
        const idx = +inp.dataset.pImg;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const res = await api('/api/admin/upload-product-image', { method: 'POST', body: JSON.stringify({ dataUrl: reader.result }) });
            PRODUCTS[idx].imageUrl = res.imageUrl;
            renderProdList(); pushPreview();
            toast('Đã cập nhật ảnh sản phẩm! Nhớ bấm Lưu danh mục sản phẩm.');
          } catch (err) { toast(err.message); }
        };
        reader.readAsDataURL(file);
      };
    });
    el.querySelectorAll('[data-p-del]').forEach(btn => btn.onclick = () => { PRODUCTS.splice(+btn.dataset.pDel, 1); renderProdList(); pushPreview(); });
  }

  if ($('prodFilterTabs')) {
    $('prodFilterTabs').querySelectorAll('[data-pcat]').forEach(btn => {
      btn.onclick = () => {
        $('prodFilterTabs').querySelectorAll('[data-pcat]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        prodFilter = btn.dataset.pcat;
        renderProdList();
      };
    });
  }

  if ($('btnAddProd')) {
    $('btnAddProd').onclick = () => {
      const cat = $('np_cat').value;
      const name = $('np_name').value.trim();
      const specRaw = $('np_spec').value.trim();
      const spec = Number(specRaw) || 0;
      if (!name || (cat !== 'accessory' && spec <= 0)) return toast('Nhập tên sản phẩm và công suất/dung lượng hợp lệ.');
      const item = {
        id: `${cat}-${Date.now()}`,
        category: cat,
        brand: $('np_brand').value.trim(),
        name,
        price: Math.max(0, Number($('np_price').value) || 0),
        warranty: cat === 'inverter' ? '5 năm' : ($('np_phase').value.trim() || (cat === 'accessory' ? '2 năm' : '10 năm')),
        note: '',
        description: $('np_desc') ? $('np_desc').value.trim() : '',
        specs: '',
        datasheetUrl: '',
        datasheetName: '',
        attachments: [],
        imageUrl: `/assets/prod-${cat}.jpg`,
        stockStatus: $('np_stock') ? $('np_stock').value : 'in_stock',
        inStock: $('np_stock') ? $('np_stock').value !== 'out_of_stock' : true,
        active: true
      };
      if (cat === 'inverter') { item.powerKw = spec; item.phase = $('np_phase').value.trim() || '1 pha'; }
      else if (cat === 'panel') item.wattWp = spec;
      else if (cat === 'battery') item.capacityKwh = spec;
      else item.specText = specRaw;
      PRODUCTS.unshift(item);
      $('np_name').value = ''; $('np_spec').value = ''; $('np_price').value = ''; if ($('np_desc')) $('np_desc').value = '';
      renderProdList(); pushPreview();
      toast('Đã thêm sản phẩm. Bấm "Lưu danh mục sản phẩm" để ghi lên máy chủ.');
    };
  }

  if ($('btnSaveProds')) {
    $('btnSaveProds').onclick = async () => {
      try {
        const res = await api('/api/admin/products', { method: 'PUT', body: JSON.stringify({ products: PRODUCTS }) });
        PRODUCTS = res.products;
        renderProdList(); pushPreview();
        toast(`Đã lưu ${PRODUCTS.length} sản phẩm lên máy chủ!`);
      } catch (err) { toast(err.message); }
    };
  }

  if ($('btnResetProds')) {
    $('btnResetProds').onclick = async () => {
      try {
        const res = await api('/api/admin/products/reset', { method: 'POST' });
        PRODUCTS = res.products;
        renderProdList(); pushPreview();
        toast('Đã khôi phục kho sản phẩm mẫu.');
      } catch (err) { toast(err.message); }
    };
  }

  if ($('prodUploadFile')) {
    $('prodUploadFile').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const lower = file.name.toLowerCase();
      const mode = $('importProdMode').value;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          let payload;
          if (lower.endsWith('.xlsx')) {
            const bytes = new Uint8Array(reader.result);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            payload = { format: 'xlsx', mode, base64: btoa(bin) };
          } else if (lower.endsWith('.csv')) {
            payload = { format: 'csv', mode, content: reader.result };
          } else {
            payload = { format: 'json', mode, products: JSON.parse(reader.result) };
          }
          const res = await api('/api/admin/products/import', { method: 'POST', body: JSON.stringify(payload) });
          PRODUCTS = res.products;
          renderProdList(); pushPreview();
          toast(`Đã cập nhật ${res.count} sản phẩm từ tệp ${file.name}!`);
        } catch (err) { toast(err.message || 'Tệp Excel/CSV/JSON không hợp lệ.'); }
        e.target.value = '';
      };
      if (lower.endsWith('.xlsx')) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'utf-8');
    });
  }
