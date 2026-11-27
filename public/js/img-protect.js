(function () {
  'use strict';

  const IMG_WRAP_SEL = 'img, .prod-img-wrap, .pd-img-stage, .news-cover, .article-cover-full, .fslide-img, .brand';

  function lockImages(root) {
    (root || document).querySelectorAll('img').forEach(img => {
      img.setAttribute('draggable', 'false');
    });
  }

  document.addEventListener('contextmenu', e => {
    if (e.target && e.target.closest && e.target.closest(IMG_WRAP_SEL)) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('dragstart', e => {
    if (e.target && (e.target.tagName === 'IMG' || (e.target.closest && e.target.closest(IMG_WRAP_SEL)))) {
      e.preventDefault();
    }
  }, true);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 's') {
      e.preventDefault();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => lockImages(document));
  } else {
    lockImages(document);
  }

  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType === 1) {
          if (n.tagName === 'IMG') n.setAttribute('draggable', 'false');
          else if (n.querySelectorAll) lockImages(n);
        }
      }));
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
