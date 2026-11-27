(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value || '').replace(/[&<>"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  })[char]);

  window.renderSiteContact = function (footer, visible = true) {
    const address = String(footer.ctaAddress || '').trim();
    const contacts = Array.isArray(footer.salesContacts) ? footer.salesContacts : [];
    const callLabel = escapeHtml(footer.callBtnText || 'Gọi ngay');
    const zaloLabel = escapeHtml(footer.zaloBtnText || 'Chat Zalo');
    const rows = contacts.map(contact => {
      const number = String(contact?.number || '').trim();
      const tel = String(contact?.tel || number).replace(/[^\d+]/g, '');
      if (!number || !/\d/.test(tel)) return '';
      const zalo = String(contact.zalo ?? tel).replace(/\D/g, '');
      return `<li class="cta-row">
        <div class="cta-info">
          ${contact.label ? `<span class="cta-role">${escapeHtml(contact.label)}</span>` : ''}
          <a class="cta-phone" href="tel:${tel}">${escapeHtml(number)}</a>
        </div>
        <div class="cta-btns">
          <a class="cta-btn call" href="tel:${tel}">📞 ${callLabel}</a>
          ${zalo ? `<a class="cta-btn zalo" href="https://zalo.me/${zalo}" target="_blank" rel="noopener">💬 ${zaloLabel}</a>` : ''}
        </div>
      </li>`;
    }).join('');

    $('contactCtaCard').hidden = !visible || (!rows && !address);
    $('ctaTitle').textContent = footer.ctaTitle || 'Liên hệ ngay để được tư vấn & khảo sát miễn phí';
    $('ctaSubtitle').textContent = footer.ctaSubtitle || '';
    $('ctaSubtitle').hidden = !rows || !footer.ctaSubtitle;
    $('ctaAddress').hidden = !address;
    $('ctaAddress').textContent = address ? '📍 ' + address : '';
    $('ctaList').hidden = !rows;
    $('ctaList').innerHTML = rows;
  };
})();
