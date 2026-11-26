/* Stabilitas & tampilan saat paket dikerjakan: konfirmasi keluar, tombol Back HP,
 * perbaikan header di layar sempit, anti-flash tema, dan pendaftaran cache offline. */
(function () {
  'use strict';

  const START = ['startSimulation', 'startNewSimulation', 'startNewSession', 'startQuiz', 'startSession', 'resumeSavedSession'];
  const STOP = ['finishExam', 'finishSimulation', 'finishQuiz', 'finalizeExam',
    'goToSetup', 'backToSetup', 'backToLobby', 'goHomeFromResult', 'goToMenu', 'goToHome', 'resetToHome', 'resetToSetup', 'backToHome'];

  const FRAME_CSS = `
    html, body { overscroll-behavior-y: contain; }
    button, label, select { touch-action: manipulation; }
    @media (max-width: 639px) {
      header.sticky > div.h-16 { height: auto !important; flex-wrap: wrap; row-gap: 6px; padding-top: 8px; padding-bottom: 8px; }
      header.sticky > div.h-16 > div:first-child { flex: 1 1 100%; }
      header.sticky > div.h-16 > div:last-child { flex: 1 1 100%; justify-content: flex-end; }
      input, select, textarea { font-size: 16px !important; } /* cegah zoom otomatis iOS */
    }
    @media (max-width: 360px) {
      header div.flex.items-center.gap-2 { flex-wrap: wrap; }
      #cbt-timer-wrapper + button, div:has(> #cbt-timer-wrapper) { flex-wrap: wrap; }
    }`;

  let teardown = null;   // fungsi penutup paket yang sedang terbuka
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
    if (window.PortalProgress) window.PortalProgress.flush(); // simpan posisi terakhir sebelum paket ditutup
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

  // Entri sisa dari muat ulang saat ujian terbuka.
  if (history.state && history.state.exam) history.replaceState(null, '');

  /** Timer paket menghitung dengan mengurangi 1 detik per tick. Saat tab di latar belakang, layar HP mati,
   *  atau browser menahan timer, tick terlewat dan waktu "berhenti". Di sini tick yang terlewat dikejar
   *  berdasarkan jam sebenarnya, sehingga sisa waktu ujian selalu benar. */
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

    /** Dipanggil saat paket dibuka; onClose membersihkan tampilannya. */
    enter(onClose) {
      teardown = onClose;
      inProgress = false;
      if (!ignorePop) pushEntry();
    },

    /** Tombol "Portal" di dalam tampilan ujian. */
    requestClose() {
      if (!confirmLeave()) return;
      close();
      if (history.state && history.state.exam) {
        ignorePop = true;
        history.back();
      }
    },

    /** Menutup tanpa konfirmasi (logout). */
    reset: close,

    /** Iframe baru untuk tiap paket, agar tidak menambah entri riwayat browser. */
    freshFrame(frame) {
      const next = frame.cloneNode(false);
      next.removeAttribute('src');
      next.removeAttribute('srcdoc');
      frame.replaceWith(next);
      return next;
    },

    /** Font eksternal tidak menahan tampilnya soal & tema dasar diterapkan sejak awal (anti-flash). */
    prepareHtml(html) {
      const isDark = document.documentElement.classList.contains('dark');
      const themeClass = isDark ? 'portal-dark dark' : 'portal-light';
      const baseBg = isDark ? '#0b1120' : '#f3f6fb';
      const baseText = isDark ? '#e2e8f0' : '#1e293b';

      let out = html.replace(
        /<link(?![^>]*\bmedia=)([^>]*fonts\.googleapis\.com\/css2[^>]*?)\s*\/?>/g,
        '<link$1 media="print" onload="this.media=\'all\'">'
      );

      out = out.replace(/<html(\b[^>]*)>/i, (m, attrs) => {
        if (/\bclass="/i.test(attrs)) {
          return `<html${attrs.replace(/\bclass="/i, `class="${themeClass} `)}>`;
        }
        return `<html class="${themeClass}"${attrs}>`;
      });

      const preloadStyle = `<style id="portal-preload-bg">html,body{background-color:${baseBg};color:${baseText};}</style>`;
      return out.replace(/<\/head>/i, `${preloadStyle}</head>`);
    },

    /** Dipanggil setelah iframe paket selesai dimuat (sesudah PortalHistory.attach). */
    enhance(frame) {
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
