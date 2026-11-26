/* Stabilitas & penyeragaman tema saat paket dikerjakan:
 * - Menyamakan header, warna, font, kartu, dan tombol mengikuti tema utama index.html
 * - Konfirmasi keluar, tombol Back HP, perbaikan timer, dan cache offline */
(function () {
  'use strict';

  const UNIFIED_THEME_CSS = `
    :root {
      --bg-app: #f8fafc;
      --bg-surface: #ffffff;
      --bg-subtle: #f1f5f9;
      --bg-hover: #e2e8f0;
      --border-color: #e2e8f0;
      --border-strong: #cbd5e1;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #64748b;
      --accent-bg: #0f172a;
      --accent-hover: #1e293b;
      --accent-text: #ffffff;
      --ring-color: rgba(15, 23, 42, 0.14);
    }

    html.dark {
      color-scheme: dark;
      --bg-app: #09090b;
      --bg-surface: #121215;
      --bg-subtle: #18181b;
      --bg-hover: #27272a;
      --border-color: #27272a;
      --border-strong: #3f3f46;
      --text-primary: #f4f4f5;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent-bg: #f4f4f5;
      --accent-hover: #e4e4e7;
      --accent-text: #09090b;
      --ring-color: rgba(244, 244, 245, 0.16);
    }

    * { -webkit-tap-highlight-color: transparent; }

    html, body {
      overscroll-behavior-y: contain;
      font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
      background-color: var(--bg-app) !important;
      color: var(--text-primary) !important;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    button, label, select { touch-action: manipulation; }

    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: var(--bg-subtle); }
    ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 999px; }

    /* ==================== PENYERAGAMAN HEADER & BANNER ==================== */
    header,
    header.sticky,
    nav.sticky,
    #screen-setup > div > div:first-child[class*="bg-gradient-"],
    #screen-result > div:first-child > div:first-child[class*="bg-gradient-"],
    [class*="bg-gradient-to-"]:not([id*="progress"]):not([class*="h-1"]):not([class*="h-1.5"]):not([class*="h-2"]),
    header[style*="background"],
    header[style*="gradient"],
    [id*="header"][style*="background"],
    [id*="banner"][style*="background"],
    [class*="header"][style*="background"],
    [class*="banner"][style*="background"],
    [class*="hero"][style*="background"],
    header[class*="bg-[#"],
    header[class*="bg-navy-"],
    header[class*="bg-undana-"],
    header[class*="bg-ipb-"],
    header[class*="bg-vet"],
    header[class*="bg-unud-"],
    header[class*="bg-slate-9"],
    header[class*="bg-blue-"],
    header[class*="bg-teal-"],
    header[class*="bg-indigo-"],
    header[class*="bg-rose-"] {
      background: var(--bg-surface) !important;
      background-color: var(--bg-surface) !important;
      background-image: none !important;
      color: var(--text-primary) !important;
      border-color: var(--border-color) !important;
      border-bottom-width: 1px !important;
      box-shadow: none !important;
    }

    /* Sembunyikan ornamen blur/glow bawaan banner */
    [class*="blur-3xl"],
    [class*="blur-2xl"] {
      display: none !important;
    }

    /* Ikon & Badge di dalam Header / Banner Setup & Hasil */
    #screen-setup > div > div:first-child .rounded-2xl,
    #screen-setup > div > div:first-child .rounded-xl,
    #screen-result > div:first-child > div:first-child .rounded-2xl,
    header .rounded-2xl,
    header .rounded-xl {
      background: var(--bg-subtle) !important;
      background-image: none !important;
      color: var(--text-primary) !important;
      border: 1px solid var(--border-color) !important;
      box-shadow: none !important;
    }

    #screen-setup > div > div:first-child .rounded-full:not([id*="status"]),
    [class*="bg-gradient-to-"] .rounded-full:not([id*="status"]),
    header .rounded-full:not([id*="status"]) {
      background-color: var(--bg-subtle) !important;
      border: 1px solid var(--border-color) !important;
      color: var(--text-secondary) !important;
    }

    header h1, header h2, header h3, header span, header div,
    [class*="bg-gradient-to-"] h1,
    [class*="bg-gradient-to-"] h2,
    [class*="bg-gradient-to-"] h3,
    header .text-white,
    [class*="bg-gradient-to-"] .text-white {
      color: var(--text-primary) !important;
    }

    header p,
    [class*="bg-gradient-to-"] p,
    header [class*="text-slate-2"],
    header [class*="text-slate-3"],
    header [class*="text-blue-1"],
    header [class*="text-blue-2"],
    header [class*="text-teal-1"],
    header [class*="text-teal-2"],
    header [class*="text-amber-2"],
    header [class*="text-amber-3"],
    [class*="bg-gradient-to-"] [class*="text-slate-2"],
    [class*="bg-gradient-to-"] [class*="text-slate-3"],
    [class*="bg-gradient-to-"] [class*="text-blue-1"],
    [class*="bg-gradient-to-"] [class*="text-blue-2"],
    [class*="bg-gradient-to-"] [class*="text-teal-1"],
    [class*="bg-gradient-to-"] [class*="text-teal-2"],
    [class*="bg-gradient-to-"] [class*="text-amber-2"],
    [class*="bg-gradient-to-"] [class*="text-amber-3"] {
      color: var(--text-secondary) !important;
    }

    /* Elemen di dalam Sticky Header Ujian */
    header button:first-child,
    header .w-9.h-9,
    header .w-10.h-10 {
      background-color: var(--accent-bg) !important;
      color: var(--accent-text) !important;
      border: 1px solid var(--border-color) !important;
    }
    header button:first-child *,
    header .w-9.h-9 *,
    header .w-10.h-10 * {
      color: var(--accent-text) !important;
    }

    header [class*="bg-white/"],
    header [id*="timer-box"],
    header [id*="timer"] {
      background-color: var(--bg-subtle) !important;
      border: 1px solid var(--border-color) !important;
      color: var(--text-primary) !important;
    }

    header [id*="timer-box"][class*="rose"],
    header [id*="timer-box"][class*="red"],
    header [id*="timer"][class*="rose"],
    header [id*="timer"][class*="red"] {
      background-color: rgba(244, 63, 94, 0.14) !important;
      border-color: rgba(244, 63, 94, 0.45) !important;
      color: #e11d48 !important;
    }
    html.dark header [id*="timer-box"][class*="rose"],
    html.dark header [id*="timer-box"][class*="red"],
    html.dark header [id*="timer"][class*="rose"],
    html.dark header [id*="timer"][class*="red"] {
      color: #fda4af !important;
    }

    header [id*="mode-badge"] {
      background-color: var(--bg-subtle) !important;
      border: 1px solid var(--border-color) !important;
      color: var(--text-primary) !important;
      padding: 1px 8px;
      border-radius: 6px;
    }

    header button[onclick*="Finish"],
    header button[onclick*="finish"],
    header button[onclick*="Submit"],
    header button[onclick*="submit"],
    header > div:first-child > div:last-child > button:last-child {
      background-color: var(--accent-bg) !important;
      color: var(--accent-text) !important;
      border: 1px solid var(--accent-bg) !important;
    }
    header button[onclick*="Finish"] *,
    header button[onclick*="finish"] *,
    header button[onclick*="Submit"] *,
    header button[onclick*="submit"] *,
    header > div:first-child > div:last-child > button:last-child * {
      color: var(--accent-text) !important;
    }
    header button[onclick*="Finish"]:hover,
    header button[onclick*="finish"]:hover,
    header > div:first-child > div:last-child > button:last-child:hover {
      background-color: var(--accent-hover) !important;
    }

    /* Progress Bar di bawah Header */
    header > div:last-child[class*="h-1"] {
      background-color: var(--bg-subtle) !important;
    }
    [id*="progress-bar"] {
      background: var(--accent-bg) !important;
      background-image: none !important;
    }

    /* ==================== SURFACE, KARTU, BORDER & TEKS ==================== */
    .bg-white,
    [class*="bg-white/"] {
      background-color: var(--bg-surface) !important;
      border-color: var(--border-color) !important;
    }

    .bg-slate-50, .bg-gray-50, .bg-slate-100, .bg-gray-100,
    [class*="bg-[#f8fafc]"], [class*="bg-[#f0f6fb]"], [class*="bg-[#e6f4f1]"] {
      background-color: var(--bg-subtle) !important;
      border-color: var(--border-color) !important;
    }

    .border-slate-100, .border-slate-200, .border-slate-300,
    .border-gray-100, .border-gray-200, .border-gray-300,
    [class*="border-slate-200/"] {
      border-color: var(--border-color) !important;
    }

    .shadow-xl, .shadow-2xl, .shadow-lg, .shadow-md, .shadow-sm, .shadow-xs, .shadow-2xs {
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.03) !important;
    }

    .text-navy-950, .text-navy-900, .text-navy-800,
    .text-slate-950, .text-slate-900, .text-slate-800,
    .text-gray-900, .text-gray-800 {
      color: var(--text-primary) !important;
    }

    .text-slate-700, .text-slate-600, .text-gray-700, .text-gray-600 {
      color: var(--text-secondary) !important;
    }

    .text-slate-500, .text-slate-400, .text-slate-300,
    .text-gray-500, .text-gray-400 {
      color: var(--text-muted) !important;
    }

    /* Input, Select, Textarea */
    input:not([type="checkbox"]):not([type="radio"]),
    select,
    textarea {
      background-color: var(--bg-subtle) !important;
      color: var(--text-primary) !important;
      border-color: var(--border-color) !important;
    }
    input:not([type="checkbox"]):not([type="radio"]):focus,
    select:focus,
    textarea:focus {
      background-color: var(--bg-surface) !important;
      border-color: var(--border-strong) !important;
      box-shadow: 0 0 0 3px var(--ring-color) !important;
      outline: none !important;
    }

    /* ==================== TOMBOL UTAMA & AKSEN PAKET ==================== */
    #btn-start-sim,
    #btn-next,
    [class*="bg-navy-9"],
    [class*="bg-navy-8"],
    [class*="bg-undana-"],
    [class*="bg-ipb-"],
    [class*="bg-vet-"],
    [class*="bg-vetnavy-"],
    [class*="bg-vetteal-"],
    [class*="bg-unud-"],
    [class*="bg-blue-9"],
    [class*="bg-blue-8"],
    [class*="bg-blue-7"],
    [class*="bg-blue-6"],
    [class*="bg-indigo-9"],
    [class*="bg-indigo-8"],
    [class*="bg-indigo-7"],
    [class*="bg-teal-9"],
    [class*="bg-teal-8"],
    [class*="bg-teal-7"],
    [class*="bg-purple-9"],
    [class*="bg-purple-8"],
    [class*="bg-purple-7"],
    [class*="bg-cyan-8"],
    [class*="bg-cyan-7"],
    [class*="bg-slate-9"],
    [class*="bg-[#093833]"],
    [class*="bg-[#0b3b64]"],
    [class*="bg-[#0b4640]"],
    [class*="bg-[#0d9488]"],
    [class*="bg-[#0f2942]"],
    [class*="bg-[#0f4c81]"],
    [class*="bg-[#0f5c54]"],
    [class*="bg-[#0f766e]"],
    [class*="bg-[#115e59]"],
    [class*="bg-[#134e4a]"],
    [class*="bg-[#14b8a6]"],
    [class*="bg-[#163859]"],
    [class*="bg-[#172554]"],
    [class*="bg-[#1d4ed8]"],
    [class*="bg-[#1e293b]"],
    [class*="bg-[#1e3a8a]"],
    [class*="bg-[#2563eb]"],
    [class*="bg-[#881337]"],
    [class*="bg-[#9f1239]"],
    [class*="bg-[#be123c]"] {
      background-color: var(--accent-bg) !important;
      background-image: none !important;
      color: var(--accent-text) !important;
      border-color: var(--accent-bg) !important;
    }

    #btn-start-sim *,
    #btn-next * {
      color: var(--accent-text) !important;
    }

    #btn-start-sim:hover,
    #btn-next:hover,
    [class*="bg-navy-9"]:hover,
    [class*="bg-blue-7"]:hover,
    [class*="bg-indigo-7"]:hover,
    [class*="bg-teal-7"]:hover,
    [class*="bg-purple-7"]:hover {
      background-color: var(--accent-hover) !important;
    }

    /* Kartu Mode / Paket / Opsi Jawaban yang Sedang Dipilih */
    button[class*="border-navy-9"],
    button[class*="border-blue-6"],
    button[class*="border-blue-7"],
    button[class*="border-indigo-6"],
    button[class*="border-teal-6"],
    button[class*="border-purple-6"],
    button[class*="border-undana-"],
    button[class*="border-ipb-"],
    button[class*="border-unud-"],
    button[class*="border-vet"],
    #options-container button[class*="border-navy-9"],
    #options-container button[class*="border-blue-"],
    #options-container button[class*="border-indigo-"],
    #options-container button[class*="border-teal-"],
    #options-container button[class*="border-purple-"],
    #options-container button[class*="border-[#"] {
      border-color: var(--text-primary) !important;
      background-color: var(--bg-subtle) !important;
      color: var(--text-primary) !important;
    }

    /* Badge Nomor Soal & Kategori */
    #question-number-badge {
      background-color: var(--accent-bg) !important;
      color: var(--accent-text) !important;
    }

    #question-category-badge,
    #setup-question-count,
    #sidebar-summary {
      background-color: var(--bg-subtle) !important;
      color: var(--text-secondary) !important;
      border: 1px solid var(--border-color) !important;
    }

    /* ==================== WARNA SEMANTIK (BENAR / SALAH / RAGU) ==================== */
    html.dark .bg-emerald-50,
    html.dark [class*="bg-emerald-50/"],
    html.dark .bg-emerald-100 {
      background-color: rgba(16, 185, 129, 0.14) !important;
      border-color: rgba(16, 185, 129, 0.42) !important;
    }
    html.dark .text-emerald-700,
    html.dark .text-emerald-800,
    html.dark .text-emerald-900,
    html.dark .text-emerald-950 {
      color: #6ee7b7 !important;
    }

    html.dark .bg-rose-50,
    html.dark [class*="bg-rose-50/"],
    html.dark .bg-rose-100 {
      background-color: rgba(244, 63, 94, 0.14) !important;
      border-color: rgba(244, 63, 94, 0.42) !important;
    }
    html.dark .text-rose-700,
    html.dark .text-rose-800,
    html.dark .text-rose-900,
    html.dark .text-rose-950 {
      color: #fda4af !important;
    }

    html.dark .bg-amber-50,
    html.dark [class*="bg-amber-50/"],
    html.dark .bg-amber-100 {
      background-color: rgba(245, 158, 11, 0.14) !important;
      border-color: rgba(245, 158, 11, 0.42) !important;
    }
    html.dark .text-amber-700,
    html.dark .text-amber-800,
    html.dark .text-amber-900,
    html.dark .text-amber-950 {
      color: #fcd34d !important;
    }

    /* Ring skor di halaman hasil */
    #score-ring-circle:first-of-type {
      stroke: var(--border-strong);
    }

    /* Responsif Mobile */
    @media (max-width: 639px) {
      header.sticky > div.h-16 { height: auto !important; flex-wrap: wrap; row-gap: 6px; padding-top: 8px; padding-bottom: 8px; }
      header.sticky > div.h-16 > div:first-child { flex: 1 1 100%; }
      header.sticky > div.h-16 > div:last-child { flex: 1 1 100%; justify-content: flex-end; }
      input, select, textarea { font-size: 16px !important; }
    }
    @media (max-width: 360px) {
      header div.flex.items-center.gap-2 { flex-wrap: wrap; }
      #cbt-timer-wrapper + button, div:has(> #cbt-timer-wrapper) { flex-wrap: wrap; }
    }
`;

  const THEME_BOOTSTRAP_SCRIPT = `<script id="portal-unified-theme-boot">(function(){try{var s=localStorage.getItem('portal_ukmppdh_theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(!s&&d)){document.documentElement.classList.add('dark');}}catch(e){}})();<\/script>`;

  function isPortalDark() {
    try {
      if (document.documentElement.classList.contains('dark')) return true;
      return localStorage.getItem('portal_ukmppdh_theme') === 'dark';
    } catch (e) {
      return false;
    }
  }

  function applyUnifiedThemeToHtml(rawHtml) {
    let html = String(rawHtml || '');
    if (!html.trim()) return html;

    // Bersihkan injeksi tema lama jika file diunggah ulang
    html = html
      .replace(/<meta[^>]*name=["']portal-theme-version["'][^>]*>\s*/gi, '')
      .replace(/<script[^>]*id=["']portal-unified-theme-boot["'][^>]*>[\s\S]*?<\/script>\s*/gi, '')
      .replace(/<style[^>]*id=["']portal-unified-theme-css["'][^>]*>[\s\S]*?<\/style>\s*/gi, '');

    const injection =
      `<meta name="portal-theme-version" content="unified-index-v1">\n` +
      `${THEME_BOOTSTRAP_SCRIPT}\n` +
      `<style id="portal-unified-theme-css">${UNIFIED_THEME_CSS}</style>\n`;

    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `${injection}</head>`);
    } else if (/<body[\s>]/i.test(html)) {
      html = html.replace(/<body([\s>])/i, `<head>${injection}</head><body$1`);
    } else {
      html = injection + html;
    }

    return html;
  }

  function applyUnifiedThemeToDocument(doc, forceDark) {
    if (!doc || !doc.documentElement) return;
    const dark = typeof forceDark === 'boolean' ? forceDark : isPortalDark();
    doc.documentElement.classList.toggle('dark', dark);

    let styleEl = doc.getElementById('portal-unified-theme-css');
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = 'portal-unified-theme-css';
      styleEl.textContent = UNIFIED_THEME_CSS;
    }
    if (doc.head) {
      doc.head.appendChild(styleEl);
    }
  }

  window.PortalTheme = {
    css: UNIFIED_THEME_CSS,
    applyToHtml: applyUnifiedThemeToHtml,
    applyToDocument: applyUnifiedThemeToDocument
  };

  const START = ['startSimulation', 'startNewSimulation', 'startNewSession', 'startQuiz', 'startSession', 'resumeSavedSession'];
  const STOP = ['finishExam', 'finishSimulation', 'finishQuiz', 'finalizeExam',
    'goToSetup', 'backToSetup', 'backToLobby', 'goHomeFromResult', 'goToMenu', 'goToHome', 'resetToHome', 'resetToSetup', 'backToHome'];

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

    /** Menyuntikkan tema terpusat index.html & membuat font eksternal non-blocking */
    prepareHtml(html) {
      const nonBlockingFonts = String(html || '').replace(
        /<link(?![^>]*\bmedia=)([^>]*fonts\.googleapis\.com\/css2[^>]*?)\s*\/?>/g,
        '<link$1 media="print" onload="this.media=\'all\'">'
      );
      return applyUnifiedThemeToHtml(nonBlockingFonts);
    },

    /** Dipanggil setelah iframe paket selesai dimuat */
    enhance(frame) {
      try {
        const win = frame.contentWindow;
        applyUnifiedThemeToDocument(win.document, isPortalDark());
        if (window.syncExamTheme) window.syncExamTheme();

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
