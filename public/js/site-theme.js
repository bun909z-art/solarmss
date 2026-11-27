(function () {
  'use strict';

  const shadows = {
    none: 'none',
    soft: '0 1px 3px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)',
    medium: '0 2px 6px rgba(15,23,42,.04), 0 12px 28px rgba(15,23,42,.07)',
    strong: '0 4px 12px rgba(15,23,42,.08), 0 20px 44px rgba(15,23,42,.14)'
  };
  const fonts = {
    system: '"Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif',
    inter: '"Inter", "Segoe UI", Roboto, system-ui, sans-serif',
    roboto: 'Roboto, "Segoe UI", Arial, sans-serif',
    segoe: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
  };

  function hex(value, fallback) {
    if (typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return fallback;
    return value.length === 4 ? '#' + [...value.slice(1)].map(c => c + c).join('') : value;
  }

  function rgb(color) {
    return color.slice(1).match(/../g).map(channel => parseInt(channel, 16));
  }

  function mix(from, to, amount) {
    const target = rgb(to);
    return '#' + rgb(from).map((channel, i) =>
      Math.round(channel + (target[i] - channel) * amount).toString(16).padStart(2, '0')
    ).join('');
  }

  function luminance(color) {
    const [r, g, b] = rgb(color).map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  }

  function contrast(foreground, background) {
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function readable(preferred, fallback, ...surfaces) {
    return surfaces.every(surface => contrast(preferred, surface) >= 4.5) ? preferred : fallback;
  }

  function rgba(color, opacity) {
    return `rgba(${rgb(color).join(',')},${opacity})`;
  }

  function resolve(cfg) {
    const t = cfg.theme || {}, b = cfg.branding || {};
    const coordinated = t.autoPalette === true;
    const bg = hex(t.bg, '#F3F5F9');
    const dark = coordinated ? contrast('#ffffff', bg) > contrast('#000000', bg) : Boolean(t.darkMode);
    const primary = hex(t.primary, '#F26A1B');
    const deep = hex(t.primaryDeep, '#D9560B');
    const variables = {
      '--primary': primary,
      '--primary-deep': deep,
      '--grad-end': hex(t.gradientEnd, '#FFB400'),
      '--primary-soft': rgba(primary, dark ? 0.18 : 0.10),
      '--primary-line': rgba(primary, dark ? 0.42 : 0.28),
      '--primary-glow': rgba(primary, dark ? 0.45 : 0.30),
      '--bg': bg,
      '--card': hex(t.cardBg, '#FFFFFF'),
      '--ink': hex(t.ink, '#111827'),
      '--ink-2': hex(t.inkMuted, '#4B5563'),
      '--day': hex(t.dayColor, '#F59E0B'),
      '--night': hex(t.nightColor, '#1E293B'),
      '--good': hex(t.accentGood, '#15803D'),
      '--radius': (Number(t.radius) || 18) + 'px',
      '--max-width': (Number(t.maxWidth) || 1160) + 'px',
      '--logo-h': (Number(b.logoHeight) || 54) + 'px',
      '--shadow': Object.hasOwn(shadows, t.shadowLevel) ? shadows[t.shadowLevel] : shadows.medium,
      '--font': Object.hasOwn(fonts, t.fontFamily) ? fonts[t.fontFamily] : fonts.system
    };

    if (coordinated) {
      const neutral = dark ? '#000000' : '#ffffff';
      const onBackground = dark ? '#ffffff' : '#000000';
      const card = mix(bg, neutral, dark ? 0.24 : 0.7);
      const surface = mix(bg, neutral, dark ? 0.12 : 0.4);
      const ink = readable(dark ? '#f6f8fb' : '#111827', onBackground, bg, card, surface);
      const muted = readable(mix(ink, bg, 0.26), ink, bg, card, surface);
      Object.assign(variables, {
        '--card': card,
        '--ink': ink,
        '--ink-2': muted,
        '--primary-deep': readable(deep, ink, bg, card, surface),
        '--primary-soft': surface,
        '--theme-surface': surface,
        '--theme-line': rgba(ink, 0.22),
        '--theme-band': mix(bg, '#0b141d', 0.82),
        '--theme-band-raised': mix(bg, '#14212d', 0.76),
        '--theme-on-primary': contrast('#ffffff', primary) >= 4.5 ? '#ffffff' : '#000000'
      });
    }

    return { variables, dark, coordinated };
  }

  function apply(cfg) {
    const { variables, dark, coordinated } = resolve(cfg);
    const style = document.documentElement.style;
    for (const [key, value] of Object.entries(variables)) style.setProperty(key, value);
    document.body.classList.toggle('dark-mode', dark);
    document.body.classList.toggle('coordinated-theme', coordinated);
    document.body.classList.toggle('show-admin-link', cfg.branding?.showAdminLink === true);
    const meta = document.getElementById('metaTheme');
    if (meta) meta.content = coordinated ? variables['--theme-band'] : variables['--primary'];
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { resolve };
  else window.SiteTheme = { apply };
})();
