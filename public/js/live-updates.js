(function () {
  'use strict';

  const fields = { config: 'config', products: 'products', news: 'articles' };
  const routes = ['/', '/tuvan', '/products', '/news'];
  const aliases = { '/home': '/', '/home.html': '/', '/index.html': '/tuvan', '/products.html': '/products', '/news.html': '/news' };
  const preview = new URLSearchParams(location.search).has('preview');

  function maintenanceState(config) {
    const maintenance = config.maintenance;
    if (!maintenance?.enabled) return null;
    if (maintenance.mode !== 'allow_page') return [];
    const allowed = maintenance.allowedRoutes?.length ? maintenance.allowedRoutes : [maintenance.allowedRoute];
    return allowed.filter(route => routes.includes(route));
  }

  function shouldReload(config) {
    const path = location.pathname.replace(/\/$/, '') || '/';
    const allowed = maintenanceState(config);
    const isMaintenancePage = document.body.hasAttribute('data-maintenance-page');
    return isMaintenancePage ? allowed === null || allowed.length > 0 : allowed && !allowed.includes(aliases[path] || path);
  }

  function updateNavigation(config) {
    const allowed = maintenanceState(config);
    document.getElementById('hqMaintCss')?.remove();
    const nav = document.querySelector('.main-nav');
    if (nav) {
      nav.querySelectorAll('a[href]').forEach(link => {
        const route = link.getAttribute('href');
        if (routes.includes(route)) link.hidden = Boolean(allowed && !allowed.includes(route));
      });
      nav.hidden = Boolean(allowed && allowed.length === 1);
    }
    document.body.classList.toggle('maint-single-page', Boolean(allowed && allowed.length === 1));
  }

  function watch(resources, render, onError = () => {}) {
    const snapshot = {};
    const signatures = {};
    const pending = new Set(resources);
    let timer;
    let loading = false;

    function queue(names, delay = 65) {
      for (const name of names) if (resources.includes(name)) pending.add(name);
      if (!loading && pending.size) {
        clearTimeout(timer);
        timer = setTimeout(refresh, delay);
      }
    }

    async function refresh() {
      loading = true;
      const batch = [...pending];
      pending.clear();
      const changed = new Set();
      const failures = [];
      try {
        await Promise.all(batch.map(async name => {
          try {
            const response = await fetch('/api/' + name, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const value = (await response.json())[fields[name]];
            if (name === 'config' ? !value || typeof value !== 'object' || Array.isArray(value) : !Array.isArray(value)) {
              throw new Error('Dữ liệu cập nhật không hợp lệ.');
            }
            const signature = JSON.stringify(value);
            if (signature !== signatures[name]) {
              snapshot[name] = value;
              signatures[name] = signature;
              changed.add(name);
            }
          } catch {
            failures.push(name);
          }
        }));
        if (failures.length) onError(failures, snapshot);
        if (!changed.size) return;
        if (!preview && changed.has('config') && shouldReload(snapshot.config)) {
          location.reload();
          return;
        }
        render(snapshot, changed);
        if (!preview && changed.has('config')) updateNavigation(snapshot.config);
      } catch (error) {
        console.error('Không thể hiển thị dữ liệu cập nhật:', error);
      } finally {
        loading = false;
        const delay = pending.size ? 65 : 5000;
        queue(preview ? [] : failures, delay);
      }
    }

    queue([], 0);
    if (preview) return;

    const stream = typeof EventSource === 'function' ? new EventSource('/api/live') : null;
    if (stream) {
      stream.addEventListener('open', () => queue(resources));
      stream.addEventListener('update', event => queue([event.data]));
    }
    setInterval(() => {
      if (!stream || stream.readyState !== EventSource.OPEN) queue(resources);
    }, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) queue(resources); });
    window.addEventListener('pageshow', event => { if (event.persisted) queue(resources); });
  }

  window.HQLive = { watch };
  if (document.body.hasAttribute('data-maintenance-page')) watch(['config'], () => {});
})();
