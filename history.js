/* Riwayat pengerjaan paket soal: simpan otomatis saat ujian diselesaikan, lalu buka kembali.
 * Data disimpan di IndexedDB perangkat ini, dipisah per username.
 * Paket dikenali dari nama fungsi & variabel di dalam HTML-nya (ADAPTERS), bukan dari ID paket. */
(function () {
  'use strict';

  const DB_NAME = 'portal_ukmppdh_history';
  const STORE = 'attempts';

  // Urutan penting: aturan yang lebih spesifik diletakkan lebih dulu.
  const ADAPTERS = [
    { finish: 'finalizeExam', vars: ['selectedMode', 'selectedPackage', 'activeList', 'answers', 'flags', 'currentIdx', 'secondsRemaining'],
      text: ['header-pkg-label'] },
    { finish: 'finishSimulation', vars: ['appState'] },
    { finish: 'finishQuiz', vars: ['currentMode', 'activeQuestions', 'userAnswers', 'flaggedQuestions', 'currentIndex', 'timeLeftSeconds'] },
    { finish: 'finishQuiz', vars: ['currentMode', 'userAnswers', 'flagged', 'currentIndex', 'timerSeconds'] },
    { finish: 'finishExam', vars: ['session'] },
    { finish: 'finishExam', vars: ['state'] }
  ];

  // Memanggil salah satu fungsi ini berarti peserta memulai/mengelola sesi baru: penyimpanan paket diaktifkan lagi.
  const SESSION_FUNCS = ['startSimulation', 'startNewSimulation', 'startNewSession', 'startQuiz', 'startSession',
    'resumeSavedSession', 'discardSavedSession', 'openConfirmClearSession', 'openResetModal'];

  const SCORE_IDS = ['result-score-value', 'result-score-pct', 'result-score', 'res-score', 'final-score'];

  // ==================== PENYIMPANAN ====================
  let dbPromise = null;
  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('user', 'user');
        };
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

  const userKey = () => getUserProgressKey(); // fungsi dari index.html (kunci per username)
  const listAttempts = async () =>
    (await dbRun('readonly', (s) => s.index('user').getAll(userKey()))).sort((a, b) => b.finishedAt - a.finishedAt);

  // ==================== JEMBATAN KE IFRAME ====================
  function hashText(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return String(h >>> 0);
  }

  function detectAdapter(win) {
    try {
      return ADAPTERS.find((a) =>
        win.eval(`typeof ${a.finish} === 'function' && ` + a.vars.map((v) => `typeof ${v} !== 'undefined'`).join(' && '))
      ) || null;
    } catch (e) {
      return null;
    }
  }

  // Dijalankan di dalam iframe agar Set milik iframe ikut terbaca.
  function snapshotState(win, adapter) {
    return win.eval(`JSON.stringify({ ${adapter.vars.join(', ')} }, function (k, v) {
      if (k === 'timerInterval') return null;
      return v instanceof Set ? { __set: Array.from(v) } : v;
    })`);
  }

  function restoreState(win, adapter, json) {
    win.__historyJson = json;
    win.eval(`(function () {
      var data = JSON.parse(window.__historyJson, function (k, v) {
        return v && v.__set ? new Set(v.__set) : v;
      });
      ${adapter.vars.map((v) => `try { ${v} = data.${v}; } catch (e) { Object.assign(${v}, data.${v}); }`).join('\n')}
      delete window.__historyJson;
    })()`);
  }

  function readText(doc, ids) {
    for (const id of ids) {
      const el = doc.getElementById(id);
      if (el) return el.textContent.trim();
    }
    return '';
  }

  function buildRecord(win, adapter, meta) {
    const doc = win.document;
    const mode = win.eval(`(function () {
      if (typeof appState !== 'undefined') return appState.mode;
      if (typeof session !== 'undefined' && session) return session.mode;
      if (typeof selectedMode !== 'undefined') return selectedMode;
      if (typeof currentMode !== 'undefined') return currentMode;
      return typeof state !== 'undefined' ? state.mode : '';
    })()`);
    const domText = {};
    (adapter.text || []).forEach((id) => { domText[id] = readText(doc, [id]); });
    return {
      id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      user: userKey(),
      packageId: meta.packageId,
      source: meta.source,
      code: meta.code,
      title: meta.title,
      htmlHash: meta.htmlHash,
      finishedAt: Date.now(),
      mode: mode === 'practice' || mode === 'latihan' ? 'Latihan' : 'Ujian',
      score: readText(doc, SCORE_IDS).replace('%', ''),
      correct: readText(doc, ['stat-correct', 'res-correct']),
      wrong: readText(doc, ['stat-wrong', 'res-wrong']),
      empty: readText(doc, ['stat-empty', 'stat-unanswered', 'res-empty']),
      domText,
      state: snapshotState(win, adapter)
    };
  }

  // Menampilkan ulang hasil tanpa mengubah progres tersimpan milik paket.
  function showReview(win, adapter, originalFinish, record) {
    const proto = win.Storage.prototype;
    const { setItem, removeItem } = proto;
    const unblock = () => { proto.setItem = setItem; proto.removeItem = removeItem; };
    proto.setItem = proto.removeItem = function () {};

    SESSION_FUNCS.forEach((name) => {
      const fn = win[name];
      if (typeof fn !== 'function') return;
      win[name] = function () { unblock(); return fn.apply(this, arguments); };
    });

    restoreState(win, adapter, record.state);
    Object.keys(record.domText || {}).forEach((id) => {
      const el = win.document.getElementById(id);
      if (el) el.textContent = record.domText[id];
    });

    // Sebagian paket menghitung durasi dari Date.now() saat selesai: pakai waktu selesai yang asli.
    const realNow = win.Date.now;
    win.Date.now = () => record.finishedAt;
    try {
      originalFinish.call(win);
    } finally {
      win.Date.now = realNow;
    }
  }

  /** Dipanggil setiap kali iframe paket selesai dimuat. */
  function attach(frame, meta, reviewRecord) {
    let win;
    let adapter;
    try {
      win = frame.contentWindow;
      adapter = detectAdapter(win);
    } catch (e) {}
    if (!adapter) {
      if (reviewRecord) alert('Format paket ini tidak dikenali, hasil tidak bisa dibuka kembali.');
      return;
    }

    const originalFinish = win[adapter.finish];
    let lastSignature = '';
    win[adapter.finish] = function () {
      const result = originalFinish.apply(this, arguments);
      try {
        const record = buildRecord(win, adapter, meta);
        const signature = record.state;
        if (signature !== lastSignature) {
          lastSignature = signature;
          dbRun('readwrite', (s) => s.put(record)).then(refreshCount).catch(() =>
            alert('Hasil ujian gagal disimpan ke riwayat (penyimpanan browser penuh atau diblokir).'));
        }
      } catch (e) {
        console.error('Riwayat gagal dicatat:', e);
      }
      return result;
    };

    if (reviewRecord) {
      try {
        showReview(win, adapter, originalFinish, reviewRecord);
      } catch (e) {
        console.error(e);
        alert('Riwayat ini gagal dibuka. Kemungkinan isi paket sudah berubah.');
      }
    }
  }

  // ==================== UI ====================
  async function refreshCount() {
    const el = document.getElementById('history-count');
    if (!el || !currentSession) return;
    try {
      const n = (await listAttempts()).length;
      el.textContent = n ? `(${n})` : '';
    } catch (e) {}
  }

  function closeModal() {
    const m = document.getElementById('history-modal');
    if (m) m.remove();
  }

  async function openModal() {
    let items;
    try {
      items = await listAttempts();
    } catch (e) {
      alert('Browser ini memblokir penyimpanan riwayat (misalnya mode privat).');
      return;
    }
    closeModal();
    const modal = document.createElement('div');
    modal.id = 'history-modal';
    modal.className = 'fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4';
    const rows = items.map((r) => `
      <div class="subtle border rounded-xl p-3 space-y-2">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs sm:text-sm font-bold text-main">${escapeHtml(r.code)} — ${escapeHtml(r.title)}</div>
            <div class="text-[11px] text-mute mt-0.5">${escapeHtml(new Date(r.finishedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }))} • Mode ${escapeHtml(r.mode)}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-lg font-extrabold text-main leading-none">${escapeHtml(r.score)}</div>
            <div class="text-[10px] text-mute mt-1">Skor</div>
          </div>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] text-sub">Benar ${escapeHtml(r.correct)} • Salah ${escapeHtml(r.wrong)} • Kosong ${escapeHtml(r.empty)}</span>
          <span class="flex gap-1.5 shrink-0">
            <button type="button" data-del="${r.id}" class="btn-secondary px-3 h-8 rounded-lg text-xs font-semibold">Hapus</button>
            <button type="button" data-open="${r.id}" class="btn-primary px-3 h-8 rounded-lg text-xs font-bold">Buka</button>
          </span>
        </div>
      </div>`).join('');

    modal.innerHTML = `
      <div class="surface border w-full max-w-xl max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden fade-in">
        <div class="px-5 py-4 border-b flex items-center justify-between gap-3" style="border-color: var(--border-color);">
          <div>
            <h3 class="text-base font-bold text-main">Riwayat Pengerjaan</h3>
            <p class="text-[11px] text-mute">Tersimpan di browser perangkat ini saja.</p>
          </div>
          <button type="button" data-close class="btn-secondary w-8 h-8 rounded-lg text-xs font-bold">✕</button>
        </div>
        <div class="p-4 space-y-2.5 overflow-y-auto custom-scroll">
          ${rows || '<p class="text-sm text-sub text-center py-8">Belum ada riwayat. Hasil tercatat otomatis setiap kali ujian diselesaikan.</p>'}
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', async (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) return closeModal();
      const del = e.target.closest('[data-del]');
      if (del) {
        if (!confirm('Hapus riwayat ini? Tidak bisa dikembalikan.')) return;
        await dbRun('readwrite', (s) => s.delete(del.dataset.del));
        refreshCount();
        return openModal();
      }
      const open = e.target.closest('[data-open]');
      if (open) {
        const record = items.find((r) => r.id === open.dataset.open);
        closeModal();
        if (record.source === 'cloud') window.PortalCloud.open(record.packageId, record);
        else openExam(record.packageId, record);
      }
    });
  }

  /** Mengembalikan false jika isi paket berubah dan peserta batal membuka. */
  function confirmSameContent(record, htmlHash) {
    return !record || record.htmlHash === htmlHash ||
      confirm('Isi paket ini sudah berubah sejak dikerjakan. Pembahasan bisa tidak cocok dengan jawaban lama. Tetap buka?');
  }

  window.PortalHistory = { attach, openModal, closeModal, refreshCount, hashText, confirmSameContent };
})();
