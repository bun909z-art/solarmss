/* Admin Leads CRM UI: Quản lý dữ liệu khách hàng & xuất CSV */
'use strict';

// ---------- CUSTOMER LEADS CRM ----------
  const nfLead = new Intl.NumberFormat('vi-VN');
  function fmtLeadTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('vi-VN');
    } catch { return iso; }
  }

  function renderLeadsList() {
    const el = $('leadsListEditor');
    if (!el) return;
    if ($('leadsTabCount')) $('leadsTabCount').textContent = LEADS.length;
    if ($('leadsCount')) $('leadsCount').textContent = LEADS.length;
    if ($('kpiLeadTotal')) $('kpiLeadTotal').textContent = LEADS.length;
    if ($('kpiLeadNew')) $('kpiLeadNew').textContent = LEADS.filter(x => (x.status || 'new') === 'new').length;
    if ($('kpiLeadClosed')) $('kpiLeadClosed').textContent = LEADS.filter(x => x.status === 'closed').length;

    const q = leadSearchQ.trim().toLowerCase();
    const list = LEADS.filter(l => {
      if (leadStatusFilter !== 'all' && (l.status || 'new') !== leadStatusFilter) return false;
      if (q) {
        const hay = `${l.customerName || ''} ${l.customerPhone || ''} ${l.customerAddress || ''} ${(l.selectedCombo && l.selectedCombo.title) || ''} ${l.adminNote || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    el.innerHTML = list.map(l => {
      const c = l.selectedCombo;
      const phoneClean = String(l.customerPhone || '').replace(/[^\d+]/g, '');
      const zaloClean = phoneClean.replace(/[^\d]/g, '');
      const st = l.status || 'new';
      const stColor = st === 'closed' ? '#047857' : st === 'cancelled' ? '#B91C1C' : st === 'new' ? '#EA580C' : '#1D4ED8';
      return `<div class="list-item" style="flex-direction:column;align-items:stretch;gap:7px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
          <div style="min-width:0">
            <div style="font-weight:800;font-size:13.5px;color:#0F172A">${escapeAttr(l.customerName || 'Khách vãng lai')}</div>
            <div style="font-size:11.5px;color:#64748B">🕒 ${escapeAttr(fmtLeadTime(l.updatedAt || l.createdAt))}</div>
          </div>
          <button type="button" class="del-btn" data-l-del="${escapeAttr(l.id)}" title="Xóa khách hàng">×</button>
        </div>
        ${(l.customerPhone || l.customerAddress) ? `<div style="font-size:12px;color:#334155;display:flex;flex-direction:column;gap:3px">
          ${l.customerPhone ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span>📞 <b>${escapeAttr(l.customerPhone)}</b></span>${phoneClean ? `<a href="tel:${phoneClean}" style="font-size:11px;font-weight:700;color:#047857;text-decoration:none;background:#ECFDF5;padding:2px 7px;border-radius:99px">Gọi</a>` : ''}${zaloClean ? `<a href="https://zalo.me/${zaloClean}" target="_blank" rel="noopener" style="font-size:11px;font-weight:700;color:#0369A1;text-decoration:none;background:#E0F2FE;padding:2px 7px;border-radius:99px">Zalo</a>` : ''}</div>` : ''}
          ${l.customerAddress ? `<div>📍 ${escapeAttr(l.customerAddress)}</div>` : ''}
        </div>` : ''}
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:7px 9px;font-size:12px;color:#334155">
          <div>⚡ Hóa đơn: <b>${nfLead.format(l.billTotal || 0)} đ/tháng</b> (${nfLead.format(l.kwhUsed || 0)} kWh)</div>
          <div>🔋 Pin lưu trữ cần: <b>${Number(l.batNeededKwh || 0).toFixed(1)} kWh</b> (${l.modulesCount || 0} × ${l.moduleKwh || 5.12} kWh · tối ${l.evePct || 70}%)</div>
        </div>
        ${c ? `<div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:7px 9px;font-size:12px;color:#9A3412">
          <div style="font-weight:800;margin-bottom:2px">★ Combo đã chọn: ${escapeAttr(c.title || '')} ${c.badge ? '(' + escapeAttr(c.badge) + ')' : ''}</div>
          ${c.inverterName ? `<div>• Inverter: ${escapeAttr(c.inverterName)}</div>` : ''}
          ${c.panelSummary ? `<div>• Tấm pin: ${escapeAttr(c.panelSummary)}</div>` : ''}
          ${c.batterySummary ? `<div>• Pin lưu trữ: ${escapeAttr(c.batterySummary)}</div>` : ''}
          ${c.accessoriesSummary ? `<div style="font-size:11px;color:#7C2D12">• Phụ kiện: ${escapeAttr(c.accessoriesSummary)}</div>` : ''}
        </div>` : '<div style="font-size:11.5px;color:#94A3B8;font-style:italic">Khách chưa bấm chọn Combo cụ thể.</div>'}
        <div style="display:grid;grid-template-columns:130px 1fr;gap:6px;align-items:center">
          <select class="f-input" data-l-status="${escapeAttr(l.id)}" style="font-weight:700;color:${stColor}">
            <option value="new" ${st === 'new' ? 'selected' : ''}>🆕 Mới</option>
            <option value="contacted" ${st === 'contacted' ? 'selected' : ''}>📞 Đã liên hệ</option>
            <option value="quoted" ${st === 'quoted' ? 'selected' : ''}>📋 Đã báo giá</option>
            <option value="closed" ${st === 'closed' ? 'selected' : ''}>✅ Đã chốt</option>
            <option value="cancelled" ${st === 'cancelled' ? 'selected' : ''}>❌ Hủy</option>
          </select>
          <input type="text" class="f-input" data-l-note="${escapeAttr(l.id)}" value="${escapeAttr(l.adminNote || '')}" placeholder="Ghi chú chăm sóc khách...">
        </div>
      </div>`;
    }).join('') || '<p class="hint">Chưa có dữ liệu khách hàng nào. Khi khách nhập thông tin hoặc chọn Combo ngoài trang chủ, hệ thống sẽ tự lưu tại đây.</p>';

    el.querySelectorAll('[data-l-status]').forEach(sel => sel.onchange = async () => {
      const id = sel.dataset.lStatus;
      const status = sel.value;
      const item = LEADS.find(x => x.id === id);
      if (item) item.status = status;
      try {
        await api('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, status }) });
        renderLeadsList();
        toast('Đã cập nhật trạng thái khách hàng.');
      } catch (err) { toast(err.message); }
    });

    el.querySelectorAll('[data-l-note]').forEach(inp => inp.onchange = async () => {
      const id = inp.dataset.lNote;
      const adminNote = inp.value;
      const item = LEADS.find(x => x.id === id);
      if (item) item.adminNote = adminNote;
      try {
        await api('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, adminNote }) });
        toast('Đã lưu ghi chú khách hàng.');
      } catch (err) { toast(err.message); }
    });

    el.querySelectorAll('[data-l-del]').forEach(btn => btn.onclick = async () => {
      if (!confirm('Xóa bản ghi khách hàng này?')) return;
      try {
        const res = await api('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ id: btn.dataset.lDel }) });
        LEADS = res.leads || [];
        renderLeadsList();
        toast('Đã xóa dữ liệu khách hàng.');
      } catch (err) { toast(err.message); }
    });
  }

  if ($('leadSearch')) $('leadSearch').addEventListener('input', e => { leadSearchQ = e.target.value; renderLeadsList(); });
  if ($('leadStatusFilter')) $('leadStatusFilter').addEventListener('change', e => { leadStatusFilter = e.target.value; renderLeadsList(); });
  if ($('btnRefreshLeads')) {
    $('btnRefreshLeads').onclick = async () => {
      try {
        const res = await api('/api/admin/leads');
        LEADS = Array.isArray(res.leads) ? res.leads : [];
        renderLeadsList();
        toast(`Đã làm mới (${LEADS.length} khách hàng).`);
      } catch (err) { toast(err.message); }
    };
  }
  if ($('btnExportLeads')) {
    $('btnExportLeads').onclick = async () => {
      try {
        const headers = {};
        if (AUTH_TOKEN) headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
        const resp = await fetch('/api/admin/leads/export.csv', { credentials: 'include', headers });
        if (!resp.ok) throw new Error('Không thể xuất CSV.');
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `khach-hang-tu-van-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      } catch (err) { toast(err.message); }
    };
  }
