(function () {
  'use strict';

  const TOKEN_STORAGE_KEY = 'portal_ukmppdh_gh_token';
  const CFG_OVERRIDE_KEY = 'portal_ukmppdh_gh_cfg';

  let repoConfig = {
    owner: '',
    repo: '',
    branch: 'main',
    manifestPath: 'data/manifest.json',
    packagesDir: 'data/packages'
  };

  let cloudPackages = [];
  let pendingUploadHtml = '';
  let pendingUploadFileName = '';

  // ==================== UTILITAS ENCODING UTF-8 <-> BASE64 ====================
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToUtf8(b64) {
    const binary = atob(b64.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugifyFileName(name) {
    const base = String(name || 'paket_soal')
      .replace(/\.html?$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (base || 'paket_soal') + '.html';
  }

  function getSavedToken() {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function saveToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
      else localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {}
  }

  function getEffectiveConfig() {
    try {
      const override = JSON.parse(localStorage.getItem(CFG_OVERRIDE_KEY) || 'null');
      if (override && override.owner && override.repo) {
        return Object.assign({}, repoConfig, override);
      }
    } catch (e) {}
    return repoConfig;
  }

  function saveConfigOverride(owner, repo, branch) {
    try {
      localStorage.setItem(
        CFG_OVERRIDE_KEY,
        JSON.stringify({
          owner: owner.trim(),
          repo: repo.trim(),
          branch: (branch || 'main').trim()
        })
      );
    } catch (e) {}
  }

  // ==================== LOAD CONFIG & MANIFEST ====================
  async function loadRepoConfig() {
    try {
      const res = await fetch('./config.json?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        repoConfig = Object.assign(repoConfig, data);
      }
    } catch (e) {
      console.warn('[GitHubSync] config.json belum terbaca:', e);
    }
  }

  async function loadCloudManifest(preferRaw) {
    const cfg = getEffectiveConfig();
    const ts = Date.now();
    const urls = [];

    if (preferRaw && cfg.owner && cfg.repo) {
      urls.push(
        `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.manifestPath}?t=${ts}`
      );
    }
    urls.push(`./${cfg.manifestPath}?t=${ts}`);
    if (!preferRaw && cfg.owner && cfg.repo) {
      urls.push(
        `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.manifestPath}?t=${ts}`
      );
    }

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          cloudPackages = Array.isArray(json.packages) ? json.packages : [];
          renderCloudSection();
          renderManageCloudList();
          return cloudPackages;
        }
      } catch (e) {}
    }

    cloudPackages = [];
    renderCloudSection();
    renderManageCloudList();
    return [];
  }

  // ==================== GITHUB REST API ====================
  async function githubRequest(path, method, bodyObj, token) {
    const cfg = getEffectiveConfig();
    if (!cfg.owner || !cfg.repo) {
      throw new Error('Owner dan nama repository belum diisi di tab Pengaturan.');
    }
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (bodyObj) headers['Content-Type'] = 'application/json';

    const cleanPath = path ? `/${String(path).replace(/^\/+/, '')}` : '';
    const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${cleanPath}`;
    const res = await fetch(url, {
      method: method || 'GET',
      headers,
      body: bodyObj ? JSON.stringify(bodyObj) : undefined
    });

    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {}

    if (!res.ok) {
      const msg = json.message || `HTTP ${res.status}`;
      throw new Error(`GitHub API Error (${res.status}): ${msg}`);
    }
    return json;
  }

  async function getFileSha(filePath, token) {
    const cfg = getEffectiveConfig();
    try {
      const data = await githubRequest(
        `contents/${filePath}?ref=${encodeURIComponent(cfg.branch)}`,
        'GET',
        null,
        token
      );
      return { sha: data.sha || null, content: data.content ? base64ToUtf8(data.content) : null };
    } catch (e) {
      if (String(e.message).includes('(404)')) {
        return { sha: null, content: null };
      }
      throw e;
    }
  }

  async function putRepoFile(filePath, contentString, commitMessage, token) {
    const cfg = getEffectiveConfig();
    const existing = await getFileSha(filePath, token);
    const payload = {
      message: commitMessage,
      content: utf8ToBase64(contentString),
      branch: cfg.branch
    };
    if (existing.sha) payload.sha = existing.sha;

    return githubRequest(`contents/${filePath}`, 'PUT', payload, token);
  }

  async function deleteRepoFile(filePath, commitMessage, token) {
    const cfg = getEffectiveConfig();
    const existing = await getFileSha(filePath, token);
    if (!existing.sha) return;

    return githubRequest(
      `contents/${filePath}`,
      'DELETE',
      {
        message: commitMessage,
        sha: existing.sha,
        branch: cfg.branch
      },
      token
    );
  }

  // ==================== BUKA PAKET CLOUD DI WORKSPACE ====================
  async function openCloudPackage(pkgId) {
    const pkg = cloudPackages.find((p) => p.id === pkgId);
    if (!pkg) return;

    const cfg = getEffectiveConfig();
    const filePath = `${cfg.packagesDir}/${pkg.fileName}`;
    const ts = Date.now();
    const candidateUrls = [
      `./${filePath}?t=${ts}`,
      cfg.owner && cfg.repo
        ? `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${filePath}?t=${ts}`
        : null
    ].filter(Boolean);

    let htmlContent = '';
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          htmlContent = await res.text();
          break;
        }
      } catch (e) {}
    }

    if (!htmlContent) {
      alert('Gagal memuat file soal. Silakan muat ulang halaman beberapa saat lagi.');
      return;
    }

    const overlay = ensureCloudRunnerOverlay();
    const titleEl = overlay.querySelector('#gh-runner-title');
    const iframe = overlay.querySelector('#gh-runner-frame');

    titleEl.textContent = `${pkg.code} — ${pkg.title}`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    if (iframe.dataset.blobUrl) {
      try {
        URL.revokeObjectURL(iframe.dataset.blobUrl);
      } catch (e) {}
    }
    iframe.dataset.blobUrl = blobUrl;
    iframe.src = blobUrl;

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function ensureCloudRunnerOverlay() {
    let el = document.getElementById('gh-cloud-runner');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'gh-cloud-runner';
    el.className = 'hidden fixed inset-0 z-[90] h-[100dvh] flex flex-col surface';
    el.innerHTML = `
      <div class="h-12 sm:h-14 surface border-b px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <button type="button" id="gh-runner-close"
            class="btn-secondary h-9 px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            <span>Portal</span>
          </button>
          <span id="gh-runner-title" class="text-xs sm:text-sm font-bold text-main truncate">Simulasi CBT</span>
        </div>
      </div>
      <iframe id="gh-runner-frame" class="w-full flex-1 border-0 bg-white" title="Simulasi CBT Tambahan"></iframe>
    `;
    document.body.appendChild(el);

    el.querySelector('#gh-runner-close').addEventListener('click', () => {
      el.classList.add('hidden');
      document.body.style.overflow = '';
    });

    return el;
  }

  // ==================== RENDER SEKSI PAKET TAMBAHAN ====================
  function renderCloudSection() {
    const grid = document.getElementById('packages-grid');
    if (!grid || !grid.parentElement) return;

    let wrap = document.getElementById('gh-cloud-packages-section');
    if (!wrap) {
      wrap = document.createElement('section');
      wrap.id = 'gh-cloud-packages-section';
      wrap.className = 'mt-7 sm:mt-8 pt-6 border-t';
      wrap.style.borderColor = 'var(--border-color)';
      grid.parentElement.appendChild(wrap);
    }

    if (!cloudPackages.length) {
      wrap.innerHTML = '';
      wrap.classList.add('hidden');
      return;
    }

    wrap.classList.remove('hidden');
    wrap.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-4">
        <h2 class="text-sm sm:text-base font-extrabold tracking-tight text-main">Paket Soal Tambahan</h2>
        <span class="subtle border px-2.5 py-1 rounded-full text-xs font-semibold text-sub">
          ${cloudPackages.length} Paket
        </span>
      </div>
      <div id="gh-cloud-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
        ${cloudPackages
          .map(
            (pkg) => `
          <div class="surface border rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-colors hover:border-slate-400 dark:hover:border-zinc-600">
            <div class="space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="badge-pastel px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800">${escapeHtml(pkg.code)}</span>
                ${
                  pkg.hasOsce
                    ? '<span class="badge-osce px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800">+ OSCE</span>'
                    : ''
                }
              </div>
              <div>
                <h3 class="text-[15px] sm:text-base font-bold text-main leading-snug">${escapeHtml(pkg.title)}</h3>
                <p class="text-xs text-mute mt-0.5">${escapeHtml(pkg.name || 'Try Out Nasional')}</p>
              </div>
              <p class="text-xs text-sub leading-relaxed line-clamp-2">${escapeHtml(pkg.highlights || '')}</p>
            </div>
            <div class="space-y-3 pt-3 border-t" style="border-color: var(--border-color);">
              <div class="flex items-center justify-between text-xs font-medium text-sub">
                <span>${escapeHtml(pkg.questions)} Soal</span>
                <span>${escapeHtml(pkg.duration)}</span>
              </div>
              <button type="button" data-gh-open="${escapeHtml(pkg.id)}"
                class="btn-primary w-full min-h-[42px] px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2">
                <span>Mulai Simulasi</span>
                <span>→</span>
              </button>
            </div>
          </div>`
          )
          .join('')}
      </div>
    `;

    wrap.querySelectorAll('[data-gh-open]').forEach((btn) => {
      btn.addEventListener('click', () => openCloudPackage(btn.getAttribute('data-gh-open')));
    });
  }

  // ==================== MODAL UPLOAD & KELOLA GITHUB (ADMIN) ====================
  function ensureAdminModal() {
    let modal = document.getElementById('gh-sync-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'gh-sync-modal';
    modal.className = 'hidden fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs';
    modal.innerHTML = `
      <div class="surface border w-full max-w-xl max-h-[92dvh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden fade-in">
        <div class="flex items-center justify-between px-5 py-4 border-b shrink-0" style="border-color: var(--border-color);">
          <div>
            <h3 class="text-base font-bold text-main">Upload ke GitHub</h3>
            <p class="text-xs text-mute">Unggah dan kelola paket soal di repository</p>
          </div>
          <button type="button" id="gh-modal-close" class="btn-secondary w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center">✕</button>
        </div>

        <div class="flex gap-4 px-5 pt-3 border-b text-xs font-bold shrink-0 overflow-x-auto no-scrollbar" style="border-color: var(--border-color);">
          <button type="button" data-gh-tab="upload" class="gh-tab-btn pb-2.5 border-b-2 whitespace-nowrap">Upload Soal</button>
          <button type="button" data-gh-tab="manage" class="gh-tab-btn pb-2.5 border-b-2 border-transparent text-mute whitespace-nowrap">Kelola Paket</button>
          <button type="button" data-gh-tab="settings" class="gh-tab-btn pb-2.5 border-b-2 border-transparent text-mute whitespace-nowrap">Pengaturan</button>
        </div>

        <div class="overflow-y-auto custom-scroll flex-1">
          <!-- TAB 1: UPLOAD HTML -->
          <div id="gh-panel-upload" class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-sub mb-1.5">File Soal (.html)</label>
              <input type="file" id="gh-file-input" accept=".html,.htm"
                class="input-clean block w-full text-xs rounded-xl p-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold" />
              <p id="gh-file-info" class="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1.5"></p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Kode Singkat</label>
                <input type="text" id="gh-pkg-code" placeholder="Contoh: UGM" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl uppercase" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Institusi</label>
                <input type="text" id="gh-pkg-org" placeholder="Universitas Gadjah Mada" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-sub mb-1">Judul Paket Soal</label>
              <input type="text" id="gh-pkg-title" placeholder="TO Nasional CBT UKMPPDH 2026" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Jumlah Soal</label>
                <input type="number" id="gh-pkg-qcount" value="100" min="1" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Durasi</label>
                <input type="text" id="gh-pkg-duration" value="100 Menit" class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-sub mb-1">Deskripsi Singkat</label>
              <input type="text" id="gh-pkg-highlights" placeholder="Lengkap dengan pembahasan dan mode latihan." class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
            </div>

            <label class="inline-flex items-center gap-2 text-xs font-semibold text-sub cursor-pointer">
              <input type="checkbox" id="gh-pkg-osce" class="w-4 h-4 rounded" />
              <span>Termasuk materi OSCE</span>
            </label>

            <div id="gh-upload-status" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

            <button type="button" id="gh-btn-upload-submit"
              class="btn-primary w-full min-h-[46px] rounded-xl text-xs sm:text-sm font-bold">
              Upload ke GitHub
            </button>
          </div>

          <!-- TAB 2: KELOLA PAKET -->
          <div id="gh-panel-manage" class="hidden p-5 space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-xs text-mute">Daftar paket di repository</p>
              <button type="button" id="gh-btn-refresh-cloud" class="btn-secondary px-3 h-8 rounded-lg text-xs font-semibold">Muat Ulang</button>
            </div>
            <div id="gh-manage-list" class="space-y-2"></div>
            <div id="gh-manage-status" class="hidden p-3 rounded-xl text-xs font-semibold"></div>
          </div>

          <!-- TAB 3: PENGATURAN GITHUB -->
          <div id="gh-panel-settings" class="hidden p-5 space-y-4">
            <div class="subtle border p-3 rounded-xl text-xs text-sub leading-relaxed">
              Token disimpan hanya di browser perangkat Admin ini dan memerlukan izin <strong>Contents: Read and write</strong> pada repository target.
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Owner</label>
                <input type="text" id="gh-cfg-owner" class="input-clean w-full px-3 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Repository</label>
                <input type="text" id="gh-cfg-repo" class="input-clean w-full px-3 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-sub mb-1">Branch</label>
                <input type="text" id="gh-cfg-branch" value="main" class="input-clean w-full px-3 py-2.5 text-base sm:text-sm rounded-xl" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-sub mb-1">Personal Access Token (PAT)</label>
              <input type="password" id="gh-cfg-token" placeholder="github_pat_..." class="input-clean w-full px-3.5 py-2.5 text-base sm:text-sm rounded-xl" />
            </div>

            <div id="gh-settings-status" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

            <div class="flex flex-wrap gap-2 pt-1">
              <button type="button" id="gh-btn-save-settings" class="btn-primary px-4 h-10 rounded-xl text-xs font-bold">
                Simpan
              </button>
              <button type="button" id="gh-btn-test-conn" class="btn-secondary px-4 h-10 rounded-xl text-xs font-semibold">
                Tes Koneksi
              </button>
              <button type="button" id="gh-btn-clear-token" class="btn-secondary px-4 h-10 rounded-xl text-rose-600 text-xs font-semibold">
                Hapus Token
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#gh-modal-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    modal.querySelectorAll('.gh-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchGhTab(btn.getAttribute('data-gh-tab')));
    });

    modal.querySelector('#gh-file-input').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        pendingUploadHtml = String(reader.result || '');
        pendingUploadFileName = slugifyFileName(file.name);
        const sizeKb = (file.size / 1024).toFixed(1);
        modal.querySelector('#gh-file-info').textContent = `✓ ${pendingUploadFileName} (${sizeKb} KB)`;

        const titleMatch = pendingUploadHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        const titleInput = modal.querySelector('#gh-pkg-title');
        if (titleMatch && !titleInput.value.trim()) {
          titleInput.value = titleMatch[1].trim();
        }
      };
      reader.readAsText(file, 'utf-8');
    });

    modal.querySelector('#gh-btn-upload-submit').addEventListener('click', handleUploadToGitHub);
    modal.querySelector('#gh-btn-refresh-cloud').addEventListener('click', () => loadCloudManifest(true));

    modal.querySelector('#gh-btn-save-settings').addEventListener('click', () => {
      const owner = modal.querySelector('#gh-cfg-owner').value;
      const repo = modal.querySelector('#gh-cfg-repo').value;
      const branch = modal.querySelector('#gh-cfg-branch').value;
      const token = modal.querySelector('#gh-cfg-token').value;
      saveConfigOverride(owner, repo, branch);
      if (token.trim()) saveToken(token);
      showStatus('#gh-settings-status', 'Pengaturan tersimpan.', true);
    });

    modal.querySelector('#gh-btn-clear-token').addEventListener('click', () => {
      saveToken('');
      modal.querySelector('#gh-cfg-token').value = '';
      showStatus('#gh-settings-status', 'Token dihapus dari browser.', true);
    });

    modal.querySelector('#gh-btn-test-conn').addEventListener('click', async () => {
      const token = modal.querySelector('#gh-cfg-token').value.trim() || getSavedToken();
      saveConfigOverride(
        modal.querySelector('#gh-cfg-owner').value,
        modal.querySelector('#gh-cfg-repo').value,
        modal.querySelector('#gh-cfg-branch').value
      );
      if (!token) {
        showStatus('#gh-settings-status', 'Masukkan token terlebih dahulu.', false);
        return;
      }
      showStatus('#gh-settings-status', 'Menguji koneksi...', true);
      try {
        const repoInfo = await githubRequest('', 'GET', null, token);
        const canPush = repoInfo.permissions && repoInfo.permissions.push;
        showStatus(
          '#gh-settings-status',
          `Terhubung ke ${repoInfo.full_name} (Izin tulis: ${canPush ? 'YA' : 'TIDAK'}).`,
          Boolean(canPush)
        );
      } catch (err) {
        showStatus('#gh-settings-status', err.message, false);
      }
    });

    switchGhTab('upload');
    return modal;
  }

  function switchGhTab(tabName) {
    const modal = ensureAdminModal();
    ['upload', 'manage', 'settings'].forEach((name) => {
      const panel = modal.querySelector(`#gh-panel-${name}`);
      const btn = modal.querySelector(`[data-gh-tab="${name}"]`);
      if (name === tabName) {
        panel.classList.remove('hidden');
        btn.style.borderColor = 'var(--text-primary)';
        btn.style.color = 'var(--text-primary)';
      } else {
        panel.classList.add('hidden');
        btn.style.borderColor = 'transparent';
        btn.style.color = 'var(--text-muted)';
      }
    });
  }

  function showStatus(selector, message, isSuccess) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.textContent = message;
    el.className = `p-3 rounded-xl text-xs font-semibold ${
      isSuccess
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30'
    }`;
    el.classList.remove('hidden');
  }

  async function handleUploadToGitHub() {
    const modal = ensureAdminModal();
    const token = getSavedToken();
    const cfg = getEffectiveConfig();

    if (!token || !cfg.owner || !cfg.repo) {
      showStatus('#gh-upload-status', 'Lengkapi Owner, Repository, dan Token di tab Pengaturan.', false);
      switchGhTab('settings');
      return;
    }
    if (!pendingUploadHtml) {
      showStatus('#gh-upload-status', 'Pilih file soal .html terlebih dahulu.', false);
      return;
    }

    const code = (modal.querySelector('#gh-pkg-code').value || 'BARU').trim().toUpperCase();
    const org = (modal.querySelector('#gh-pkg-org').value || 'Try Out Nasional').trim();
    const title = (modal.querySelector('#gh-pkg-title').value || pendingUploadFileName).trim();
    const questions = parseInt(modal.querySelector('#gh-pkg-qcount').value, 10) || 0;
    const duration = (modal.querySelector('#gh-pkg-duration').value || '100 Menit').trim();
    const highlights = (modal.querySelector('#gh-pkg-highlights').value || 'Paket simulasi CBT lengkap dengan pembahasan.').trim();
    const hasOsce = modal.querySelector('#gh-pkg-osce').checked;

    const id = 'gh_' + Date.now().toString(36);
    const uniqueFileName = `${id}_${pendingUploadFileName}`;
    const pkgFilePath = `${cfg.packagesDir}/${uniqueFileName}`;
    const btn = modal.querySelector('#gh-btn-upload-submit');

    btn.disabled = true;
    btn.textContent = 'Mengunggah...';
    showStatus('#gh-upload-status', '1/2 Mengunggah file soal ke GitHub...', true);

    try {
      await putRepoFile(pkgFilePath, pendingUploadHtml, `Upload paket soal: ${code} - ${title}`, token);

      showStatus('#gh-upload-status', '2/2 Memperbarui manifest...', true);
      const manifestData = await getFileSha(cfg.manifestPath, token);
      let manifestObj = { updatedAt: '', packages: [] };
      if (manifestData.content) {
        try {
          manifestObj = JSON.parse(manifestData.content);
        } catch (e) {}
      }
      if (!Array.isArray(manifestObj.packages)) manifestObj.packages = [];

      manifestObj.packages.unshift({
        id,
        code,
        name: org,
        title,
        fileName: uniqueFileName,
        questions,
        duration,
        hasOsce,
        highlights,
        uploadedAt: new Date().toISOString()
      });
      manifestObj.updatedAt = new Date().toISOString();

      await putRepoFile(
        cfg.manifestPath,
        JSON.stringify(manifestObj, null, 2),
        `Update manifest: tambah paket ${code}`,
        token
      );

      pendingUploadHtml = '';
      pendingUploadFileName = '';
      modal.querySelector('#gh-file-input').value = '';
      modal.querySelector('#gh-file-info').textContent = '';

      showStatus('#gh-upload-status', 'Berhasil diunggah ke GitHub!', true);
      await loadCloudManifest(true);
    } catch (err) {
      showStatus('#gh-upload-status', err.message, false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload ke GitHub';
    }
  }

  function renderManageCloudList() {
    const list = document.getElementById('gh-manage-list');
    if (!list) return;

    if (!cloudPackages.length) {
      list.innerHTML = '<p class="text-xs text-mute py-4 text-center">Belum ada paket tambahan di GitHub.</p>';
      return;
    }

    list.innerHTML = cloudPackages
      .map(
        (pkg) => `
      <div class="subtle border flex items-center justify-between gap-3 p-3 rounded-xl text-xs">
        <div class="min-w-0">
          <div class="font-bold text-main truncate">[${escapeHtml(pkg.code)}] ${escapeHtml(pkg.title)}</div>
          <div class="text-mute truncate mt-0.5">${escapeHtml(pkg.questions)} soal • ${escapeHtml(pkg.duration)}</div>
        </div>
        <button type="button" data-gh-delete="${escapeHtml(pkg.id)}"
          class="px-3 h-8 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold shrink-0">
          Hapus
        </button>
      </div>`
      )
      .join('');

    list.querySelectorAll('[data-gh-delete]').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteCloudPackage(btn.getAttribute('data-gh-delete')));
    });
  }

  async function handleDeleteCloudPackage(pkgId) {
    const token = getSavedToken();
    const cfg = getEffectiveConfig();
    if (!token) {
      showStatus('#gh-manage-status', 'Masukkan token di tab Pengaturan terlebih dahulu.', false);
      return;
    }
    const pkg = cloudPackages.find((p) => p.id === pkgId);
    if (!pkg) return;
    if (!confirm(`Hapus paket "${pkg.title}" dari GitHub?`)) return;

    showStatus('#gh-manage-status', 'Menghapus paket...', true);
    try {
      await deleteRepoFile(`${cfg.packagesDir}/${pkg.fileName}`, `Hapus paket soal: ${pkg.code}`, token);

      const manifestData = await getFileSha(cfg.manifestPath, token);
      const manifestObj = manifestData.content ? JSON.parse(manifestData.content) : { packages: [] };
      manifestObj.packages = (manifestObj.packages || []).filter((p) => p.id !== pkgId);
      manifestObj.updatedAt = new Date().toISOString();

      await putRepoFile(
        cfg.manifestPath,
        JSON.stringify(manifestObj, null, 2),
        `Update manifest: hapus paket ${pkg.code}`,
        token
      );

      showStatus('#gh-manage-status', 'Paket berhasil dihapus.', true);
      await loadCloudManifest(true);
    } catch (err) {
      showStatus('#gh-manage-status', err.message, false);
    }
  }

  // ==================== PASANG EVENT PADA TOMBOL ADMIN ====================
  function bindAdminButton() {
    const btn = document.getElementById('btn-open-gh-sync');
    if (!btn || btn.dataset.ghBound === '1') return;
    btn.dataset.ghBound = '1';

    btn.addEventListener('click', () => {
      const modal = ensureAdminModal();
      const cfg = getEffectiveConfig();
      modal.querySelector('#gh-cfg-owner').value = cfg.owner || '';
      modal.querySelector('#gh-cfg-repo').value = cfg.repo || '';
      modal.querySelector('#gh-cfg-branch').value = cfg.branch || 'main';
      modal.querySelector('#gh-cfg-token').value = getSavedToken();
      renderManageCloudList();
      modal.classList.remove('hidden');
    });
  }

  // ==================== INISIALISASI ====================
  async function init() {
    bindAdminButton();
    await loadRepoConfig();
    await loadCloudManifest(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
