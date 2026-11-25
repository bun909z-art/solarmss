/* Admin Init: Điều hướng Tab, khung Xem trước & khởi tạo phiên đăng nhập */
'use strict';

// ---------- TABS & VIEWPORT ----------
  document.querySelectorAll('.adm-tabs .tab-btn').forEach(btn => {
    if (!btn.dataset.tab) return;
    btn.onclick = () => {
      document.querySelectorAll('.adm-tabs .tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      if ($('tab-' + btn.dataset.tab)) $('tab-' + btn.dataset.tab).classList.add('active');
    };
  });

  document.querySelectorAll('.vp-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.vp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('previewFrame').style.width = btn.dataset.vp;
    };
  });

  $('previewFrame').addEventListener('load', () => {
    if (CONFIG) pushPreview();
  });

  checkSession();
