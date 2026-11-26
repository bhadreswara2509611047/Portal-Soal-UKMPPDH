/* Simpan & lanjutkan sesi untuk paket yang tidak punya fitur simpan progres sendiri.
 * Cara kerja: selama sesi berjalan, variabel state paket (daftar ADAPTERS di history.js) disalin
 * ke IndexedDB tiap beberapa detik. Saat paket dibuka lagi, peserta ditawari melanjutkan: portal
 * memanggil ulang fungsi "mulai" milik paket, menimpa state dengan salinan tersimpan, lalu
 * menggambar ulang soal, navigasi, dan timer. Paket yang sudah punya resume sendiri tidak disentuh. */
(function () {
  'use strict';

  const DB_NAME = 'portal_ukmppdh_progress';
  const STORE = 'sessions';
  const SAVE_EVERY_MS = 3000;

  const START = ['startSimulation', 'startNewSimulation', 'startNewSession', 'startQuiz', 'startSession'];
  const REFRESH = ['renderQuestion', 'renderCurrentQuestion', 'renderExamQuestion',
    'renderLegend', 'renderNavGrids', 'renderNavGrid', 'renderNavigator', 'renderNavigators', 'renderNavigationGrids',
    'updateProgress', 'updateProgressHeader', 'updateProgressUI', 'updateExamStats',
    'updateTimerDisplay', 'updateTimerUI'];
  const ANSWER_KEYS = ['answers', 'userAnswers'];
  const LIST_KEYS = ['questions', 'sessionQuestions', 'activeQuestions', 'activeList'];

  // ==================== PENYIMPANAN ====================
  let dbPromise = null;
  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { dbPromise = null; reject(req.error); };
      });
    }
    return dbPromise;
  }

  async function dbRun(mode, work) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }

  const dbGet = (key) => dbRun('readonly', (s) => s.get(key));
  const dbPut = (rec) => dbRun('readwrite', (s) => s.put(rec));
  const dbDelete = (key) => dbRun('readwrite', (s) => s.delete(key));

  // ==================== JEMBATAN KE IFRAME ====================
  function snapshot(win, adapter) {
    return win.eval(`JSON.stringify({ ${adapter.vars.join(', ')} }, function (k, v) {
      if (k === 'timerInterval') return null;
      return v instanceof Set ? { __set: Array.from(v) } : v;
    })`);
  }

  // Objek (mis. `state`) digabung kunci demi kunci agar handle timer yang sedang berjalan tidak tertimpa.
  function restore(win, adapter, json) {
    win.__portalSnap = json;
    try {
      win.eval(`(function () {
        var d = JSON.parse(window.__portalSnap, function (k, v) { return v && v.__set ? new Set(v.__set) : v; });
        var SKIP = /^(timer(Interval|Id)?|modalOpen)$/;
        function plain(o) { return o && typeof o === 'object' && !Array.isArray(o) && !(o instanceof Set); }
        function put(cur, saved) {
          if (plain(cur) && plain(saved)) {
            Object.keys(saved).forEach(function (k) { if (!SKIP.test(k)) cur[k] = saved[k]; });
            return cur;
          }
          return saved;
        }
        ${adapter.vars.map((v) => `if ('${v}' in d) { try { ${v} = put(${v}, d.${v}); } catch (e) {} }`).join('\n        ')}
      })()`);
    } finally {
      delete win.__portalSnap;
    }
  }

  function pick(data, keys) {
    for (const scope of [data, data.state, data.appState, data.session]) {
      if (!scope || typeof scope !== 'object') continue;
      for (const k of keys) if (scope[k] != null) return scope[k];
    }
    return null;
  }

  function summarize(json) {
    try {
      const data = JSON.parse(json);
      const answers = pick(data, ANSWER_KEYS);
      const list = pick(data, LIST_KEYS);
      const answered = Array.isArray(answers) ? answers.filter((v) => v != null).length
        : answers ? Object.keys(answers).length : 0;
      const total = Array.isArray(list) ? list.length : Array.isArray(answers) ? answers.length : 0;
      const mode = pick(data, ['mode', 'selectedMode', 'currentMode']);
      return { answered, total, practice: /prac|latih/i.test(String(mode || '')) };
    } catch (e) {
      return { answered: 0, total: 0, practice: false };
    }
  }

  const userKey = () => (typeof getUserProgressKey === 'function' ? getUserProgressKey() : 'guest');
  const hasNativeResume = (win) =>
    ['resumeSavedSession', 'loadSavedProgress'].some((n) => typeof win[n] === 'function');

  // ==================== DIALOG ====================
  function askResume(rec, meta) {
    return new Promise((resolve) => {
      const info = summarize(rec.state);
      const when = new Date(rec.savedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
      const detail = [
        info.practice ? 'Mode Latihan' : 'Mode Ujian',
        info.total ? `${info.answered}/${info.total} soal terjawab` : `${info.answered} soal terjawab`,
        `disimpan ${when}`
      ].join(' • ');

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4';
      const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      modal.innerHTML = `
        <div class="surface border w-full max-w-sm rounded-2xl p-5 space-y-4 fade-in" role="dialog" aria-modal="true">
          <div>
            <h3 class="text-base font-bold text-main">Lanjutkan sesi sebelumnya?</h3>
            <p class="text-xs text-sub mt-1.5">${esc(meta.code)} — ${esc(meta.title)}</p>
            <p class="text-xs text-mute mt-1">${esc(detail)}</p>
            <p class="text-[11px] text-mute mt-2">Waktu berhenti saat Anda keluar dan berjalan lagi dari sisa terakhir.</p>
          </div>
          <div class="flex gap-2 justify-end">
            <button type="button" data-act="new" class="btn-secondary px-4 h-10 rounded-xl text-sm font-semibold">Mulai Baru</button>
            <button type="button" data-act="resume" class="btn-primary px-4 h-10 rounded-xl text-sm font-bold">Lanjutkan</button>
          </div>
        </div>`;
      modal.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        modal.remove();
        resolve(btn.dataset.act === 'resume');
      });
      document.body.appendChild(modal);
      const first = modal.querySelector('[data-act="resume"]');
      if (first) first.focus();
    });
  }

  // ==================== PENGHUBUNG PER PAKET ====================
  let current = null; // sesi yang sedang terbuka, untuk flush() saat keluar

  function attach(win, adapter, meta, frame) {
    if (hasNativeResume(win)) return;
    win.__portalGenericResume = true;

    const key = `${userKey()}|${meta.source}|${meta.packageId}`;
    let active = false;
    let startCall = null;
    let depth = 0;
    let lastJson = '';
    let dead = false;

    START.forEach((name) => {
      const fn = win[name];
      if (typeof fn !== 'function') return;
      win[name] = function () {
        const outer = depth === 0;
        depth++;
        try {
          const result = fn.apply(this, arguments);
          if (outer) {
            active = true;
            startCall = captureCall(win, name, arguments);
          }
          return result;
        } finally {
          depth--;
        }
      };
    });

    const finish = win[adapter.finish];
    win[adapter.finish] = function () {
      const result = finish.apply(this, arguments);
      active = false;
      lastJson = '';
      dbDelete(key).catch(() => {});
      return result;
    };

    async function save() {
      if (dead || !active || !startCall) return;
      let json;
      try {
        json = snapshot(win, adapter);
      } catch (e) {
        return;
      }
      if (json === lastJson) return;
      lastJson = json;
      try {
        await dbPut({ key, htmlHash: meta.htmlHash, savedAt: Date.now(), start: startCall, state: json });
      } catch (e) {
        lastJson = '';
      }
    }

    const timer = setInterval(() => {
      if (!frame.isConnected || frame.contentWindow !== win) return stop();
      save();
    }, SAVE_EVERY_MS);
    const onHide = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);

    function stop() {
      if (dead) return;
      dead = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
      if (current && current.key === key) current = null;
    }

    current = { key, save, stop };

    async function offerResume() {
      let rec;
      try {
        rec = await dbGet(key);
      } catch (e) {
        return;
      }
      if (!rec || dead) return;
      if (rec.htmlHash !== meta.htmlHash || !rec.start) {
        dbDelete(key).catch(() => {});
        return;
      }
      if (!(await askResume(rec, meta))) {
        dbDelete(key).catch(() => {});
        return;
      }
      if (dead || frame.contentWindow !== win) return;
      try {
        resume(win, adapter, rec);
      } catch (e) {
        console.error('Gagal melanjutkan sesi:', e);
        alert('Sesi tersimpan tidak bisa dilanjutkan. Silakan mulai baru.');
        dbDelete(key).catch(() => {});
      }
    }
    offerResume();
  }

  function captureCall(win, fn, args) {
    try {
      const list = Array.prototype.map.call(args, (a) => (a instanceof win.Event ? undefined : a));
      while (list.length && list[list.length - 1] === undefined) list.pop();
      return { fn, args: JSON.stringify(list.map((a) => (a === undefined ? null : a))) };
    } catch (e) {
      return { fn, args: '[]' };
    }
  }

  function resume(win, adapter, rec) {
    restore(win, adapter, rec.state);            // mode & pengaturan dibaca fungsi mulai
    win[rec.start.fn].apply(win, JSON.parse(rec.start.args)); // siapkan layar & timer milik paket
    restore(win, adapter, rec.state);            // jawaban, urutan soal, posisi, sisa waktu
    REFRESH.forEach((name) => {
      if (typeof win[name] !== 'function') return;
      try { win[name](); } catch (e) { console.warn(name, e); }
    });
  }

  window.PortalProgress = {
    attach,
    /** Simpan segera, dipanggil sebelum paket ditutup. */
    flush() {
      const s = current;
      if (!s) return;
      s.save();
    }
  };
})();
