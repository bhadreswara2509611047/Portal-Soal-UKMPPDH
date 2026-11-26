/* Stabilitas, penyeragaman tema seluruh paket, konfirmasi keluar, tombol Back HP,
 * perbaikan header di layar sempit, dan pendaftaran cache offline. */
(function () {
  'use strict';

  const START = ['startSimulation', 'startNewSimulation', 'startNewSession', 'startQuiz', 'startSession', 'resumeSavedSession'];
  const STOP = ['finishExam', 'finishSimulation', 'finishQuiz', 'finalizeExam',
    'goToSetup', 'backToSetup', 'backToLobby', 'goHomeFromResult', 'goToMenu', 'goToHome', 'resetToHome', 'resetToSetup', 'backToHome'];

  const UNIFIED_THEME_CSS = `
    :root {
      --pt-bg: #f8fafc;
      --pt-surface: #ffffff;
      --pt-subtle: #f1f5f9;
      --pt-border: #e2e8f0;
      --pt-text: #0f172a;
      --pt-text-sub: #475569;
      --pt-primary: #0f766e;
      --pt-primary-hover: #115e59;
      --pt-primary-soft: #f0fdfa;
      --pt-primary-border: #99f6e4;
    }

    html.dark {
      color-scheme: dark;
      --pt-bg: #09090b;
      --pt-surface: #121215;
      --pt-subtle: #18181b;
      --pt-border: #27272a;
      --pt-text: #f4f4f5;
      --pt-text-sub: #a1a1aa;
      --pt-primary: #14b8a6;
      --pt-primary-hover: #0d9488;
      --pt-primary-soft: rgba(20, 184, 166, 0.14);
      --pt-primary-border: rgba(20, 184, 166, 0.35);
    }

    html, body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
      background-color: var(--pt-bg) !important;
      color: var(--pt-text) !important;
    }

    /* Header Seragam untuk Semua Paket */
    body > header,
    #app > header,
    div > header.sticky,
    header {
      background: linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #0f766e 100%) !important;
      color: #ffffff !important;
      border-bottom: 2px solid #14b8a6 !important;
    }

    header h1, header h2, header h3,
    header .text-slate-900, header .text-slate-800, header .text-slate-700 {
      color: #ffffff !important;
    }

    header .text-slate-600, header .text-slate-500, header .text-slate-400 {
      color: #cbd5e1 !important;
    }

    header .bg-slate-100, header .bg-blue-100, header .bg-emerald-100,
    header [class*="bg-[#f0f6fb]"], header #timer-box {
      background-color: rgba(255, 255, 255, 0.14) !important;
      border-color: rgba(255, 255, 255, 0.24) !important;
      color: #ffffff !important;
    }

    header .text-blue-700, header .text-blue-600, header .text-emerald-800,
    header .text-vet-700, header [class*="text-[#0f4c81]"] {
      color: #99f6e4 !important;
    }

    /* Permukaan kartu, kontainer, dan modal */
    main .bg-white, aside .bg-white, section .bg-white,
    [class*="bg-white/95"], .bg-slate-50, .bg-slate-100,
    [class*="bg-[#f8fafc]"], [class*="bg-[#f1f5f9]"], [class*="bg-[#f4f7"] {
      background-color: var(--pt-surface) !important;
      color: var(--pt-text) !important;
      border-color: var(--pt-border) !important;
    }

    body.bg-slate-50, body.bg-slate-100, body[class*="bg-[#f8fafc]"] {
      background-color: var(--pt-bg) !important;
    }

    /* Penyeragaman tombol & aksen primer lintas paket */
    .bg-blue-600, .bg-blue-700, .bg-blue-800, .bg-blue-900,
    .bg-indigo-600, .bg-indigo-700, .bg-indigo-800,
    .bg-sky-600, .bg-sky-700,
    .bg-teal-600, .bg-teal-700, .bg-teal-800,
    [class*="bg-[#1e3a8a]"], [class*="bg-[#2563eb]"],
    [class*="bg-[#881337]"], [class*="bg-[#9f1239]"],
    [class*="bg-[#0f5c54]"], [class*="bg-[#134e4a]"],
    [class*="bg-[#0f2942]"], [class*="bg-[#0f4c81]"],
    [class*="bg-navy-9"], [class*="bg-navy-8"],
    [class*="bg-undana-"], [class*="bg-unud-"],
    [class*="bg-vet-6"], [class*="bg-vet-7"], [class*="bg-vet-8"],
    [class*="bg-vetnavy-"], [class*="bg-sigap-primary"],
    [class*="bg-academic-"], [class*="bg-ipb-navy"], [class*="bg-ipb-royal"],
    [class*="bg-udayana-blue"], [class*="bg-udayana-royal"],
    [class*="bg-unhas-"] {
      background-color: var(--pt-primary) !important;
      border-color: var(--pt-primary) !important;
      color: #ffffff !important;
    }

    .hover\:bg-blue-700:hover, .hover\:bg-blue-900:hover,
    .hover\:bg-indigo-700:hover, .hover\:bg-sky-700:hover,
    .hover\:bg-teal-700:hover, .hover\:bg-teal-800:hover,
    [class*="hover:bg-[#2563eb]"]:hover, [class*="hover:bg-[#be123c]"]:hover,
    [class*="hover:bg-vet-7"]:hover, [class*="hover:bg-undana-9"]:hover,
    [class*="hover:bg-navy-8"]:hover, [class*="hover:bg-unud-"]:hover {
      background-color: var(--pt-primary-hover) !important;
    }

    .text-blue-600, .text-blue-700, .text-blue-800,
    .text-indigo-600, .text-indigo-700,
    .text-sky-600, .text-sky-700,
    .text-teal-600, .text-teal-700, .text-teal-800,
    [class*="text-[#1e3a8a]"], [class*="text-[#881337]"],
    [class*="text-[#0f4c81]"], [class*="text-[#0f5c54]"],
    [class*="text-vet-6"], [class*="text-vet-7"],
    [class*="text-unud-"], [class*="text-undana-"],
    [class*="text-ipb-"], [class*="text-udayana-"],
    [class*="text-academic-"], [class*="text-unhas-"] {
      color: var(--pt-primary) !important;
    }

    .bg-blue-50, .bg-indigo-50, .bg-sky-50, .bg-teal-50, .bg-rose-50,
    [class*="bg-blue-50/"], [class*="bg-teal-50/"],
    [class*="bg-[#f0f6fb]"], [class*="bg-[#e6f4f"] {
      background-color: var(--pt-primary-soft) !important;
      border-color: var(--pt-primary-border) !important;
    }

    .border-blue-500, .border-blue-600, .border-blue-700,
    .border-indigo-500, .border-indigo-600,
    .border-sky-500, .border-teal-500, .border-teal-600,
    [class*="border-[#2563eb]"], [class*="border-[#9f1239]"],
    [class*="border-[#0f5c54]"], [class*="border-navy-9"],
    [class*="border-undana-8"], [class*="border-unud-"],
    [class*="border-vet-6"], [class*="border-ipb-"] {
      border-color: var(--pt-primary) !important;
    }

    /* Mode Gelap (Dark Mode) untuk Konten & Teks Soal */
    html.dark .text-slate-900, html.dark .text-slate-800, html.dark .text-slate-700,
    html.dark .text-gray-900, html.dark .text-gray-800,
    html.dark [class*="text-[#0f172a]"], html.dark [class*="text-[#1e293b]"] {
      color: var(--pt-text) !important;
    }

    html.dark .text-slate-600, html.dark .text-slate-500,
    html.dark .text-gray-600, html.dark .text-gray-500 {
      color: var(--pt-text-sub) !important;
    }

    html.dark .border-slate-200, html.dark .border-slate-300, html.dark .border-gray-200 {
      border-color: var(--pt-border) !important;
    }
`;

  function applyUnifiedThemeToHtml(html, options) {
    const opts = options || {};
    let out = String(html || '');
    const isDark = !opts.forceLight && typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    // Bersihkan injeksi tema lama jika file pernah di-upload sebelumnya
    out = out.replace(/<style id="portal-unified-theme">[\s\S]*?<\/style>\s*/gi, '');

    // Pastikan font Inter tersedia di semua paket
    if (!/fonts\.googleapis\.com\/css2\?family=Inter/i.test(out) && /<\/head>/i.test(out)) {
      out = out.replace(
        /<\/head>/i,
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" media="print" onload="this.media=\'all\'">\n</head>'
      );
    }

    // Sinkronkan atribut class="dark" pada <html> paket
    if (/<html\b[^>]*>/i.test(out)) {
      out = out.replace(/<html\b([^>]*)>/i, (match, attrs) => {
        const cleanedAttrs = attrs.replace(/\sclass\s*=\s*(["'])(.*?)\1/i, (m, q, cls) => {
          const filtered = cls.split(/\s+/).filter((c) => c && c !== 'dark').join(' ');
          return filtered ? ` class=${q}${filtered}${q}` : '';
        });
        if (!isDark) return `<html${cleanedAttrs}>`;
        if (/class\s*=/i.test(cleanedAttrs)) {
          return `<html${cleanedAttrs.replace(/class\s*=\s*(["'])(.*?)\1/i, 'class=$1$2 dark$1')}>`;
        }
        return `<html${cleanedAttrs} class="dark">`;
      });
    }

    const styleTag = `<style id="portal-unified-theme">${UNIFIED_THEME_CSS}</style>`;
    if (/<\/head>/i.test(out)) {
      out = out.replace(/<\/head>/i, `${styleTag}\n</head>`);
    } else {
      out = `${styleTag}\n${out}`;
    }
    return out;
  }

  window.PortalTheme = {
    css: UNIFIED_THEME_CSS,
    applyToHtml: applyUnifiedThemeToHtml,
    syncFrame(frame) {
      if (!frame || !frame.contentDocument) return;
      const isDark = document.documentElement.classList.contains('dark');
      frame.style.filter = '';
      frame.contentDocument.documentElement.classList.toggle('dark', isDark);
    }
  };

  const FRAME_CSS = `
    html, body { overscroll-behavior-y: contain; }
    button, label, select { touch-action: manipulation; }
    @media (max-width: 639px) {
      header.sticky > div.h-16 { height: auto !important; flex-wrap: wrap; row-gap: 6px; padding-top: 8px; padding-bottom: 8px; }
      header.sticky > div.h-16 > div:first-child { flex: 1 1 100%; }
      header.sticky > div.h-16 > div:last-child { flex: 1 1 100%; justify-content: flex-end; }
      input, select, textarea { font-size: 16px !important; }
    }
    @media (max-width: 360px) {
      header div.flex.items-center.gap-2 { flex-wrap: wrap; }
      #cbt-timer-wrapper + button, div:has(> #cbt-timer-wrapper) { flex-wrap: wrap; }
    }`;

  let teardown = null;
  let inProgress = false;
  let canResume = false;
  let ignorePop = false;

  function confirmLeave() {
    if (!teardown || !inProgress) return true;
    return confirm(canResume
      ? 'Ujian belum selesai. Progres tersimpan dan bisa dilanjutkan nanti. Keluar sekarang?'
      : 'Ujian belum selesai. Paket ini TIDAK menyimpan progres, jawaban akan hilang. Tetap keluar?');
  }

  function pushEntry() {
    if (!(history.state && history.state.exam)) history.pushState({ exam: true }, '');
  }

  function close() {
    if (window.PortalProgress) window.PortalProgress.flush();
    const fn = teardown;
    teardown = null;
    inProgress = false;
    if (fn) fn();
  }

  window.addEventListener('popstate', () => {
    if (ignorePop) {
      ignorePop = false;
      if (teardown) pushEntry();
      return;
    }
    if (!teardown) return;
    if (confirmLeave()) close();
    else pushEntry();
  });

  window.addEventListener('beforeunload', (e) => {
    if (teardown && inProgress) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  if (history.state && history.state.exam) history.replaceState(null, '');

  function fixTimers(win) {
    const rawSet = win.setInterval;
    const rawClear = win.clearInterval;
    const cleared = new Set();

    win.clearInterval = function (id) {
      cleared.add(id);
      return rawClear.call(win, id);
    };

    win.setInterval = function (fn, ms) {
      if (typeof fn !== 'function' || !(ms >= 900 && ms <= 1100)) return rawSet.apply(win, arguments);
      const extra = Array.prototype.slice.call(arguments, 2);
      const startedAt = Date.now();
      let delivered = 0;
      let id;

      const tick = () => {
        if (cleared.has(id)) return;
        const due = Math.floor((Date.now() - startedAt) / 1000 + 0.1);
        let missing = Math.min(due - delivered, 6 * 3600);
        while (missing-- > 0 && !cleared.has(id)) {
          delivered++;
          fn.apply(win, extra);
        }
      };
      const onVisible = () => { if (!win.document.hidden) tick(); };
      win.document.addEventListener('visibilitychange', onVisible);
      id = rawSet.call(win, () => {
        tick();
        if (cleared.has(id)) win.document.removeEventListener('visibilitychange', onVisible);
      }, ms);
      return id;
    };
  }

  window.PortalRuntime = {
    confirmLeave,

    enter(onClose) {
      teardown = onClose;
      inProgress = false;
      if (!ignorePop) pushEntry();
    },

    requestClose() {
      if (!confirmLeave()) return;
      close();
      if (history.state && history.state.exam) {
        ignorePop = true;
        history.back();
      }
    },

    reset: close,

    freshFrame(frame) {
      const next = frame.cloneNode(false);
      next.removeAttribute('src');
      next.removeAttribute('srcdoc');
      frame.replaceWith(next);
      return next;
    },

    prepareHtml(html) {
      const nonBlockingFont = String(html || '').replace(
        /<link(?![^>]*\bmedia=)([^>]*fonts\.googleapis\.com\/css2[^>]*?)\s*\/?>/g,
        '<link$1 media="print" onload="this.media=\'all\'">'
      );
      return applyUnifiedThemeToHtml(nonBlockingFont);
    },

    enhance(frame) {
      if (window.PortalTheme) window.PortalTheme.syncFrame(frame);
      if (window.syncExamTheme) window.syncExamTheme();
      try {
        const win = frame.contentWindow;
        const style = win.document.createElement('style');
        style.textContent = FRAME_CSS;
        win.document.head.appendChild(style);
        canResume = typeof win.resumeSavedSession === 'function' || typeof win.loadSavedProgress === 'function' ||
          !!win.__portalGenericResume;
        fixTimers(win);
        const track = (names, value) => names.forEach((name) => {
          const fn = win[name];
          if (typeof fn !== 'function') return;
          win[name] = function () {
            const result = fn.apply(this, arguments);
            inProgress = value;
            return result;
          };
        });
        track(START, true);
        track(STOP, false);
      } catch (e) {
        console.error('Penyesuaian paket gagal:', e);
      }
    }
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
