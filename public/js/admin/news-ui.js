/* Admin News UI: Quản lý bài viết Tin tức & cờ Nổi bật Trang chủ */
'use strict';

// ---------- NEWS MANAGER ----------
  function renderNewsList() {
    const el = $('newsListEditor');
    if (!el) return;
    if ($('newsCount')) $('newsCount').textContent = NEWS.length;
    el.innerHTML = NEWS.map((a, idx) => `
      <div class="list-item" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <img src="${escapeAttr(a.imageUrl || '/assets/prod-panel.jpg')}" alt="" style="width:42px;height:32px;border-radius:6px;object-fit:cover;border:1px solid #E2E8F0;flex:none">
          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;flex:1;min-width:0">
            <input type="checkbox" data-n-pub="${idx}" ${a.published !== false ? 'checked' : ''} title="Hiển thị trên trang khách">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeAttr(a.title)}</span>
          </label>
          <label class="btn-ghost small" style="padding:4px 7px;font-size:11px;cursor:pointer;white-space:nowrap">
            Đổi ảnh<input type="file" accept="image/*" data-n-img="${idx}" hidden>
          </label>
          <button type="button" class="del-btn" data-n-del="${idx}" title="Xóa bài">×</button>
        </div>
        <input type="text" class="f-input" data-n-title="${idx}" value="${escapeAttr(a.title)}" placeholder="Tiêu đề bài viết">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <select class="f-input" data-n-cat="${idx}">
            ${['Kiến thức Hybrid', 'Dự án thực tế', 'Tin ngành điện', 'Khuyến mãi'].map(c => `<option value="${c}" ${a.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          <input type="date" class="f-input" data-n-date="${idx}" value="${escapeAttr(a.publishedAt || '')}">
        </div>
        <input type="text" class="f-input" data-n-author="${idx}" value="${escapeAttr(a.author || '')}" placeholder="Tác giả">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#B45309"><input type="checkbox" data-n-feat="${idx}" ${a.featured !== false ? 'checked' : ''}> ⭐ Nổi bật Trang chủ (trượt ngang)</label>
        <textarea class="f-input" rows="2" data-n-sum="${idx}" placeholder="Mô tả ngắn...">${escapeAttr(a.summary || '')}</textarea>
        <textarea class="f-input" rows="4" data-n-content="${idx}" placeholder="Nội dung bài viết đầy đủ...">${escapeAttr(a.content || '')}</textarea>
      </div>
    `).join('') || '<p class="hint">Chưa có bài viết tin tức nào.</p>';

    el.querySelectorAll('[data-n-pub]').forEach(cb => cb.onchange = () => { NEWS[+cb.dataset.nPub].published = cb.checked; });
    el.querySelectorAll('[data-n-feat]').forEach(cb => cb.onchange = () => { NEWS[+cb.dataset.nFeat].featured = cb.checked; });
    el.querySelectorAll('[data-n-title]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nTitle].title = inp.value; });
    el.querySelectorAll('[data-n-cat]').forEach(sel => sel.onchange = () => { NEWS[+sel.dataset.nCat].category = sel.value; });
    el.querySelectorAll('[data-n-date]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nDate].publishedAt = inp.value; });
    el.querySelectorAll('[data-n-author]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nAuthor].author = inp.value; });
    el.querySelectorAll('[data-n-sum]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nSum].summary = inp.value; });
    el.querySelectorAll('[data-n-content]').forEach(inp => inp.oninput = () => { NEWS[+inp.dataset.nContent].content = inp.value; });
    el.querySelectorAll('[data-n-img]').forEach(inp => inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const idx = +inp.dataset.nImg;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const res = await api('/api/admin/upload-product-image', { method: 'POST', body: JSON.stringify({ dataUrl: rd.result }) });
          NEWS[idx].imageUrl = res.imageUrl;
          renderNewsList();
          toast('Đã cập nhật ảnh bìa! Bấm "Lưu danh sách tin tức" để lưu lại.');
        } catch (err) { toast(err.message); }
      };
      rd.readAsDataURL(f);
    });
    el.querySelectorAll('[data-n-del]').forEach(btn => btn.onclick = () => {
      NEWS.splice(+btn.dataset.nDel, 1);
      renderNewsList();
    });
  }

  if ($('nn_img_file')) {
    $('nn_img_file').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const res = await api('/api/admin/upload-product-image', { method: 'POST', body: JSON.stringify({ dataUrl: rd.result }) });
          newNewsImgUrl = res.imageUrl;
          toast('Đã tải ảnh bìa sẵn sàng cho bài viết mới!');
        } catch (err) { toast(err.message); }
      };
      rd.readAsDataURL(f);
    });
  }

  if ($('btnAddNews')) {
    $('btnAddNews').onclick = () => {
      const title = $('nn_title').value.trim();
      if (!title) return toast('Vui lòng nhập tiêu đề bài viết.');
      NEWS.unshift({
        id: 'news-' + Date.now(),
        title,
        category: $('nn_cat').value,
        publishedAt: $('nn_date').value || new Date().toISOString().slice(0, 10),
        author: $('nn_author').value.trim() || 'Hoàng Quân',
        imageUrl: newNewsImgUrl || '/assets/prod-panel.jpg',
        summary: $('nn_summary').value.trim(),
        content: $('nn_content').value.trim(),
        published: true,
        featured: $('nn_featured') ? $('nn_featured').checked : true
      });
      $('nn_title').value = ''; $('nn_summary').value = ''; $('nn_content').value = '';
      newNewsImgUrl = '';
      renderNewsList();
      toast('Đã thêm bài viết. Bấm "Lưu danh sách tin tức" để xuất bản lên máy chủ.');
    };
  }

  if ($('btnSaveNews')) {
    $('btnSaveNews').onclick = async () => {
      try {
        const res = await api('/api/admin/news', { method: 'PUT', body: JSON.stringify({ articles: NEWS }) });
        NEWS = res.articles;
        renderNewsList();
        toast(`Đã lưu ${NEWS.length} bài viết tin tức lên máy chủ!`);
      } catch (err) { toast(err.message); }
    };
  }

  if ($('btnResetNews')) {
    $('btnResetNews').onclick = async () => {
      try {
        const res = await api('/api/admin/news/reset', { method: 'POST' });
        NEWS = res.articles;
        renderNewsList();
        toast('Đã khôi phục các bài viết mẫu.');
      } catch (err) { toast(err.message); }
    };
  }
