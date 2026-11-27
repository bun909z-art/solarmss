(function () {
  'use strict';

  const preview = new URLSearchParams(location.search).get('preview') === '1';
  const maintenancePage = document.body.hasAttribute('data-maintenance-page');

  function watch(render, onError = () => {}) {
    let signature;
    let loading = false;
    let pending = false;
    let timer;

    function queue(delay = 65) {
      pending = true;
      if (loading) return;
      clearTimeout(timer);
      timer = setTimeout(refresh, delay);
    }

    async function refresh() {
      loading = true;
      pending = false;
      let retry = false;
      try {
        const response = await fetch('/api/config', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const { config } = await response.json();
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Cấu hình không hợp lệ.');
        const nextSignature = JSON.stringify(config);
        if (nextSignature === signature) return;
        if (!preview && maintenancePage !== Boolean(config.maintenance?.enabled)) {
          location.reload();
          return;
        }
        render(config);
        signature = nextSignature;
      } catch (error) {
        retry = !preview;
        onError();
        console.error('Không thể cập nhật cấu hình:', error);
      } finally {
        loading = false;
        if (pending || retry) queue(pending ? 65 : 5000);
      }
    }

    queue(0);
    if (preview) return;

    const stream = typeof EventSource === 'function' ? new EventSource('/api/live') : null;
    stream?.addEventListener('open', () => queue());
    stream?.addEventListener('update', event => { if (event.data === 'config') queue(); });
    setInterval(() => { if (!stream || stream.readyState !== EventSource.OPEN) queue(); }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) queue(); });
    window.addEventListener('pageshow', event => { if (event.persisted) queue(); });
  }

  window.HQLive = { watch };
  if (maintenancePage) watch(() => {});
})();
