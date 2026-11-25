/* Admin System UI: Phân quyền Tài khoản người dùng, Bảo trì 404/1-trang & Sao lưu toàn bộ */
'use strict';

// ---------- RBAC PERMISSIONS & USER MANAGEMENT ----------
  function applyPermissionsUI() {
    const isSuper = !CURRENT_USER || CURRENT_USER.role === 'admin';
    const perms = isSuper ? PERM_LABELS.map(x => x[0]) : (CURRENT_USER.permissions || []);
    if ($('currentUserBadge')) {
      const label = CURRENT_USER ? `${CURRENT_USER.displayName || CURRENT_USER.username} (${isSuper ? 'Admin' : 'Nhân viên'})` : 'Admin';
      $('currentUserBadge').textContent = '👤 ' + label;
    }
    if ($('tabBtnUsers')) $('tabBtnUsers').hidden = !isSuper;
    const canSaveConfig = isSuper || ['branding', 'home', 'theme', 'layout', 'tariffs', 'footer'].some(p => perms.includes(p));
    if ($('btnSave')) $('btnSave').hidden = !canSaveConfig;
    if ($('btnReset')) $('btnReset').hidden = !canSaveConfig;

    let firstVisible = null;
    document.querySelectorAll('.adm-tabs .tab-btn[data-tab]').forEach(btn => {
      const tab = btn.dataset.tab;
      const allowed = tab === 'users' ? isSuper : (tab === 'security' ? true : (isSuper || perms.includes(tab)));
      btn.hidden = !allowed;
      if (allowed && !firstVisible) firstVisible = btn;
    });
    const activeBtn = document.querySelector('.adm-tabs .tab-btn[data-tab].active');
    if ((!activeBtn || activeBtn.hidden) && firstVisible) firstVisible.click();

    renderNewUserPerms();
    if (isSuper) renderUsersList();
  }

  function renderNewUserPerms() {
    const grid = $('nuPermsGrid');
    if (!grid) return;
    grid.innerHTML = PERM_LABELS.map(([k, lbl]) => `
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;cursor:pointer">
        <input type="checkbox" data-nu-perm="${k}" ${['products', 'news', 'leads'].includes(k) ? 'checked' : ''}>
        <span>${lbl}</span>
      </label>
    `).join('');
    if ($('nu_role')) {
      $('nu_role').onchange = () => {
        if ($('nuPermsWrap')) $('nuPermsWrap').hidden = $('nu_role').value === 'admin';
      };
    }
  }

  function renderUsersList() {
    const el = $('usersListEditor');
    if (!el) return;
    if ($('usersCount')) $('usersCount').textContent = USERS.length;
    el.innerHTML = USERS.map(u => {
      const isRoot = Boolean(u.protected || u.username === 'admin');
      const isAdm = u.role === 'admin';
      return `<div class="list-item" style="flex-direction:column;align-items:stretch;gap:7px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
          <div>
            <div style="font-weight:800;font-size:13.5px">${escapeAttr(u.displayName || u.username)} <span style="font-weight:600;color:#64748B">(@${escapeAttr(u.username)})</span></div>
            <div style="font-size:11.5px;font-weight:700;color:${isAdm ? '#EA580C' : '#0369A1'}">${isAdm ? '👑 Admin (Full tính năng)' : '👤 Nhân viên phân quyền'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${!isRoot ? `<label style="font-size:11.5px;font-weight:700;display:flex;align-items:center;gap:4px"><input type="checkbox" data-u-act="${escapeAttr(u.username)}" ${u.active !== false ? 'checked' : ''}> Hoạt động</label>` : '<span style="font-size:11px;font-weight:800;color:#047857;background:#ECFDF5;padding:2px 8px;border-radius:99px">Gốc</span>'}
            ${!isRoot ? `<button type="button" class="del-btn" data-u-del="${escapeAttr(u.username)}" title="Xóa tài khoản">×</button>` : ''}
          </div>
        </div>
        ${!isRoot ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <select class="f-input" data-u-role="${escapeAttr(u.username)}">
            <option value="staff" ${!isAdm ? 'selected' : ''}>Nhân viên (phân quyền)</option>
            <option value="admin" ${isAdm ? 'selected' : ''}>Admin (Full tính năng)</option>
          </select>
          <input type="password" class="f-input" data-u-newpass="${escapeAttr(u.username)}" placeholder="Đặt lại mật khẩu mới...">
        </div>
        ${!isAdm ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:8px">
          ${PERM_LABELS.map(([k, lbl]) => `<label style="display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;cursor:pointer"><input type="checkbox" data-u-perm="${escapeAttr(u.username)}:${k}" ${(u.permissions || []).includes(k) ? 'checked' : ''}><span>${lbl}</span></label>`).join('')}
        </div>` : ''}
        <button type="button" class="btn-ghost small" data-u-save="${escapeAttr(u.username)}">💾 Lưu phân quyền / mật khẩu</button>
        ` : ''}
      </div>`;
    }).join('');

    el.querySelectorAll('[data-u-save]').forEach(btn => btn.onclick = async () => {
      const uname = btn.dataset.uSave;
      const roleEl = el.querySelector(`[data-u-role="${uname}"]`);
      const actEl = el.querySelector(`[data-u-act="${uname}"]`);
      const passEl = el.querySelector(`[data-u-newpass="${uname}"]`);
      const perms = Array.from(el.querySelectorAll(`[data-u-perm^="${uname}:"]`)).filter(c => c.checked).map(c => c.dataset.uPerm.split(':')[1]);
      try {
        await api('/api/admin/users', {
          method: 'PUT',
          body: JSON.stringify({
            username: uname,
            role: roleEl ? roleEl.value : 'staff',
            active: actEl ? actEl.checked : true,
            permissions: perms,
            newPassword: passEl && passEl.value.trim() ? passEl.value.trim() : undefined
          })
        });
        const res = await api('/api/admin/users');
        USERS = res.users || [];
        renderUsersList();
        toast(`Đã cập nhật tài khoản @${uname}!`);
      } catch (err) { toast(err.message); }
    });

    el.querySelectorAll('[data-u-del]').forEach(btn => btn.onclick = async () => {
      const uname = btn.dataset.uDel;
      if (!confirm(`Xóa tài khoản @${uname}?`)) return;
      try {
        await api('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ username: uname }) });
        const res = await api('/api/admin/users');
        USERS = res.users || [];
        renderUsersList();
        toast(`Đã xóa tài khoản @${uname}.`);
      } catch (err) { toast(err.message); }
    });
  }

  if ($('btnCreateUser')) {
    $('btnCreateUser').onclick = async () => {
      const username = $('nu_username').value.trim();
      const displayName = $('nu_display').value.trim();
      const password = $('nu_password').value;
      const role = $('nu_role').value;
      const permissions = Array.from(document.querySelectorAll('[data-nu-perm]')).filter(c => c.checked).map(c => c.dataset.nuPerm);
      try {
        await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ username, displayName, password, role, permissions }) });
        $('nu_username').value = ''; $('nu_display').value = ''; $('nu_password').value = '';
        const res = await api('/api/admin/users');
        USERS = res.users || [];
        renderUsersList();
        toast(`Đã tạo tài khoản @${username} thành công!`);
      } catch (err) { toast(err.message); }
    };
  }

  
  // ---------- MAINTENANCE & FULL BACKUP ----------
  function updateMaintUI() {
    if (!CONFIG) return;
    const mt = CONFIG.maintenance || { enabled: false, mode: 'error404', allowedRoute: '/tuvan' };
    const isAllow = ($('m_mode') ? $('m_mode').value : mt.mode) === 'allow_page';
    if ($('mAllowedWrap')) $('mAllowedWrap').hidden = !isAllow;
    if ($('maintStatusBox')) {
      if (mt.enabled) {
        const routeLbl = { '/': 'Trang chủ', '/tuvan': 'Tư vấn', '/products': 'Sản phẩm', '/news': 'Tin tức' }[mt.allowedRoute] || mt.allowedRoute;
        $('maintStatusBox').style.background = '#FEF2F2';
        $('maintStatusBox').style.color = '#B91C1C';
        $('maintStatusBox').style.borderColor = '#FECACA';
        $('maintStatusBox').textContent = mt.mode === 'allow_page'
          ? `🔴 ĐANG BẢO TRÌ — Chỉ cho phép vào: ${routeLbl} (${mt.allowedRoute})`
          : '🔴 ĐANG BẢO TRÌ — Toàn bộ trang khách đang báo 404 Error';
      } else {
        $('maintStatusBox').style.background = '#ECFDF5';
        $('maintStatusBox').style.color = '#047857';
        $('maintStatusBox').style.borderColor = '#A7F3D0';
        $('maintStatusBox').textContent = '🟢 Website đang hoạt động bình thường';
      }
    }
    if ($('btnToggleMaint')) {
      $('btnToggleMaint').textContent = mt.enabled ? '✅ Tắt bảo trì (Mở lại web)' : '🔧 Bật bảo trì ngay';
      $('btnToggleMaint').style.background = mt.enabled ? '#059669' : '';
    }
  }

  async function saveMaintState(enabledVal) {
    const payload = {
      enabled: enabledVal,
      mode: $('m_mode') ? $('m_mode').value : 'error404',
      allowedRoute: $('m_allowedRoute') ? $('m_allowedRoute').value : '/tuvan',
      title: '404 — Hệ thống đang bảo trì',
      message: 'Website đang được nâng cấp và bảo trì định kỳ. Quý khách vui lòng quay lại sau ít phút hoặc liên hệ hotline bên dưới để được hỗ trợ ngay.'
    };
    try {
      const res = await api('/api/admin/maintenance', { method: 'PUT', body: JSON.stringify(payload) });
      CONFIG = res.config;
      updateMaintUI();
      toast(payload.enabled ? 'Đã BẬT chế độ bảo trì ngay lập tức!' : 'Đã TẮT chế độ bảo trì — website hoạt động lại bình thường!');
    } catch (err) { toast(err.message); }
  }

  if ($('m_mode')) $('m_mode').onchange = updateMaintUI;
  if ($('btnToggleMaint')) {
    $('btnToggleMaint').onclick = () => {
      const cur = Boolean(CONFIG && CONFIG.maintenance && CONFIG.maintenance.enabled);
      saveMaintState(!cur);
    };
  }
  if ($('btnSaveMaint')) {
    $('btnSaveMaint').onclick = () => {
      const cur = Boolean(CONFIG && CONFIG.maintenance && CONFIG.maintenance.enabled);
      saveMaintState(cur);
    };
  }
  if ($('btnFullBackup')) {
    $('btnFullBackup').onclick = async () => {
      try {
        const headers = {};
        if (AUTH_TOKEN) headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
        const resp = await fetch('/api/admin/backup-full', { credentials: 'include', headers });
        if (!resp.ok) throw new Error('Không thể tải bản sao lưu toàn bộ.');
        const blob = await resp.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `hoangquan-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        toast('Đã tải xuống bản sao lưu toàn bộ dữ liệu!');
      } catch (err) { toast(err.message); }
    };
  }
  if ($('fullRestoreFile')) {
    $('fullRestoreFile').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const parsed = JSON.parse(rd.result);
          const res = await api('/api/admin/restore-full', { method: 'POST', body: JSON.stringify(parsed) });
          await initAdmin();
          toast(`Đã khôi phục toàn bộ (${res.productsCount} SP, ${res.newsCount} tin tức, ${res.leadsCount} khách hàng)!`);
        } catch (err) { toast(err.message || 'Tệp sao lưu JSON không hợp lệ.'); }
        e.target.value = '';
      };
      rd.readAsText(f, 'utf-8');
    });
  }
