/* Stabilitas, performa render, & tampilan adaptif Desktop + Mobile saat paket dikerjakan:
 * konfirmasi keluar, tombol Back HP, tabel/SVG responsif, target sentuh mobile,
 * isolasi render daftar pembahasan, timer akurat saat tab tidur, dan anti-flash tema. */
(function () {
  'use strict';

  const START = [
    'startSimulation', 'startNewSimulation', 'startNewSession',
    'startQuiz', 'startSession', 'resumeSavedSession'
  ];
  const STOP = [
    'finishExam', 'finishSimulation', 'finishQuiz', 'finalizeExam',
    'goToSetup', 'backToSetup', 'backToLobby', 'goHomeFromResult',
    'goToMenu', 'goToHome', 'resetToHome', 'resetToSetup', 'backToHome'
  ];

  /**
   * Paket yang sudah punya tema gelap bawaan (aturan CSS [data-theme="dark"] atau tombol #btn-theme)
   * dikendalikan lewat atribut data-theme, bukan lewat CSS adaptif portal, supaya tidak saling
   * menimpa. Paket Tailwind lama tetap memakai mesin adaptif di exam-theme.js.
   */
  function hasNativeTheme(html) {
    return /\[data-theme\s*=\s*["']?dark["']?\s*\]/i.test(html) || /\bid\s*=\s*["']btn-theme["']/i.test(html);
  }

  const FRAME_CSS = `
    html {
      scroll-behavior: smooth;
      -webkit-text-size-adjust: 100%;
    }
    html, body {
      overscroll-behavior-y: contain;
      overflow-x: clip;
    }
    body {
      padding-bottom: max(16px, env(safe-area-inset-bottom));
      text-rendering: optimizeLegibility;
    }
    button, label, select, a {
      touch-action: manipulation;
    }

    /* Media, diagram SVG, dan tabel klinis tidak pernah menyebabkan scroll horizontal rusak */
    img, svg, canvas, video {
      max-width: 100%;
      height: auto;
    }
    table {
      display: block;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-collapse: collapse;
    }

    /* Performa render daftar pembahasan panjang (100-185 soal) tetap 60fps */
    #review-container > div,
    #review-list > div,
    #discussion-list > div,
    .review-item,
    .question-review-card {
      content-visibility: auto;
      contain-intrinsic-size: auto 280px;
    }

    /* Keterbacaan teks soal & kenyamanan navigasi pada layar Desktop */
    @media (min-width: 1024px) {
      main p, .question-text, #question-text {
        line-height: 1.72;
      }
      aside, .nav-panel, #question-nav-panel {
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }
      button:focus-visible, input:focus-visible, select:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }
    }

    /* Ergonomi Mobile & Thumb Zone */
    @media (max-width: 767px) {
      header.sticky > div.h-16,
      header.sticky > div.h-14 {
        height: auto !important;
        min-height: 52px;
        flex-wrap: wrap;
        row-gap: 6px;
        padding-top: 8px;
        padding-bottom: 8px;
      }
      header.sticky > div.h-16 > div:first-child {
        flex: 1 1 100%;
      }
      header.sticky > div.h-16 > div:last-child {
        flex: 1 1 100%;
        justify-content: flex-end;
      }
      /* Cegah auto-zoom pada iOS Safari */
      input, select, textarea {
        font-size: 16px !important;
      }
      /* Target sentuh nyaman minimal 46px pada pilihan jawaban */
      #options-container button,
      #options-container label,
      .option-btn,
      .option-card {
        min-height: 46px;
        padding-top: 11px !important;
        padding-bottom: 11px !important;
      }
      /* Kurangi padding kontainer agar ruang baca soal di layar kecil lebih lega */
      main.max-w-7xl, main.max-w-6xl, main.max-w-5xl {
        padding-left: 12px !important;
        padding-right: 12px !important;
      }
      /* Matikan efek backdrop blur berat pada perangkat mobile kelas menengah */
      header.sticky, .backdrop-blur, .backdrop-blur-md, .backdrop-blur-lg {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }
    }

    @media (max-width: 360px) {
      header div.flex.items-center.gap-2 { flex-wrap: wrap; }
      #cbt-timer-wrapper + button, div:has(> #cbt-timer-wrapper) { flex-wrap: wrap; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
  `;

  let teardown = null;
  let inProgress = false;
  let canResume = false;
  let ignorePop = false;
  let activeCleanup = null;

  function confirmLeave() {
    if (!teardown || !inProgress) return true;
    return confirm(
      canResume
        ? 'Ujian belum selesai. Progres tersimpan dan bisa dilanjutkan nanti. Keluar sekarang?'
        : 'Ujian belum selesai. Paket ini TIDAK menyimpan progres, jawaban akan hilang. Tetap keluar?'
    );
  }

  function pushEntry() {
    if (!(history.state && history.state.exam)) history.pushState({ exam: true }, '');
  }

  function close() {
    if (window.PortalProgress) window.PortalProgress.flush();
    if (activeCleanup) {
      try { activeCleanup(); } catch (e) {}
      activeCleanup = null;
    }
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

  /** Timer paket menghitung dengan mengurangi 1 detik per tick. Saat tab di latar belakang, layar HP mati,
   *  atau browser menahan timer, tick terlewat dikejar berdasarkan jam sebenarnya. */
  function fixTimers(win) {
    const rawSet = win.setInterval;
    const rawClear = win.clearInterval;
    const cleared = new Set();
    const listeners = [];

    win.clearInterval = function (id) {
      cleared.add(id);
      return rawClear.call(win, id);
    };

    win.setInterval = function (fn, ms) {
      if (typeof fn !== 'function' || !(ms >= 900 && ms <= 1100)) {
        return rawSet.apply(win, arguments);
      }
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
      listeners.push(() => win.document.removeEventListener('visibilitychange', onVisible));

      id = rawSet.call(win, () => {
        tick();
        if (cleared.has(id)) win.document.removeEventListener('visibilitychange', onVisible);
      }, ms);
      return id;
    };

    return () => {
      listeners.forEach((off) => { try { off(); } catch (e) {} });
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

    /** Font eksternal tidak menahan tampilnya soal & tema dasar diterapkan sejak awal (anti-flash). */
    /** Font eksternal tidak menahan tampilnya soal & tema dasar diterapkan sejak awal (anti-flash). */
    /**
     * Paket yang sudah punya tema gelap bawaan (aturan CSS [data-theme="dark"] atau tombol #btn-theme)
     * dikendalikan lewat atribut data-theme, bukan lewat CSS adaptif portal, supaya tidak saling
     * menimpa. Paket Tailwind lama tetap memakai mesin adaptif di exam-theme.js.
     */
    hasNativeTheme(html) {
      return /\[data-theme\s*=\s*["']?dark["']?\s*\]/i.test(html) || /\bid\s*=\s*["']btn-theme["']/i.test(html);
    },

    /** Font eksternal tidak menahan tampilnya soal & tema dasar diterapkan sejak awal (anti-flash). */
    hasNativeTheme,

    prepareHtml(html) {
      const isDark = document.documentElement.classList.contains('dark');
      const native = hasNativeTheme(html);
      const themeClass = isDark ? 'portal-dark dark' : 'portal-light';
      const baseBg = isDark ? '#0b1120' : '#f3f6fb';
      const baseText = isDark ? '#e2e8f0' : '#1e293b';

      let out = html.replace(
        /<link(?![^>]*\bmedia=)([^>]*fonts\.googleapis\.com\/css2[^>]*?)\s*\/?>/g,
        '<link$1 media="print" onload="this.media=\'all\'">'
      );

      out = out.replace(/<html(\b[^>]*)>/i, (m, attrs) => {
        if (native) {
          // Buang data-theme bawaan paket, gabungkan class, lalu paksa mengikuti tema portal sejak awal.
          let extra = '';
          const clean = attrs
            .replace(/\sdata-theme\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
            .replace(/\sclass\s*=\s*"([^"]*)"/i, (mm, c) => { extra = ' ' + c; return ''; });
          return `<html${clean} class="${themeClass}${extra}" data-portal-native-theme="1" data-theme="${isDark ? 'dark' : 'light'}">`;
        }
        if (/\bclass="/i.test(attrs)) {
          return `<html${attrs.replace(/\bclass="/i, `class="${themeClass} `)}>`;
        }
        return `<html class="${themeClass}"${attrs}>`;
      });

      if (native) {
        // Satu-satunya tombol tema adalah milik portal; tombol tema internal paket disembunyikan.
        return out.replace(/<\/head>/i, `<style id="portal-native-theme-fix">#btn-theme,[data-theme-toggle]{display:none !important;}</style></head>`);
      }

      const themeStyle = window.PORTAL_EXAM_THEME_CSS
        ? `<style id="portal-adaptive-exam-theme">${window.PORTAL_EXAM_THEME_CSS}</style>`
        : '';
      const preloadStyle = `<style id="portal-preload-bg">html,body{background-color:${baseBg};color:${baseText};}</style>${themeStyle}`;
      return out.replace(/<\/head>/i, `${preloadStyle}</head>`);
    },

    enhance(frame) {
      if (window.syncExamTheme) window.syncExamTheme();
      try {
        const win = frame.contentWindow;
        const style = win.document.createElement('style');
        style.id = 'portal-runtime-responsive-css';
        style.textContent = FRAME_CSS;
        win.document.head.appendChild(style);

        canResume =
          typeof win.resumeSavedSession === 'function' ||
          typeof win.loadSavedProgress === 'function' ||
          !!win.__portalGenericResume;

        const cleanTimers = fixTimers(win);

        // Shortcut keyboard desktop (Panah Kiri/Kanan) saat tidak mengetik di input
        const onKeyDown = (e) => {
          const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
          if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.altKey || e.ctrlKey || e.metaKey) return;
          if (e.key === 'ArrowRight' && typeof win.nextQuestion === 'function') {
            e.preventDefault();
            win.nextQuestion();
          } else if (e.key === 'ArrowLeft' && typeof win.prevQuestion === 'function') {
            e.preventDefault();
            win.prevQuestion();
          }
        };
        win.document.addEventListener('keydown', onKeyDown);

        activeCleanup = () => {
          cleanTimers();
          win.document.removeEventListener('keydown', onKeyDown);
        };

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
